import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';

import '../blocs/blocs.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';
import '../widgets/app_snackbar.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  User? _user;
  List<PaymentCard> _cards = [];
  bool _uploadingPhoto = false;

  @override
  void initState() {
    super.initState();
    _loadUser();
  }

  Future<void> _loadUser() async {
    try {
      final user = await ApiService.fetchProfile();
      final cards = user.role == 'client'
          ? await ApiService.getPaymentCards()
          : <PaymentCard>[];
      if (mounted) {
        setState(() {
          _user = user;
          _cards = cards;
        });
        context.read<AuthBloc>().add(AuthUserUpdated(user));
      }
    } catch (_) {
      final user = await ApiService.getCurrentUser();
      if (mounted) setState(() => _user = user);
    }
  }

  Future<void> _pickAndUploadPhoto() async {
    final picker = ImagePicker();
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.camera_alt_rounded),
                title: const Text('Tomar foto'),
                onTap: () => Navigator.pop(ctx, ImageSource.camera),
              ),
              ListTile(
                leading: const Icon(Icons.photo_library_rounded),
                title: const Text('Galería'),
                onTap: () => Navigator.pop(ctx, ImageSource.gallery),
              ),
            ],
          ),
        ),
      ),
    );
    if (source == null) return;

    final xfile = await picker.pickImage(
      source: source,
      maxWidth: 800,
      imageQuality: 85,
    );
    if (xfile == null) return;

    setState(() => _uploadingPhoto = true);
    try {
      final user = await ApiService.uploadProfilePhoto(File(xfile.path));
      if (mounted) {
        setState(() {
          _user = user;
          _uploadingPhoto = false;
        });
        context.read<AuthBloc>().add(AuthUserUpdated(user));
      }
    } catch (e) {
      if (mounted) {
        setState(() => _uploadingPhoto = false);
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error al subir foto: $e')));
      }
    }
  }

  Future<void> _editProfile() async {
    if (_user == null) return;
    final nameCtrl = TextEditingController(text: _user!.fullName);
    final phoneCtrl = TextEditingController(text: _user!.phone);
    final formKey = GlobalKey<FormState>();

    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        final colors = ctx.appColors;
        return AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.lg),
          ),
          title: Text(
            'Editar perfil',
            style: TextStyle(
              color: colors.textPrimary,
              fontWeight: FontWeight.w700,
            ),
          ),
          content: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: nameCtrl,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(
                    labelText: 'Nombre completo',
                    prefixIcon: Icon(Icons.person_outlined, size: 20),
                  ),
                  validator: (v) => (v == null || v.trim().isEmpty)
                      ? 'Ingresa tu nombre'
                      : null,
                ),
                const SizedBox(height: AppSpacing.md),
                TextFormField(
                  controller: phoneCtrl,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(
                    labelText: 'Teléfono',
                    prefixIcon: Icon(Icons.phone_outlined, size: 20),
                  ),
                  validator: (v) => (v == null || v.trim().length < 7)
                      ? 'Teléfono inválido'
                      : null,
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () {
                if (formKey.currentState!.validate()) Navigator.pop(ctx, true);
              },
              child: const Text('Guardar'),
            ),
          ],
        );
      },
    );

    if (result != true) {
      nameCtrl.dispose();
      phoneCtrl.dispose();
      return;
    }

    try {
      final user = await ApiService.updateProfile(
        fullName: nameCtrl.text.trim(),
        phone: phoneCtrl.text.trim(),
      );
      if (mounted) {
        setState(() => _user = user);
        context.read<AuthBloc>().add(AuthUserUpdated(user));
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Perfil actualizado')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
    nameCtrl.dispose();
    phoneCtrl.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: colors.background,
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 240,
            pinned: false,
            automaticallyImplyLeading: false,
            backgroundColor: colors.background,
            foregroundColor: colors.textPrimary,
            flexibleSpace: FlexibleSpaceBar(
              background: SafeArea(
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.lg,
                    vertical: AppSpacing.lg,
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.start,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: AppSpacing.md),
                      Row(
                        children: [
                          // Profile photo
                          GestureDetector(
                            onTap: _pickAndUploadPhoto,
                            child: Stack(
                              children: [
                                _buildAvatar(colors),
                                Positioned(
                                  right: 0,
                                  bottom: 0,
                                  child: Container(
                                    padding: const EdgeInsets.all(4),
                                    decoration: BoxDecoration(
                                      color: AppColors.primary,
                                      shape: BoxShape.circle,
                                      border: Border.all(
                                        color: colors.background,
                                        width: 2,
                                      ),
                                    ),
                                    child: const Icon(
                                      Icons.camera_alt_rounded,
                                      size: 14,
                                      color: Colors.white,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: AppSpacing.lg),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _user?.fullName ?? 'Cargando...',
                                  style: theme.textTheme.headlineSmall
                                      ?.copyWith(
                                        color: colors.textPrimary,
                                        fontWeight: FontWeight.w800,
                                        letterSpacing: -0.5,
                                      ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  _user?.email ?? '',
                                  style: theme.textTheme.bodySmall?.copyWith(
                                    color: colors.textTertiary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.md),
                      // Edit button
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton.icon(
                          onPressed: _editProfile,
                          icon: const Icon(Icons.edit_rounded, size: 16),
                          label: const Text('Editar perfil'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppColors.primary,
                            side: const BorderSide(color: AppColors.primary),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(AppRadius.md),
                            ),
                            padding: const EdgeInsets.symmetric(vertical: 10),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Información de cuenta',
                    style: theme.textTheme.headlineSmall?.copyWith(
                      color: colors.textPrimary,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  _InfoTile(
                    icon: Icons.person_rounded,
                    label: 'Nombre completo',
                    value: _user?.fullName ?? '-',
                  ),
                  _InfoTile(
                    icon: Icons.email_rounded,
                    label: 'Correo electrónico',
                    value: _user?.email ?? '-',
                  ),
                  _InfoTile(
                    icon: Icons.phone_rounded,
                    label: 'Teléfono',
                    value: _user?.phone ?? '-',
                  ),
                  _InfoTile(
                    icon: Icons.badge_rounded,
                    label: 'Rol',
                    value: _user?.role == 'client'
                        ? 'Cliente'
                        : (_user?.role ?? '-'),
                  ),
                  if (_user?.role == 'client') ...[
                    const SizedBox(height: AppSpacing.xl),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            'Métodos de pago',
                            style: theme.textTheme.headlineSmall?.copyWith(
                              color: colors.textPrimary,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.5,
                            ),
                          ),
                        ),
                        IconButton.filledTonal(
                          onPressed: _showAddCardDialog,
                          icon: const Icon(Icons.add_card_rounded),
                          tooltip: 'Agregar tarjeta',
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    if (_cards.isEmpty)
                      _EmptyPaymentCard(onAdd: _showAddCardDialog)
                    else
                      ..._cards.map(
                        (card) => _PaymentCardTile(
                          card: card,
                          onSetDefault: () => _setDefaultCard(card),
                          onDelete: () => _deleteCard(card),
                        ),
                      ),
                  ],
                  const SizedBox(height: AppSpacing.xl),
                  Text(
                    'Ajustes',
                    style: theme.textTheme.headlineSmall?.copyWith(
                      color: colors.textPrimary,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  BlocBuilder<ThemeCubit, ThemeMode>(
                    builder: (context, themeMode) {
                      return _ToggleTile(
                        icon: themeMode == ThemeMode.dark
                            ? Icons.dark_mode_rounded
                            : Icons.light_mode_rounded,
                        label: 'Modo oscuro',
                        value: themeMode == ThemeMode.dark,
                        onChanged: (_) => context.read<ThemeCubit>().toggle(),
                      );
                    },
                  ),
                  _ActionTile(
                    icon: Icons.info_outline_rounded,
                    label: 'Acerca de AsisteCar',
                    onTap: () => _showAbout(context),
                  ),
                  const SizedBox(height: AppSpacing.xl),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: _logout,
                      icon: const Icon(Icons.logout_rounded),
                      label: const Text('Cerrar sesión'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.danger,
                        side: const BorderSide(color: AppColors.danger),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  Center(
                    child: Text(
                      'AsisteCar v1.0.0',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: colors.textTertiary,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xl),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAvatar(AppColorsExtension colors) {
    final photoUrl = _user?.profilePhotoUrl;
    if (_uploadingPhoto) {
      return CircleAvatar(
        radius: 40,
        backgroundColor: AppColors.primary.withValues(alpha: 0.15),
        child: const SizedBox(
          width: 24,
          height: 24,
          child: CircularProgressIndicator(strokeWidth: 2.5),
        ),
      );
    }
    if (photoUrl != null && photoUrl.isNotEmpty) {
      return CircleAvatar(
        radius: 40,
        backgroundColor: AppColors.primary.withValues(alpha: 0.15),
        backgroundImage: NetworkImage(
          '${ApiService.baseUrl.replaceAll('/api', '')}$photoUrl',
        ),
      );
    }
    return CircleAvatar(
      radius: 40,
      backgroundColor: AppColors.primary.withValues(alpha: 0.15),
      child: Text(
        _user != null ? _getInitials(_user!.fullName) : '...',
        style: const TextStyle(
          fontSize: 24,
          fontWeight: FontWeight.w800,
          color: AppColors.primary,
        ),
      ),
    );
  }

  String _getInitials(String name) {
    final parts = name.trim().split(' ');
    if (parts.length >= 2) return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    if (parts.isNotEmpty) return parts[0][0].toUpperCase();
    return '?';
  }

  Future<void> _setDefaultCard(PaymentCard card) async {
    try {
      await ApiService.setDefaultPaymentCard(card.id);
      final cards = await ApiService.getPaymentCards();
      if (mounted) {
        setState(() => _cards = cards);
        AppSnackBar.success(context, 'Tarjeta seleccionada');
      }
    } catch (e) {
      if (mounted) {
        AppSnackBar.error(context, e.toString().replaceAll('Exception: ', ''));
      }
    }
  }

  Future<void> _deleteCard(PaymentCard card) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Eliminar tarjeta'),
        content: Text('¿Eliminar la tarjeta terminada en ${card.last4}?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Eliminar'),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await ApiService.deletePaymentCard(card.id);
      final cards = await ApiService.getPaymentCards();
      if (mounted) {
        setState(() => _cards = cards);
        AppSnackBar.success(context, 'Tarjeta eliminada');
      }
    } catch (e) {
      if (mounted) {
        AppSnackBar.error(context, e.toString().replaceAll('Exception: ', ''));
      }
    }
  }

  void _showAddCardDialog() {
    final holderCtrl = TextEditingController(text: _user?.fullName ?? '');
    final numberCtrl = TextEditingController();
    final monthCtrl = TextEditingController();
    final yearCtrl = TextEditingController();
    final cvvCtrl = TextEditingController();
    String? formError;
    bool saving = false;
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
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Agregar tarjeta',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  color: context.appColors.textPrimary,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              TextField(
                controller: holderCtrl,
                decoration: const InputDecoration(
                  labelText: 'Nombre en la tarjeta',
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              TextField(
                controller: numberCtrl,
                keyboardType: TextInputType.number,
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(16),
                ],
                decoration: const InputDecoration(
                  labelText: 'Numero de tarjeta',
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: monthCtrl,
                      keyboardType: TextInputType.number,
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                        LengthLimitingTextInputFormatter(2),
                      ],
                      decoration: const InputDecoration(labelText: 'Mes'),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: TextField(
                      controller: yearCtrl,
                      keyboardType: TextInputType.number,
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                        LengthLimitingTextInputFormatter(4),
                      ],
                      decoration: const InputDecoration(labelText: 'Anio'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              TextField(
                controller: cvvCtrl,
                keyboardType: TextInputType.number,
                obscureText: true,
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(3),
                ],
                decoration: const InputDecoration(labelText: 'CVV'),
              ),
              const SizedBox(height: AppSpacing.lg),
              if (formError != null) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(AppSpacing.md),
                  decoration: BoxDecoration(
                    color: AppColors.danger.withValues(alpha: 0.10),
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    border: Border.all(
                      color: AppColors.danger.withValues(alpha: 0.35),
                    ),
                  ),
                  child: Text(
                    formError!,
                    style: const TextStyle(
                      color: AppColors.danger,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
              ],
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: saving
                      ? null
                      : () async {
                          final navigator = Navigator.of(ctx);
                          setModalState(() {
                            formError = null;
                            saving = true;
                          });
                          try {
                            final holder = holderCtrl.text.trim();
                            final cardNumber = numberCtrl.text.trim();
                            final cvv = cvvCtrl.text.trim();
                            final expMonth = int.tryParse(
                              monthCtrl.text.trim(),
                            );
                            final yearText = yearCtrl.text.trim();
                            final parsedYear = int.tryParse(yearText);
                            final expYear = parsedYear == null
                                ? null
                                : yearText.length == 2
                                ? 2000 + parsedYear
                                : parsedYear;
                            final now = DateTime.now();

                            if (holder.isEmpty) {
                              throw Exception(
                                'Ingresa el nombre de la tarjeta',
                              );
                            }
                            if (cardNumber.length != 16) {
                              throw Exception(
                                'El numero de tarjeta debe tener 16 digitos',
                              );
                            }
                            if (expMonth == null ||
                                expMonth < 1 ||
                                expMonth > 12) {
                              throw Exception(
                                'Ingresa un mes valido entre 01 y 12',
                              );
                            }
                            if (expYear == null || yearText.length < 2) {
                              throw Exception('Ingresa un anio valido');
                            }
                            if (expYear < now.year ||
                                (expYear == now.year && expMonth < now.month)) {
                              throw Exception('La tarjeta esta vencida');
                            }
                            if (cvv.length != 3) {
                              throw Exception('El CVV debe tener 3 digitos');
                            }

                            await ApiService.addPaymentCard(
                              holderName: holder,
                              cardNumber: cardNumber,
                              expMonth: expMonth,
                              expYear: expYear,
                              cvv: cvv,
                            );
                            final cards = await ApiService.getPaymentCards();
                            if (mounted) {
                              setState(() => _cards = cards);
                            }
                            navigator.pop();
                            if (mounted) {
                              AppSnackBar.success(context, 'Tarjeta guardada');
                            }
                          } catch (e) {
                            if (mounted && navigator.canPop()) {
                              setModalState(() {
                                formError = e.toString().replaceAll(
                                  'Exception: ',
                                  '',
                                );
                                saving = false;
                              });
                            }
                          }
                        },
                  icon: const Icon(Icons.lock_rounded),
                  label: Text(saving ? 'Guardando...' : 'Guardar tarjeta'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _logout() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cerrar sesión'),
        content: const Text('¿Estás seguro que deseas cerrar sesión?'),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
            child: const Text('Cerrar sesión'),
          ),
        ],
      ),
    );
    if (confirm == true && mounted) {
      context.read<AuthBloc>().add(AuthLogoutRequested());
    }
  }

  void _showAbout(BuildContext context) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
        ),
        title: const Text('AsisteCar'),
        content: const Text(
          'Plataforma Inteligente de Atención de Emergencias Vehiculares.\n\n'
          'Conecta conductores con talleres mecánicos mediante análisis con IA.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cerrar'),
          ),
        ],
      ),
    );
  }
}

class _InfoTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _InfoTile({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      decoration: BoxDecoration(
        color: context.appColors.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 20,
            spreadRadius: 2,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: AppColors.primary, size: 18),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 11,
                    color: context.appColors.textTertiary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 14,
                    color: context.appColors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _ActionTile({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: AppSpacing.md),
        decoration: BoxDecoration(
          color: context.appColors.surface,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 20,
              spreadRadius: 2,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: AppColors.primary, size: 18),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 14,
                  color: context.appColors.textPrimary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            Icon(
              Icons.chevron_right_rounded,
              color: context.appColors.textTertiary,
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyPaymentCard extends StatelessWidget {
  final VoidCallback onAdd;

  const _EmptyPaymentCard({required this.onAdd});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: context.appColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: context.appColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.credit_card_rounded, color: AppColors.primary),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  'Aun no tienes tarjetas guardadas',
                  style: TextStyle(
                    color: context.appColors.textPrimary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Agrega una tarjeta de debito o credito para pagar servicios automaticamente.',
            style: TextStyle(color: context.appColors.textSecondary),
          ),
          const SizedBox(height: AppSpacing.md),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: onAdd,
              icon: const Icon(Icons.add_card_rounded),
              label: const Text('Agregar tarjeta'),
            ),
          ),
        ],
      ),
    );
  }
}

class _PaymentCardTile extends StatelessWidget {
  final PaymentCard card;
  final VoidCallback onSetDefault;
  final VoidCallback onDelete;

  const _PaymentCardTile({
    required this.card,
    required this.onSetDefault,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      decoration: BoxDecoration(
        color: context.appColors.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 20,
            spreadRadius: 2,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.credit_card_rounded,
              color: AppColors.primary,
              size: 18,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${card.brand.toUpperCase()} •••• ${card.last4}',
                  style: TextStyle(
                    fontSize: 14,
                    color: context.appColors.textPrimary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  '${card.holderName} · vence ${card.expMonth}/${card.expYear}',
                  style: TextStyle(
                    fontSize: 12,
                    color: context.appColors.textTertiary,
                  ),
                ),
                if (card.isDefault) ...[
                  const SizedBox(height: 6),
                  const Text(
                    'Predeterminada',
                    style: TextStyle(
                      color: AppColors.success,
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ],
            ),
          ),
          PopupMenuButton<String>(
            onSelected: (value) {
              if (value == 'default') onSetDefault();
              if (value == 'delete') onDelete();
            },
            itemBuilder: (_) => [
              if (!card.isDefault)
                const PopupMenuItem(
                  value: 'default',
                  child: Text('Usar como predeterminada'),
                ),
              const PopupMenuItem(value: 'delete', child: Text('Eliminar')),
            ],
          ),
        ],
      ),
    );
  }
}

class _ToggleTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool value;
  final ValueChanged<bool> onChanged;
  const _ToggleTile({
    required this.icon,
    required this.label,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      decoration: BoxDecoration(
        color: context.appColors.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 20,
            spreadRadius: 2,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: AppColors.primary, size: 18),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 14,
                color: context.appColors.textPrimary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Switch.adaptive(
            value: value,
            onChanged: onChanged,
            activeTrackColor: AppColors.primary,
          ),
        ],
      ),
    );
  }
}
