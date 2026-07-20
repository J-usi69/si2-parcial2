import 'dart:async';
import 'dart:io';

import '../api_service.dart';
import 'connectivity_service.dart';
import 'outbox_repository.dart';

/// Sincroniza la cola de emergencias creadas offline cuando vuelve la conexion.
///
/// Garantiza que no se dupliquen incidentes: cada item lleva su client_uuid y
/// el backend es idempotente. Un item ya enviado nunca se reenvia.
class SyncService {
  SyncService._();
  static final SyncService instance = SyncService._();

  final _outbox = OutboxRepository.instance;
  final _statusController = StreamController<void>.broadcast();
  StreamSubscription<bool>? _connSub;
  bool _syncing = false;

  /// Notifica cambios (sincronizo algo) para que la UI refresque badges.
  Stream<void> get onChange => _statusController.stream;

  void start() {
    // Reintentar al recuperar conexion.
    _connSub ??= ConnectivityService.instance.onStatusChange.listen((online) {
      if (online) syncNow();
    });
  }

  void dispose() {
    _connSub?.cancel();
    _statusController.close();
  }

  /// Encola una emergencia (creada offline u online) en el outbox.
  ///
  /// [imagePaths] y [audioPath] deben apuntar a copias en almacenamiento
  /// durable (no cache/temp), ya que pueden tardar en subirse si no hay red.
  Future<OutboxItem> enqueueEmergency({
    required String clientUuid,
    required int vehicleId,
    required double latitude,
    required double longitude,
    String? address,
    String? description,
    List<String> imagePaths = const [],
    String? audioPath,
  }) async {
    final item = OutboxItem(
      clientUuid: clientUuid,
      vehicleId: vehicleId,
      latitude: latitude,
      longitude: longitude,
      address: address,
      description: description,
      status: OutboxStatus.pending,
      createdAt: DateTime.now().toUtc().toIso8601String(),
      imagePaths: imagePaths,
      audioPath: audioPath,
    );
    await _outbox.enqueue(item);
    _statusController.add(null);
    return item;
  }

  /// Procesa la cola en orden. Devuelve cuantos incidentes se sincronizaron.
  Future<int> syncNow() async {
    if (_syncing) return 0;
    _syncing = true;
    var synced = 0;
    try {
      if (!await ConnectivityService.instance.checkNow()) return 0;
      final items = await _outbox.pendingOrFailed();
      for (final item in items) {
        try {
          final incident = await ApiService.createIncident(
            vehicleId: item.vehicleId,
            latitude: item.latitude,
            longitude: item.longitude,
            address: item.address,
            description: item.description,
            clientUuid: item.clientUuid, // idempotencia
          );
          await _outbox.markSent(item.clientUuid, incident.id);
          synced++;
          _statusController.add(null);

          // La evidencia se sube best-effort: si falla, el incidente ya
          // quedo creado y no debe reintentarse (evita duplicar el reporte).
          try {
            await _uploadEvidence(incident.id, item);
          } catch (_) {
            // Se pierde la evidencia de este item puntual, pero no bloquea
            // el resto de la cola ni reintenta un incidente ya creado.
          }
        } catch (e) {
          await _outbox.markError(item.clientUuid, e.toString(), item.retryCount + 1);
          _statusController.add(null);
          // Continuar con el resto; se reintentara en el proximo ciclo.
        }
      }
    } finally {
      _syncing = false;
    }
    return synced;
  }

  Future<void> _uploadEvidence(int incidentId, OutboxItem item) async {
    for (final path in item.imagePaths) {
      final file = File(path);
      if (await file.exists()) {
        await ApiService.uploadImage(incidentId, file);
        await file.delete().catchError((_) => file);
      }
    }
    if (item.audioPath != null) {
      final file = File(item.audioPath!);
      if (await file.exists()) {
        await ApiService.uploadAudio(incidentId, file);
        await file.delete().catchError((_) => file);
      }
    }
  }

  Future<int> pendingCount() => _outbox.countPending();
}
