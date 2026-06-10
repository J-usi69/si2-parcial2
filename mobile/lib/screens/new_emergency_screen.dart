import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:image_picker/image_picker.dart';
import 'package:geolocator/geolocator.dart';
import 'package:record/record.dart';
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../services/offline/connectivity_service.dart';
import '../services/offline/outbox_repository.dart';
import '../services/offline/sync_service.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';
import '../widgets/app_card.dart';
import '../widgets/app_snackbar.dart';

class NewEmergencyScreen extends StatefulWidget {
  const NewEmergencyScreen({super.key});

  @override
  State<NewEmergencyScreen> createState() => _NewEmergencyScreenState();
}

class _NewEmergencyScreenState extends State<NewEmergencyScreen> {
  final _descCtrl = TextEditingController();
  final _audioRecorder = AudioRecorder();
  List<Vehicle> _vehicles = [];
  Vehicle? _selectedVehicle;
  final List<File> _images = [];
  File? _audioFile;
  Position? _position;
  bool _loading = false;
  bool _locating = false;
  bool _recording = false;
  Duration _recordDuration = Duration.zero;
  int _step = 0; // 0=vehiculo, 1=ubicacion, 2=evidencias, 3=enviar

  static const _steps = ['Vehiculo', 'Ubicacion', 'Evidencias', 'Confirmar'];

  @override
  void initState() {
    super.initState();
    _loadVehicles();
  }

  @override
  void dispose() {
    _descCtrl.dispose();
    _audioRecorder.dispose();
    super.dispose();
  }

  Future<void> _loadVehicles() async {
    try {
      final vehicles = await ApiService.getVehicles();
      // Cachear para uso offline.
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('cached_vehicles', jsonEncode(vehicles.map((v) => v.toJson()).toList()));
      if (mounted) setState(() => _vehicles = vehicles);
    } catch (_) {
      // Sin conexion: cargar desde cache local.
      try {
        final prefs = await SharedPreferences.getInstance();
        final raw = prefs.getString('cached_vehicles');
        if (raw != null && mounted) {
          final list = (jsonDecode(raw) as List).map((e) => Vehicle.fromJson(e as Map<String, dynamic>)).toList();
          setState(() => _vehicles = list);
        }
      } catch (_) {}
    }
  }

