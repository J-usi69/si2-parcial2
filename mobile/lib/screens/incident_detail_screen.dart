import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';
import '../widgets/app_snackbar.dart';
import '../widgets/empty_state.dart';
import '../widgets/status_chip.dart';
import 'chat_screen.dart';

class IncidentDetailScreen extends StatefulWidget {
  final int incidentId;
  const IncidentDetailScreen({super.key, required this.incidentId});

  @override
  State<IncidentDetailScreen> createState() => _IncidentDetailScreenState();
}

class _IncidentDetailScreenState extends State<IncidentDetailScreen> {
  Incident? _incident;
  bool _loading = true;
  bool _paying = false;
  bool _acceptingOffer = false;
  Review? _review;
  List<ServiceOffer> _offers = [];
  List<PaymentCard> _cards = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final inc = await ApiService.getIncident(widget.incidentId);
      if (mounted) setState(() => _incident = inc);
      if (inc.status == 'pending') {
        final offers = await ApiService.getIncidentOffers(inc.id);
        if (mounted) setState(() => _offers = offers);
      }
      final cards = await ApiService.getPaymentCards();
      if (mounted) setState(() => _cards = cards);
      // Load review if completed
      if (inc.status == 'completed') {
        final rev = await ApiService.getReviewForIncident(inc.id);
        if (mounted) setState(() => _review = rev);
      }
    } catch (_) {
      if (mounted) {
        AppSnackBar.error(context, 'Error al cargar incidente');
      }
    }
    if (mounted) setState(() => _loading = false);
  }

  static const _statusLabels = {
    'pending': 'Pendiente',
    'assigned': 'Taller asignado',
    'in_progress': 'En proceso',
    'completed': 'Completado',
    'cancelled': 'Cancelado',
  };

  static const _categoryLabels = {
    'battery': 'Problema de bateria',
    'tire': 'Pinchazo de llanta',
    'crash': 'Accidente / choque',
    'engine': 'Problema de motor',
    'keys': 'Problema de llaves',
    'other': 'Otro',
    'uncertain': 'Sin clasificar',
  };

  IconData _statusIcon(String status) {
    switch (status) {
      case 'completed':
        return Icons.check_circle_rounded;
      case 'in_progress':
        return Icons.build_circle_rounded;
      case 'assigned':
        return Icons.handshake_rounded;
      case 'cancelled':
        return Icons.cancel_rounded;
      default:
        return Icons.schedule_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.appColors.background,
      appBar: AppBar(
        title: Text('Incidente #${widget.incidentId}'),
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
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            )
          : _incident == null
          ? const EmptyState(
              icon: Icons.error_outline_rounded,
              title: 'Incidente no encontrado',
              subtitle: 'No pudimos obtener la información solicitada.',
            )
          : RefreshIndicator(
              onRefresh: _load,
              color: AppColors.primary,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(AppSpacing.lg),
                children: [
                  _buildStatusHero(),
                  const SizedBox(height: AppSpacing.lg),
                  _buildAICard(),
                  if (_incident!.status == 'pending') ...[
                    const SizedBox(height: AppSpacing.lg),
                    _buildOffersCard(),
                  ],
                  const SizedBox(height: AppSpacing.lg),
                  _buildInfoCard(),
                  const SizedBox(height: AppSpacing.lg),
                  _buildMapCard(),
                  if (_incident!.evidences.isNotEmpty) ...[
                    const SizedBox(height: AppSpacing.lg),
                    _buildEvidencesCard(),
                  ],
                  if (_incident!.finalCost != null) ...[
                    const SizedBox(height: AppSpacing.lg),
                    _buildPaymentCard(),
                  ],
                  if (_incident!.status == 'completed') ...[
                    const SizedBox(height: AppSpacing.lg),
                    _buildReviewCard(),
                  ],
                  if (_incident!.status != 'pending' &&
                      _incident!.status != 'cancelled') ...[
                    const SizedBox(height: AppSpacing.lg),
                    _buildChatButton(),
                  ],
                  const SizedBox(height: AppSpacing.lg),
                ],
              ),
            ),
    );
  }

  Widget _buildStatusHero() {
    final inc = _incident!;
    final color = AppColors.getStatusColor(inc.status);
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [color, color.withValues(alpha: 0.75)],
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 20,
            spreadRadius: 2,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.all(AppSpacing.lg + 4),
      child: Column(
        children: [
          Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withValues(alpha: 0.2),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.4),
                    width: 2,
                  ),
                ),
                child: Icon(
                  _statusIcon(inc.status),
                  size: 40,
                  color: Colors.white,
                ),
              )
              .animate()
              .scale(
                duration: 500.ms,
                curve: Curves.easeOutBack,
                begin: const Offset(0.5, 0.5),
              )
              .fadeIn(),
          const SizedBox(height: AppSpacing.lg),
          Text(
            _statusLabels[inc.status] ?? inc.status,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.5,
            ),
          ),
          if (inc.estimatedArrival != null) ...[
            const SizedBox(height: AppSpacing.md),
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md,
                vertical: 7,
              ),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.white.withValues(alpha: 0.3)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.timer_rounded,
                    size: 16,
                    color: Colors.white,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    'ETA ${inc.estimatedArrival} min',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    ).animate().fadeIn(duration: 400.ms).moveY(begin: 16, end: 0);
  }

  Widget _buildAICard() {
    final inc = _incident!;
    return Container(
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
      ),
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(AppSpacing.sm),
                decoration: BoxDecoration(
                  color: AppColors.info.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.auto_awesome_rounded,
                  color: AppColors.info,
                  size: 18,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(
                'Análisis de IA',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  color: context.appColors.textPrimary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              StatusChip.priority(inc.priority),
              StatusChip.category(inc.category),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          _detailRow(
            'Categoría',
            _categoryLabels[inc.category] ?? inc.category,
          ),
          if (inc.aiSummary != null) _detailRow('Resumen', inc.aiSummary!),
          if (inc.aiDiagnosis != null)
            _detailRow('Diagnóstico', inc.aiDiagnosis!),
        ],
      ),
    ).animate(delay: 100.ms).fadeIn().moveY(begin: 16, end: 0);
  }

  Widget _buildInfoCard() {
    final inc = _incident!;
    return Container(
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
      ),
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(AppSpacing.sm),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.info_outline_rounded,
                  color: AppColors.primary,
                  size: 18,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(
                'Información',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  color: context.appColors.textPrimary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          _detailRow(
            'Ubicación',
            inc.address ??
                '${inc.latitude.toStringAsFixed(4)}, ${inc.longitude.toStringAsFixed(4)}',
          ),
          if (inc.workshopName != null) _detailRow('Taller', inc.workshopName!),
          if (inc.technicianName != null)
            _detailRow('Técnico', inc.technicianName!),
          if (inc.description != null)
            _detailRow('Descripción', inc.description!),
        ],
      ),
    ).animate(delay: 200.ms).fadeIn().moveY(begin: 16, end: 0);
  }

  Widget _buildOffersCard() {
    final colors = context.appColors;
    final recommendedOffers = _offers
        .where((offer) => offer.isRecommended)
        .toList();
    final recommended = recommendedOffers.isNotEmpty
        ? recommendedOffers.first
        : null;
    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 20,
            spreadRadius: 2,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(AppSpacing.sm),
                decoration: BoxDecoration(
                  color: AppColors.accent.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.local_offer_rounded,
                  color: AppColors.accent,
                  size: 18,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  'Ofertas de talleres',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              if (_acceptingOffer)
                const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          if (recommended != null)
            Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: AppColors.info.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(18),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.auto_awesome_rounded, color: AppColors.info),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      recommended.recommendationReason ??
                          'IA recomienda esta oferta por precio, distancia y calificacion.',
                      style: TextStyle(
                        color: colors.textSecondary,
                        height: 1.4,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: AppSpacing.md),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _acceptingOffer ? null : _autoAcceptOffer,
              icon: const Icon(Icons.auto_awesome_rounded),
              label: const Text('Aceptar recomendacion de IA'),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          if (_offers.isEmpty)
            Text(
              'Buscando ofertas de talleres cercanos...',
              style: TextStyle(color: colors.textTertiary),
            )
          else
            ..._offers.map(
              (offer) => _OfferTile(
                offer: offer,
                accepting: _acceptingOffer,
                onAccept: () => _acceptOffer(offer),
              ),
            ),
        ],
      ),
    ).animate(delay: 150.ms).fadeIn().moveY(begin: 16, end: 0);
  }

  Widget _buildMapCard() {
    final inc = _incident!;
    final pos = LatLng(inc.latitude, inc.longitude);
    return Container(
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
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(AppSpacing.sm),
                  decoration: BoxDecoration(
                    color: AppColors.warning.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.map_rounded,
                    color: AppColors.warning,
                    size: 18,
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  'Ubicación',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: context.appColors.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          SizedBox(
            height: 200,
            child: GoogleMap(
              initialCameraPosition: CameraPosition(target: pos, zoom: 15),
              markers: {
                Marker(
                  markerId: const MarkerId('incident'),
                  position: pos,
                  infoWindow: InfoWindow(
                    title: 'Incidente #${inc.id}',
                    snippet: inc.address ?? 'Ubicación del incidente',
                  ),
                ),
              },
              myLocationEnabled: false,
              zoomControlsEnabled: false,
              mapToolbarEnabled: false,
              liteModeEnabled: true,
            ),
          ),
        ],
      ),
    ).animate(delay: 250.ms).fadeIn().moveY(begin: 16, end: 0);
  }

  Widget _buildEvidencesCard() {
    return Container(
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
      ),
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(AppSpacing.sm),
                decoration: BoxDecoration(
                  color: AppColors.accent.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.collections_rounded,
                  color: AppColors.accent,
                  size: 18,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(
                'Evidencias',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  color: context.appColors.textPrimary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          ..._incident!.evidences.map((ev) {
            if (ev.type == 'image' && ev.fileUrl != null) {
              return Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.md),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(20),
                  child: Image.network(
                    'http://10.0.2.2:8000${ev.fileUrl}',
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => Container(
                      height: 120,
                      decoration: BoxDecoration(
                        color: context.appColors.surfaceAlt,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Center(
                        child: Icon(
                          Icons.broken_image_rounded,
                          size: 48,
                          color: context.appColors.textTertiary,
                        ),
                      ),
                    ),
                  ),
                ),
              );
            } else if (ev.type == 'audio') {
              return Container(
                margin: const EdgeInsets.only(bottom: AppSpacing.md),
                padding: const EdgeInsets.all(AppSpacing.md),
                decoration: BoxDecoration(
                  color: context.appColors.surfaceAlt,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: AppColors.accent.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(
                        Icons.audiotrack_rounded,
                        color: AppColors.accent,
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Audio',
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 13,
                              color: context.appColors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            ev.transcription != null
                                ? 'Transcripción: ${ev.transcription}'
                                : 'Procesando...',
                            style: TextStyle(
                              fontSize: 12,
                              color: context.appColors.textTertiary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            } else if (ev.type == 'text') {
              return Container(
                margin: const EdgeInsets.only(bottom: AppSpacing.md),
                padding: const EdgeInsets.all(AppSpacing.md),
                decoration: BoxDecoration(
                  color: context.appColors.surfaceAlt,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.text_snippet_rounded,
                      color: AppColors.info,
                      size: 20,
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: Text(
                        ev.content ?? '',
                        style: TextStyle(
                          fontSize: 13,
                          color: context.appColors.textPrimary,
                        ),
                      ),
                    ),
                  ],
                ),
              );
            }
            return const SizedBox.shrink();
          }),
        ],
      ),
    ).animate(delay: 300.ms).fadeIn().moveY(begin: 16, end: 0);
  }

  Widget _buildPaymentCard() {
    final inc = _incident!;
    final isPaid = inc.status == 'completed';
    return Container(
      decoration: BoxDecoration(
        gradient: AppColors.successGradient,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 20,
            spreadRadius: 2,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.all(AppSpacing.lg + 4),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(AppSpacing.sm),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(
              Icons.payments_rounded,
              size: 32,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            isPaid ? 'Pago registrado' : 'Total a pagar',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Colors.white.withValues(alpha: 0.9),
              fontSize: 13,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Bs. ${inc.finalCost!.toStringAsFixed(2)}',
            style: Theme.of(context).textTheme.displayMedium?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.8,
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          if (isPaid)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white.withValues(alpha: 0.28)),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.verified_rounded, color: Colors.white, size: 18),
                  SizedBox(width: AppSpacing.sm),
                  Text(
                    'Servicio pagado',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            )
          else
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _paying ? null : _showPaymentOptions,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: AppColors.success,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                icon: _paying
                    ? const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.5,
                          color: AppColors.success,
                        ),
                      )
                    : const Icon(Icons.check_rounded, size: 18),
                label: Text(
                  _paying ? 'Procesando...' : 'Elegir forma de pago',
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
              ),
            ),
        ],
      ),
    ).animate(delay: 400.ms).fadeIn().moveY(begin: 16, end: 0);
  }

  Widget _buildReviewCard() {
    if (_review != null) {
      // Show existing review
      return Container(
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
        ),
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(AppSpacing.sm),
                  decoration: BoxDecoration(
                    color: AppColors.warning.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.star_rounded,
                    color: AppColors.warning,
                    size: 18,
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  'Tu calificación',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: context.appColors.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            Row(
              children: List.generate(
                5,
                (i) => Icon(
                  i < _review!.rating
                      ? Icons.star_rounded
                      : Icons.star_border_rounded,
                  color: AppColors.warning,
                  size: 28,
                ),
              ),
            ),
            if (_review!.comment != null && _review!.comment!.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                _review!.comment!,
                style: TextStyle(
                  fontSize: 13,
                  color: context.appColors.textSecondary,
                ),
              ),
            ],
          ],
        ),
      ).animate(delay: 450.ms).fadeIn().moveY(begin: 16, end: 0);
    }

    // Show "Rate" button
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.warning, Color(0xFFF59E0B)],
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 20,
            spreadRadius: 2,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(24),
        child: InkWell(
          borderRadius: BorderRadius.circular(24),
          onTap: _showReviewDialog,
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(AppSpacing.sm),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.star_rounded,
                    color: Colors.white,
                    size: 22,
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Califica al taller',
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                      Text(
                        'Tu opinión ayuda a mejorar el servicio',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.white.withValues(alpha: 0.85),
                        ),
                      ),
                    ],
                  ),
                ),
                Icon(
                  Icons.chevron_right_rounded,
                  color: Colors.white.withValues(alpha: 0.7),
                ),
              ],
            ),
          ),
        ),
      ),
    ).animate(delay: 450.ms).fadeIn().moveY(begin: 16, end: 0);
  }

  void _showReviewDialog() {
    int selectedRating = 0;
    final commentCtrl = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: context.appColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
          padding: EdgeInsets.fromLTRB(
            AppSpacing.lg,
            AppSpacing.lg,
            AppSpacing.lg,
            MediaQuery.of(ctx).viewInsets.bottom + AppSpacing.lg,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: context.appColors.textTertiary.withValues(alpha: 0.3),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              Text(
                '¿Cómo fue el servicio?',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w800,
                  color: context.appColors.textPrimary,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                'Califica al taller que atendió tu emergencia',
                style: TextStyle(
                  color: context.appColors.textTertiary,
                  fontSize: 13,
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(
                  5,
                  (i) => GestureDetector(
                    onTap: () => setModalState(() => selectedRating = i + 1),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: Icon(
                        i < selectedRating
                            ? Icons.star_rounded
                            : Icons.star_border_rounded,
                        color: AppColors.warning,
                        size: 44,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              TextField(
                controller: commentCtrl,
                maxLines: 3,
                decoration: InputDecoration(
                  hintText: 'Deja un comentario (opcional)',
                  filled: true,
                  fillColor: context.appColors.surfaceAlt,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: selectedRating == 0
                      ? null
                      : () async {
                          final navigator = Navigator.of(ctx);
                          final messenger = ScaffoldMessenger.of(ctx);
                          try {
                            final review = await ApiService.createReview(
                              incidentId: _incident!.id,
                              rating: selectedRating,
                              comment: commentCtrl.text.isNotEmpty
                                  ? commentCtrl.text
                                  : null,
                            );
                            if (mounted) {
                              setState(() => _review = review);
                            }
                            navigator.pop();
                            AppSnackBar.showOn(
                              messenger,
                              '¡Gracias por tu calificación!',
                              isError: false,
                            );
                          } catch (e) {
                            navigator.pop();
                            AppSnackBar.showOn(
                              messenger,
                              e.toString().replaceAll('Exception: ', ''),
                              isError: true,
                            );
                          }
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  child: const Text(
                    'Enviar calificación',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildChatButton() {
    return Container(
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
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(24),
        child: InkWell(
          borderRadius: BorderRadius.circular(24),
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => ChatScreen(incidentId: _incident!.id),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(AppSpacing.sm),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.chat_rounded,
                    color: AppColors.primary,
                    size: 22,
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Chat con el taller',
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: context.appColors.textPrimary,
                        ),
                      ),
                      Text(
                        'Envía mensajes al taller asignado',
                        style: TextStyle(
                          fontSize: 12,
                          color: context.appColors.textTertiary,
                        ),
                      ),
                    ],
                  ),
                ),
                Icon(
                  Icons.chevron_right_rounded,
                  color: context.appColors.textTertiary,
                ),
              ],
            ),
          ),
        ),
      ),
    ).animate(delay: 350.ms).fadeIn().moveY(begin: 16, end: 0);
  }

  Future<void> _payWithMethod(String method, {int? cardId}) async {
    if (_incident?.finalCost == null) return;
    setState(() => _paying = true);
    try {
      await ApiService.createPayment(
        incidentId: _incident!.id,
        amount: _incident!.finalCost!,
        method: method,
        cardId: cardId,
      );
      final updated = await ApiService.getIncident(_incident!.id);
      if (mounted) {
        setState(() => _incident = updated);
        AppSnackBar.success(
          context,
          method == 'cash'
              ? 'Pago en efectivo registrado'
              : 'Pago con tarjeta realizado',
        );
      }
    } catch (e) {
      if (mounted) {
        AppSnackBar.error(context, e.toString().replaceAll('Exception: ', ''));
      }
    } finally {
      if (mounted) setState(() => _paying = false);
    }
  }

  Future<void> _acceptOffer(ServiceOffer offer) async {
    setState(() => _acceptingOffer = true);
    try {
      await ApiService.acceptOffer(offer.id);
      await _load();
      if (mounted) {
        AppSnackBar.success(context, 'Oferta aceptada');
      }
    } catch (e) {
      if (mounted) {
        AppSnackBar.error(context, e.toString().replaceAll('Exception: ', ''));
      }
    } finally {
      if (mounted) {
        setState(() => _acceptingOffer = false);
      }
    }
  }

  Future<void> _autoAcceptOffer() async {
    if (_incident == null) return;
    setState(() => _acceptingOffer = true);
    try {
      await ApiService.autoAcceptBestOffer(_incident!.id);
      await _load();
      if (mounted) {
        AppSnackBar.success(context, 'La IA eligio la oferta mas conveniente');
      }
    } catch (e) {
      if (mounted) {
        AppSnackBar.error(context, e.toString().replaceAll('Exception: ', ''));
      }
    } finally {
      if (mounted) {
        setState(() => _acceptingOffer = false);
      }
    }
  }

  void _showPaymentOptions() {
    final defaultCards = _cards.where((card) => card.isDefault).toList();
    final defaultCard = defaultCards.isNotEmpty ? defaultCards.first : null;
    String selectedMethod = defaultCard != null ? 'card' : 'cash';
    PaymentCard? selectedCard = defaultCard;
    showModalBottomSheet(
      context: context,
      backgroundColor: context.appColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Forma de pago',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  color: context.appColors.textPrimary,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                'Selecciona el metodo y confirma el pago para finalizar el servicio.',
                style: TextStyle(color: context.appColors.textTertiary),
              ),
              const SizedBox(height: AppSpacing.md),
              if (_cards.isNotEmpty) ...[
                _PaymentOption(
                  icon: Icons.credit_card_rounded,
                  title: selectedCard == null
                      ? 'Tarjeta guardada'
                      : 'Tarjeta terminada en ${selectedCard!.last4}',
                  subtitle: selectedCard == null
                      ? 'Selecciona una tarjeta guardada'
                      : '${selectedCard!.brand} ${selectedCard!.expMonth}/${selectedCard!.expYear}',
                  selected: selectedMethod == 'card',
                  onTap: () => setModalState(() {
                    selectedMethod = 'card';
                    selectedCard ??= defaultCard ?? _cards.first;
                  }),
                ),
                if (selectedMethod == 'card') ...[
                  const SizedBox(height: AppSpacing.sm),
                  ..._cards.map(
                    (card) => _SavedCardOption(
                      card: card,
                      selected: selectedCard?.id == card.id,
                      onTap: () => setModalState(() {
                        selectedMethod = 'card';
                        selectedCard = card;
                      }),
                    ),
                  ),
                ],
              ] else
                _PaymentOption(
                  icon: Icons.credit_card_off_rounded,
                  title: 'Sin tarjetas guardadas',
                  subtitle: 'Agrega una tarjeta desde Perfil > Metodos de pago',
                  selected: false,
                  onTap: () {},
                ),
              const SizedBox(height: AppSpacing.sm),
              _PaymentOption(
                icon: Icons.payments_rounded,
                title: 'Pago en efectivo',
                subtitle: 'Confirmar pago en efectivo y finalizar el servicio',
                selected: selectedMethod == 'cash',
                onTap: () => setModalState(() {
                  selectedMethod = 'cash';
                  selectedCard = null;
                }),
              ),
              const SizedBox(height: AppSpacing.lg),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: selectedMethod == 'card' && selectedCard == null
                      ? null
                      : () {
                          Navigator.pop(ctx);
                          _payWithMethod(
                            selectedMethod,
                            cardId: selectedMethod == 'card'
                                ? selectedCard?.id
                                : null,
                          );
                        },
                  icon: const Icon(Icons.check_circle_rounded),
                  label: Text(
                    selectedMethod == 'cash'
                        ? 'Confirmar pago en efectivo'
                        : 'Confirmar pago con tarjeta',
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(
              label,
              style: TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 13,
                color: context.appColors.textTertiary,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                fontSize: 14,
                color: context.appColors.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _OfferTile extends StatelessWidget {
  final ServiceOffer offer;
  final bool accepting;
  final VoidCallback onAccept;

  const _OfferTile({
    required this.offer,
    required this.accepting,
    required this.onAccept,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: offer.isRecommended
            ? AppColors.info.withValues(alpha: 0.08)
            : colors.surfaceAlt,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: offer.isRecommended ? AppColors.info : colors.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  offer.workshopName ?? 'Taller disponible',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              if (offer.isRecommended)
                const Icon(
                  Icons.auto_awesome_rounded,
                  color: AppColors.info,
                  size: 18,
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              _OfferMetric(
                icon: Icons.payments_rounded,
                text: 'Bs. ${offer.cost.toStringAsFixed(2)}',
              ),
              _OfferMetric(
                icon: Icons.route_rounded,
                text: '${offer.distanceKm.toStringAsFixed(1)} km',
              ),
              _OfferMetric(
                icon: Icons.schedule_rounded,
                text: '${offer.estimatedArrival} min',
              ),
              _OfferMetric(
                icon: Icons.star_rounded,
                text: offer.workshopRating?.toStringAsFixed(1) ?? '-',
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Conveniencia IA: ${offer.score.toStringAsFixed(0)}/100',
            style: TextStyle(
              color: colors.textSecondary,
              fontWeight: FontWeight.w700,
            ),
          ),
          if (offer.technicianName != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              'Tecnico sugerido: ${offer.technicianName}',
              style: TextStyle(color: colors.textTertiary, fontSize: 12),
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: accepting ? null : onAccept,
              icon: const Icon(Icons.check_circle_rounded),
              label: const Text('Aceptar esta oferta'),
            ),
          ),
        ],
      ),
    );
  }
}

class _OfferMetric extends StatelessWidget {
  final IconData icon;
  final String text;

  const _OfferMetric({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: context.appColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: AppColors.primary),
          const SizedBox(width: 4),
          Text(
            text,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

class _PaymentOption extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final bool selected;
  final VoidCallback onTap;

  const _PaymentOption({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.selected = false,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected
          ? AppColors.primary.withValues(alpha: 0.10)
          : context.appColors.surfaceAlt,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(
          color: selected ? AppColors.primary : context.appColors.border,
        ),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Row(
            children: [
              Icon(
                icon,
                color: selected
                    ? AppColors.primary
                    : context.appColors.textSecondary,
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        color: context.appColors.textPrimary,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: TextStyle(
                        color: context.appColors.textTertiary,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                selected
                    ? Icons.check_circle_rounded
                    : Icons.radio_button_unchecked_rounded,
                color: selected
                    ? AppColors.primary
                    : context.appColors.textTertiary,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SavedCardOption extends StatelessWidget {
  final PaymentCard card;
  final bool selected;
  final VoidCallback onTap;

  const _SavedCardOption({
    required this.card,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xs),
      child: Material(
        color: selected
            ? AppColors.primary.withValues(alpha: 0.08)
            : context.appColors.surfaceAlt,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.sm,
            ),
            child: Row(
              children: [
                Icon(
                  selected
                      ? Icons.check_circle_rounded
                      : Icons.radio_button_unchecked_rounded,
                  color: selected
                      ? AppColors.primary
                      : context.appColors.textTertiary,
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '•••• ${card.last4}',
                        style: TextStyle(
                          color: context.appColors.textPrimary,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      Text(
                        '${card.holderName} · ${card.expMonth}/${card.expYear}',
                        style: TextStyle(
                          color: context.appColors.textTertiary,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
