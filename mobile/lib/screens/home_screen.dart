import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../services/offline/connectivity_service.dart';
import '../services/offline/sync_service.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';
import '../widgets/empty_state.dart';
import '../widgets/loading_skeleton.dart';
import '../widgets/status_chip.dart';
import 'new_emergency_screen.dart';
import 'incident_detail_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<Incident> _incidents = [];
  bool _loading = true;
  int _pendingSync = 0;
  bool _offline = false;
  StreamSubscription? _syncSub;
  StreamSubscription<bool>? _connSub;

  @override
  void initState() {
    super.initState();
    _loadData();
    _refreshSyncState();
    _offline = !ConnectivityService.instance.isOnline;
    _syncSub = SyncService.instance.onChange.listen((_) {
      _refreshSyncState();
      _loadData();
    });
    _connSub = ConnectivityService.instance.onStatusChange.listen((online) {
      if (mounted) setState(() => _offline = !online);
    });
  }

  @override
  void dispose() {
    _syncSub?.cancel();
    _connSub?.cancel();
    super.dispose();
  }

  Future<void> _refreshSyncState() async {
    final pending = await SyncService.instance.pendingCount();
    if (mounted) setState(() => _pendingSync = pending);
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      final incidents = await ApiService.getIncidents();
      if (!mounted) return;
      setState(() => _incidents = incidents);
    } catch (e) {
      if (mounted) {
        // Offline: no es error critico, puede haber datos en cache/outbox.
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Widget _buildSyncBanner() {
    if (!_offline && _pendingSync == 0) return const SizedBox.shrink();
    final color = _offline ? AppColors.warning : AppColors.primary;
    final icon = _offline ? Icons.cloud_off_rounded : Icons.sync_rounded;
    final text = _offline
        ? (_pendingSync > 0
            ? 'Sin conexion · $_pendingSync emergencia(s) pendiente(s) de sincronizar'
            : 'Sin conexion')
        : 'Sincronizando $_pendingSync emergencia(s) pendiente(s)...';
    return Container(
      width: double.infinity,
      color: color.withValues(alpha: 0.12),
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.sm),
      child: Row(
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(text,
                style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 12)),
          ),
          if (!_offline && _pendingSync > 0)
            const SizedBox(
              width: 14, height: 14,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.appColors.background,
      body: Column(
        children: [
          SafeArea(bottom: false, child: _buildSyncBanner()),
          Expanded(child: _buildBody(context)),
        ],
      ),
    );
  }

  Widget _buildBody(BuildContext context) {
    return NestedScrollView(
        headerSliverBuilder: (context, innerBoxIsScrolled) => [
          SliverAppBar(
            expandedHeight: 120,
            pinned: false,
            floating: false,
            elevation: 0,
            backgroundColor: context.appColors.background,
            foregroundColor: context.appColors.textPrimary,
            flexibleSpace: FlexibleSpaceBar(
              background: SafeArea(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.lg,
                    AppSpacing.md,
                    AppSpacing.lg,
                    AppSpacing.lg,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      Text(
                        'Bienvenido 👋',
                        style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                          color: context.appColors.textSecondary,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        'RescateYa',
                        style: Theme.of(context).textTheme.displaySmall
                            ?.copyWith(
                              color: context.appColors.textPrimary,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.6,
                            ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            actions: const [SizedBox(width: AppSpacing.xs)],
          ),
        ],
        body: RefreshIndicator(
          onRefresh: _loadData,
          color: AppColors.primary,
          child: _loading
              ? const IncidentListSkeleton()
              : _incidents.isEmpty
              ? ListView(
                  // ListView para que el RefreshIndicator funcione
                  children: [
                    SizedBox(
                      height: MediaQuery.of(context).size.height * 0.55,
                      child: EmptyState(
                        icon: Icons.check_circle_outline_rounded,
                        title: 'Todo en orden',
                        subtitle:
                            'No tienes solicitudes activas.\nPresiona SOS para reportar una emergencia.',
                        actionLabel: 'Reportar emergencia',
                        onAction: _goToNewEmergency,
                      ),
                    ),
                  ],
                )
              : _buildIncidentList(),
        ),
    );
  }

  Future<void> _goToNewEmergency() async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const NewEmergencyScreen()),
    );
    if (result == true) _loadData();
  }

  Widget _buildIncidentList() {
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.lg,
        AppSpacing.lg,
        100,
      ),
      itemCount: _incidents.length + 1,
      itemBuilder: (context, index) {
        if (index == 0) {
          return Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.lg),
            child: Row(
              children: [
                Text(
                  'Tus Solicitudes',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    color: context.appColors.textPrimary,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: Text(
                    '${_incidents.length}',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          );
        }
        final inc = _incidents[index - 1];
        return _IncidentCard(
              incident: inc,
              onTap: () async {
                await Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => IncidentDetailScreen(incidentId: inc.id),
                  ),
                );
                _loadData();
              },
            )
            .animate(delay: (60 * (index - 1)).ms)
            .fadeIn(duration: 400.ms)
            .moveY(begin: 16, end: 0);
      },
    );
  }
}

class _IncidentCard extends StatelessWidget {
  final Incident incident;
  final VoidCallback onTap;

  const _IncidentCard({required this.incident, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: AppSpacing.lg),
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
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                spacing: AppSpacing.xs,
                runSpacing: AppSpacing.xs,
                children: [
                  StatusChip.priority(incident.priority),
                  StatusChip.category(incident.category),
                  StatusChip.status(incident.status),
                ],
              ),
              const SizedBox(height: AppSpacing.lg),
              Text(
                incident.aiSummary ?? incident.description ?? 'Sin descripción',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: context.appColors.textPrimary,
                  height: 1.5,
                  fontWeight: FontWeight.w500,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: AppSpacing.md),
              Container(height: 1, color: context.appColors.border),
              const SizedBox(height: AppSpacing.md),
              Row(
                children: [
                  Icon(
                    Icons.location_on_rounded,
                    size: 14,
                    color: context.appColors.textTertiary,
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      incident.address ??
                          'Lat: ${incident.latitude.toStringAsFixed(4)}',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: context.appColors.textTertiary,
                        fontSize: 12,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (incident.estimatedArrival != null) ...[
                    const SizedBox(width: AppSpacing.sm),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.info.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.timer_rounded,
                            size: 12,
                            color: AppColors.info,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            '${incident.estimatedArrival} min',
                            style: const TextStyle(
                              fontSize: 11,
                              color: AppColors.info,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
