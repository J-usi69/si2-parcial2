import 'dart:async';

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
  Future<OutboxItem> enqueueEmergency({
    required String clientUuid,
    required int vehicleId,
    required double latitude,
    required double longitude,
    String? address,
    String? description,
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
    );
    await _outbox.enqueue(item);
    _statusController.add(null);
    return item;
  }

  /// Procesa la cola en orden. Devuelve cuantos se sincronizaron.
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

  Future<int> pendingCount() => _outbox.countPending();
}