  Future<void> _getLocation() async {
    setState(() => _locating = true);
    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        setState(() {
          _position = Position(
            latitude: -16.5000,
            longitude: -68.1500,
            timestamp: DateTime.now(),
            accuracy: 0,
            altitude: 0,
            altitudeAccuracy: 0,
            heading: 0,
            headingAccuracy: 0,
            speed: 0,
            speedAccuracy: 0,
          );
        });
        return;
      }
      final pos = await Geolocator.getCurrentPosition();
      if (mounted) setState(() => _position = pos);
    } catch (e) {
      setState(() {
        _position = Position(
          latitude: -16.5000,
          longitude: -68.1500,
          timestamp: DateTime.now(),
          accuracy: 0,
          altitude: 0,
          altitudeAccuracy: 0,
          heading: 0,
          headingAccuracy: 0,
          speed: 0,
          speedAccuracy: 0,
        );
      });
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  Future<void> _pickImage(ImageSource source) async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: source, imageQuality: 80);
    if (picked != null) {
      setState(() => _images.add(File(picked.path)));
    }
  }

  Future<void> _toggleRecording() async {
    if (_recording) {
      // Stop recording
      final path = await _audioRecorder.stop();
      if (path != null && mounted) {
        setState(() {
          _audioFile = File(path);
          _recording = false;
          _recordDuration = Duration.zero;
        });
        AppSnackBar.success(context, 'Audio grabado exitosamente');
      }
    } else {
      // Start recording
      if (await _audioRecorder.hasPermission()) {
        final dir = await getTemporaryDirectory();
        final path =
            '${dir.path}/emergency_audio_${DateTime.now().millisecondsSinceEpoch}.m4a';
        await _audioRecorder.start(
          const RecordConfig(
            encoder: AudioEncoder.aacLc,
            sampleRate: 44100,
            bitRate: 128000,
          ),
          path: path,
        );
        setState(() {
          _recording = true;
          _recordDuration = Duration.zero;
        });
        _updateRecordTimer();
      } else {
        if (mounted) {
          AppSnackBar.error(context, 'Se necesita permiso de microfono');
        }
      }
    }
  }

  void _updateRecordTimer() async {
    while (_recording && mounted) {
      await Future.delayed(const Duration(seconds: 1));
      if (_recording && mounted) {
        setState(() => _recordDuration += const Duration(seconds: 1));
      }
    }
  }

  void _deleteAudio() {
    setState(() {
      _audioFile = null;
      _recordDuration = Duration.zero;
    });
  }

  String _formatDuration(Duration d) {
    final minutes = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final seconds = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }

  Future<void> _sendEmergency() async {
    if (_selectedVehicle == null || _position == null) return;
    setState(() => _loading = true);

    final clientUuid = const Uuid().v4();
    try {
      // 1. Persistir SIEMPRE en el outbox local (sobrevive aunque no haya red).
      await SyncService.instance.enqueueEmergency(
        clientUuid: clientUuid,
        vehicleId: _selectedVehicle!.id,
        latitude: _position!.latitude,
        longitude: _position!.longitude,
        description: _descCtrl.text.isNotEmpty ? _descCtrl.text : null,
      );

      // 2. Si no hay internet: queda pendiente de sincronizacion.
      final online = await ConnectivityService.instance.checkNow();
      if (!online) {
        if (mounted) {
          AppSnackBar.info(context,
              'Sin conexion: tu emergencia quedo guardada y se enviara automaticamente al recuperar internet.');
          Navigator.pop(context, true);
        }
        return;
      }

      // 3. Online: sincronizar (crea el incidente con idempotencia por client_uuid).
      await SyncService.instance.syncNow();

      // 4. Subir evidencia al incidente ya sincronizado.
      final items = await OutboxRepository.instance.all();
      OutboxItem? item;
      for (final it in items) {
        if (it.clientUuid == clientUuid) item = it;
      }
      if (item?.remoteId != null) {
        for (final img in _images) {
          await ApiService.uploadImage(item!.remoteId!, img);
        }
        if (_audioFile != null) {
          await ApiService.uploadAudio(item!.remoteId!, _audioFile!);
        }
      }

      if (mounted) {
        if (item?.remoteId != null) {
          AppSnackBar.success(context, 'Emergencia reportada exitosamente');
        } else {
          AppSnackBar.info(context,
              'Emergencia guardada; se sincronizara automaticamente en breve.');
        }
        Navigator.pop(context, true);
      }
    } catch (e) {
      // Aunque falle el envio, quedo en el outbox y se reintentara solo.
      if (mounted) {
        AppSnackBar.info(context,
            'Emergencia guardada localmente; se enviara al recuperar conexion.');
        Navigator.pop(context, true);
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _next() {
    if (_step == 0 && _selectedVehicle == null) {
      AppSnackBar.error(context, 'Selecciona un vehiculo');
      return;
    }
    if (_step == 1 && _position == null) {
      AppSnackBar.error(context, 'Obtiene tu ubicacion primero');
      return;
    }
    if (_step < 3) {
      setState(() => _step++);
    } else {
      _sendEmergency();
    }
  }

  void _back() {
    if (_step > 0) setState(() => _step--);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.appColors.background,
      appBar: AppBar(
        title: const Text('Reportar Emergencia'),
        backgroundColor: context.appColors.background,
        foregroundColor: context.appColors.textPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: Theme.of(context).textTheme.headlineSmall?.copyWith(
          color: context.appColors.textPrimary,
          fontWeight: FontWeight.w800,
          letterSpacing: -0.5,
        ),
      ),
      body: Column(
        children: [
          // Header con stepper visual
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.lg,
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: List.generate(_steps.length, (i) {
                    final active = i <= _step;
                    final completed = i < _step;
                    final isLast = i == _steps.length - 1;
                    final circle = AnimatedContainer(
                      duration: const Duration(milliseconds: 300),
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: active
                            ? AppColors.primary
                            : context.appColors.surfaceAlt,
                        border: Border.all(
                          color: active
                              ? AppColors.primary
                              : context.appColors.border,
                          width: 2,
                        ),
                      ),
                      child: Center(
                        child: completed
                            ? const Icon(
                                Icons.check_rounded,
                                size: 18,
                                color: Colors.white,
                              )
                            : Text(
                                '${i + 1}',
                                style: TextStyle(
                                  fontWeight: FontWeight.w800,
                                  color: active
                                      ? Colors.white
                                      : context.appColors.textTertiary,
                                ),
                              ),
                      ),
                    );
                    if (isLast) return circle;
                    return Expanded(
                      child: Row(
                        children: [
                          circle,
                          Expanded(
                            child: Container(
                              height: 2,
                              margin: const EdgeInsets.symmetric(horizontal: 4),
                              color: i < _step
                                  ? AppColors.primary
                                  : context.appColors.border,
                            ),
                          ),
                        ],
                      ),
                    );
                  }),
                ),
                const SizedBox(height: AppSpacing.md),
                Text(
                  _steps[_step],
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    color: context.appColors.textPrimary,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.5,
                  ),
                ),
              ],
            ),
          ),

          // Contenido del paso actual
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 300),
                child: KeyedSubtree(
                  key: ValueKey(_step),
                  child: _buildStepContent(),
                ),
              ),
            ),
          ),

          // Botones de control
          Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: SafeArea(
              top: false,
              child: Row(
                children: [
                  if (_step > 0)
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _loading ? null : _back,
                        style: OutlinedButton.styleFrom(
                          foregroundColor: context.appColors.textSecondary,
                          side: BorderSide(color: context.appColors.border),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        icon: const Icon(Icons.arrow_back_rounded, size: 20),
                        label: const Text('Atrás'),
                      ),
                    ),
                  if (_step > 0) const SizedBox(width: AppSpacing.md),
                  Expanded(
                    flex: 2,
                    child: ElevatedButton(
                      onPressed: _loading ? null : _next,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _step == 3
                            ? AppColors.emergency
                            : AppColors.primary,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      child: _loading
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                                color: Colors.white,
                              ),
                            )
                          : Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  _step == 3
                                      ? 'ENVIAR EMERGENCIA'
                                      : 'Siguiente',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 14,
                                  ),
                                ),
                                const SizedBox(width: AppSpacing.sm),
                                Icon(
                                  _step == 3
                                      ? Icons.send_rounded
                                      : Icons.arrow_forward_rounded,
                                  size: 18,
                                ),
                              ],
                            ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStepContent() {
    switch (_step) {
      case 0:
        return _buildVehicleStep();
      case 1:
        return _buildLocationStep();
      case 2:
        return _buildEvidenceStep();
      case 3:
        return _buildConfirmStep();
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _buildVehicleStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Selecciona el vehículo afectado',
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
            color: context.appColors.textPrimary,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.5,
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        if (_vehicles.isEmpty)
          Container(
            padding: const EdgeInsets.all(AppSpacing.lg),
            decoration: BoxDecoration(
              color: context.appColors.surface,
              borderRadius: BorderRadius.circular(24),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 20,
                  spreadRadius: 2,
                  offset: const Offset(0, 4),
                ),
              ],
              border: Border.all(
                color: AppColors.warning.withValues(alpha: 0.3),
                width: 1,
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: AppColors.warning.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.warning_amber_rounded,
                    color: AppColors.warning,
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Text(
                    'No tienes vehículos registrados.\nVe a "Mis vehículos" para agregar uno.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: context.appColors.textPrimary,
                    ),
                  ),
                ),
              ],
            ),
          )
        else
          ..._vehicles.asMap().entries.map((entry) {
            final i = entry.key;
            final v = entry.value;
            final selected = _selectedVehicle?.id == v.id;
            return Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.md),
              child: GestureDetector(
                onTap: () => setState(() => _selectedVehicle = v),
                child: Container(
                  decoration: BoxDecoration(
                    color: context.appColors.surface,
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(
                          alpha: selected ? 0.06 : 0.04,
                        ),
                        blurRadius: 20,
                        spreadRadius: 2,
                        offset: const Offset(0, 4),
                      ),
                    ],
                    border: Border.all(
                      color: selected
                          ? AppColors.primary
                          : context.appColors.border,
                      width: selected ? 2 : 1,
                    ),
                  ),
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: Row(
                    children: [
                      Container(
                        width: 50,
                        height: 50,
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: const Icon(
                          Icons.directions_car_rounded,
                          color: AppColors.primary,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${v.brand} ${v.model}',
                              style: Theme.of(context).textTheme.titleSmall
                                  ?.copyWith(
                                    color: context.appColors.textPrimary,
                                    fontWeight: FontWeight.w700,
                                  ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              '${v.year} · ${v.color} · ${v.plateNumber}',
                              style: Theme.of(context).textTheme.bodySmall
                                  ?.copyWith(
                                    color: context.appColors.textTertiary,
                                  ),
                            ),
                          ],
                        ),
                      ),
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        width: 24,
                        height: 24,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: selected
                              ? AppColors.primary
                              : Colors.transparent,
                          border: Border.all(
                            color: selected
                                ? AppColors.primary
                                : context.appColors.border,
                            width: 2,
                          ),
                        ),
                        child: selected
                            ? const Icon(
                                Icons.check_rounded,
                                size: 14,
                                color: Colors.white,
                              )
                            : null,
                      ),
                    ],
                  ),
                ),
              ).animate(delay: (60 * i).ms).fadeIn().moveY(begin: 12, end: 0),
            );
          }),
      ],
    );
  }

  Widget _buildLocationStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Necesitamos tu ubicacion',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          'Asi el taller mas cercano podra llegar rapido a ti.',
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        const SizedBox(height: AppSpacing.lg),
        ElevatedButton.icon(
          onPressed: _locating ? null : _getLocation,
          style: ElevatedButton.styleFrom(backgroundColor: AppColors.info),
          icon: _locating
              ? const SizedBox(
                  height: 18,
                  width: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    color: Colors.white,
                  ),
                )
              : const Icon(Icons.my_location_rounded),
          label: Text(_locating ? 'Obteniendo...' : 'Obtener mi ubicacion'),
        ),
        if (_position != null) ...[
          const SizedBox(height: AppSpacing.lg),
          AppCard(
            color: AppColors.success.withValues(alpha: 0.08),
            border: Border.all(color: AppColors.success.withValues(alpha: 0.3)),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: AppColors.success.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(AppRadius.md),
                  ),
                  child: const Icon(
                    Icons.check_circle_rounded,
                    color: AppColors.success,
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Ubicacion obtenida',
                        style: Theme.of(context).textTheme.titleSmall,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${_position!.latitude.toStringAsFixed(6)}, ${_position!.longitude.toStringAsFixed(6)}',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: context.appColors.textTertiary,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ).animate().fadeIn().moveY(begin: 12, end: 0),
          const SizedBox(height: AppSpacing.md),
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.lg),
            child: SizedBox(
              height: 180,
              child: GoogleMap(
                initialCameraPosition: CameraPosition(
                  target: LatLng(_position!.latitude, _position!.longitude),
                  zoom: 15,
                ),
                markers: {
                  Marker(
                    markerId: const MarkerId('me'),
                    position: LatLng(_position!.latitude, _position!.longitude),
                    infoWindow: const InfoWindow(title: 'Tu ubicación'),
                  ),
                },
                myLocationEnabled: false,
                zoomControlsEnabled: false,
                mapToolbarEnabled: false,
                liteModeEnabled: true,
              ),
            ),
          ).animate().fadeIn().moveY(begin: 12, end: 0),
        ],
      ],
    );
  }

  Widget _buildEvidenceStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Agrega evidencias',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          'Las fotos y la descripcion ayudan a la IA a diagnosticar mejor.',
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        const SizedBox(height: AppSpacing.lg),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => _pickImage(ImageSource.camera),
                icon: const Icon(Icons.camera_alt_rounded),
                label: const Text('Camara'),
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => _pickImage(ImageSource.gallery),
                icon: const Icon(Icons.photo_library_rounded),
                label: const Text('Galeria'),
              ),
            ),
          ],
        ),
        if (_images.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          SizedBox(
            height: 100,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: _images.length,
              separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
              itemBuilder: (_, i) => Stack(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    child: Image.file(
                      _images[i],
                      height: 100,
                      width: 100,
                      fit: BoxFit.cover,
                    ),
                  ),
                  Positioned(
                    top: 4,
                    right: 4,
                    child: GestureDetector(
                      onTap: () => setState(() => _images.removeAt(i)),
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: AppColors.danger,
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.2),
                              blurRadius: 4,
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.close_rounded,
                          size: 14,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
        const SizedBox(height: AppSpacing.lg),

        // Audio recording section
        Text(
          'Graba un audio describiendo el problema',
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
            color: context.appColors.textSecondary,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        if (_audioFile == null)
          AppCard(
            color: _recording
                ? AppColors.emergency.withValues(alpha: 0.08)
                : context.appColors.surfaceAlt,
            border: Border.all(
              color: _recording
                  ? AppColors.emergency.withValues(alpha: 0.4)
                  : context.appColors.border,
            ),
            child: Column(
              children: [
                if (_recording)
                  Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                              width: 10,
                              height: 10,
                              decoration: const BoxDecoration(
                                shape: BoxShape.circle,
                                color: AppColors.emergency,
                              ),
                            )
                            .animate(onPlay: (c) => c.repeat(reverse: true))
                            .fadeOut(duration: 600.ms),
                        const SizedBox(width: AppSpacing.sm),
                        Text(
                          'Grabando... ${_formatDuration(_recordDuration)}',
                          style: const TextStyle(
                            color: AppColors.emergency,
                            fontWeight: FontWeight.w700,
                            fontSize: 16,
                          ),
                        ),
                      ],
                    ),
                  ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    GestureDetector(
                      onTap: _toggleRecording,
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        width: 64,
                        height: 64,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: _recording
                              ? AppColors.emergency
                              : AppColors.accent,
                          boxShadow: [
                            BoxShadow(
                              color:
                                  (_recording
                                          ? AppColors.emergency
                                          : AppColors.accent)
                                      .withValues(alpha: 0.3),
                              blurRadius: 12,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Icon(
                          _recording ? Icons.stop_rounded : Icons.mic_rounded,
                          color: Colors.white,
                          size: 32,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  _recording ? 'Toca para detener' : 'Toca para grabar audio',
                  style: TextStyle(
                    fontSize: 12,
                    color: _recording
                        ? AppColors.emergency
                        : context.appColors.textTertiary,
                  ),
                ),
              ],
            ),
          )
        else
          AppCard(
            color: AppColors.success.withValues(alpha: 0.08),
            border: Border.all(color: AppColors.success.withValues(alpha: 0.3)),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: AppColors.success.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(AppRadius.md),
                  ),
                  child: const Icon(
                    Icons.audiotrack_rounded,
                    color: AppColors.success,
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Audio grabado',
                        style: Theme.of(context).textTheme.titleSmall,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Listo para enviar',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: context.appColors.textTertiary,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: _deleteAudio,
                  icon: const Icon(
                    Icons.delete_outline_rounded,
                    color: AppColors.danger,
                  ),
                ),
              ],
            ),
          ),

        const SizedBox(height: AppSpacing.lg),
        TextField(
          controller: _descCtrl,
          maxLines: 4,
          decoration: const InputDecoration(
            labelText: 'Describe el problema (opcional)',
            hintText: 'Ej: Mi auto no enciende, sale humo del motor...',
            alignLabelWithHint: true,
            prefixIcon: Padding(
              padding: EdgeInsets.only(bottom: 60),
              child: Icon(Icons.edit_note_rounded),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildConfirmStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Revisa antes de enviar',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: AppSpacing.md),
        AppCard(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.sm),
                    decoration: BoxDecoration(
                      color: AppColors.emergency.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(AppRadius.md),
                    ),
                    child: const Icon(
                      Icons.warning_amber_rounded,
                      color: AppColors.emergency,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Text(
                    'Resumen de la emergencia',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                ],
              ),
              const Divider(height: AppSpacing.lg + AppSpacing.sm),
              if (_selectedVehicle != null)
                _infoRow(
                  Icons.directions_car_rounded,
                  'Vehiculo',
                  '${_selectedVehicle!.brand} ${_selectedVehicle!.model} · ${_selectedVehicle!.plateNumber}',
                ),
              if (_position != null)
                _infoRow(
                  Icons.location_on_rounded,
                  'Ubicacion',
                  '${_position!.latitude.toStringAsFixed(4)}, ${_position!.longitude.toStringAsFixed(4)}',
                ),
              _infoRow(
                Icons.photo_library_rounded,
                'Fotos',
                '${_images.length}',
              ),
              _infoRow(
                Icons.mic_rounded,
                'Audio',
                _audioFile != null ? 'Grabado' : 'No',
              ),
              if (_descCtrl.text.isNotEmpty)
                _infoRow(
                  Icons.edit_note_rounded,
                  'Descripcion',
                  _descCtrl.text,
                ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        AppCard(
          color: AppColors.info.withValues(alpha: 0.08),
          border: Border.all(color: AppColors.info.withValues(alpha: 0.25)),
          child: Row(
            children: [
              const Icon(Icons.psychology_rounded, color: AppColors.info),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  'La IA analizara tu reporte y asignara un taller automaticamente.',
                  style: TextStyle(
                    color: context.appColors.textPrimary,
                    fontSize: 13,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _infoRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: context.appColors.textTertiary),
          const SizedBox(width: AppSpacing.sm),
          SizedBox(
            width: 92,
            child: Text(
              label,
              style: TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 13,
                color: context.appColors.textSecondary,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                fontSize: 14,
                color: context.appColors.textPrimary,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
