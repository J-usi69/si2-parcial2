class AppConfig {
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://asistecar.net/api',
  );

  static const String wsBaseUrl = String.fromEnvironment(
    'WS_BASE_URL',
    defaultValue: 'wss://asistecar.net/ws',
  );

  static String get serverBaseUrl =>
      apiBaseUrl.replaceFirst(RegExp(r'/api$'), '');
}
