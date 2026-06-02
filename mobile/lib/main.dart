import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'blocs/blocs.dart';
import 'screens/login_screen.dart';
import 'screens/main_shell_screen.dart';
import 'screens/technician_jobs_screen.dart';
import 'services/push_notification_service.dart';
import 'services/offline/connectivity_service.dart';
import 'services/offline/sync_service.dart';
import 'theme/app_colors.dart';
import 'theme/app_theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  // Offline: detectar conexion y arrancar la sincronizacion automatica.
  await ConnectivityService.instance.init();
  SyncService.instance.start();
  await SyncService.instance.syncNow(); // reintenta pendientes al abrir la app
  runApp(const RescateYaApp());
}

class RescateYaApp extends StatelessWidget {
  const RescateYaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider(create: (_) => ThemeCubit()),
        BlocProvider(create: (_) => AuthBloc()..add(AuthCheckRequested())),
      ],
      child: BlocBuilder<ThemeCubit, ThemeMode>(
        builder: (context, themeMode) {
          return MaterialApp(
            title: 'RescateYa',
            debugShowCheckedModeBanner: false,
            theme: AppTheme.light(),
            darkTheme: AppTheme.dark(),
            themeMode: themeMode,
            home: const AuthGate(),
          );
        },
      ),
    );
  }
}

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<AuthBloc, AuthState>(
      listener: (context, state) {
        if (state is AuthFailure) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text(state.message)));
        }
        if (state is AuthAuthenticated) {
          PushNotificationService.init();
        }
      },
      builder: (context, state) {
        if (state is AuthInitial || state is AuthLoading) {
          final colors = context.appColors;
          return Scaffold(
            backgroundColor: colors.background,
            body: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Image.asset(
                    'assets/asistecar.png',
                    width: 80,
                    height: 80,
                    fit: BoxFit.contain,
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.5,
                      color: colors.textTertiary,
                    ),
                  ),
                ],
              ),
            ),
          );
        }
        if (state is AuthAuthenticated) {
          if (state.user.role == 'technician') {
            return const TechnicianJobsScreen();
          }
          return const MainShellScreen();
        }
        return const LoginScreen();
      },
    );
  }
}
