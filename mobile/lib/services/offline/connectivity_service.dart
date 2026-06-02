import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';

/// Detecta el estado de conexion y expone un stream de online/offline.
class ConnectivityService {
  ConnectivityService._();
  static final ConnectivityService instance = ConnectivityService._();

  final _controller = StreamController<bool>.broadcast();
  final Connectivity _connectivity = Connectivity();
  StreamSubscription? _sub;
  bool _online = true;

  bool get isOnline => _online;
  Stream<bool> get onStatusChange => _controller.stream;

  Future<void> init() async {
    final result = await _connectivity.checkConnectivity();
    _online = _isConnected(result);
    _sub ??= _connectivity.onConnectivityChanged.listen((result) {
      final online = _isConnected(result);
      if (online != _online) {
        _online = online;
        _controller.add(online);
      }
    });
  }

  bool _isConnected(List<ConnectivityResult> result) {
    return result.any((r) => r != ConnectivityResult.none);
  }

  /// Comprueba la conexion en el momento (util antes de un envio).
  Future<bool> checkNow() async {
    final result = await _connectivity.checkConnectivity();
    _online = _isConnected(result);
    return _online;
  }

  void dispose() {
    _sub?.cancel();
    _controller.close();
  }
}
