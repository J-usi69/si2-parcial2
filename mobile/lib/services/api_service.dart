import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/models.dart';

class ApiService {
  // Cambiar a la IP de tu PC si pruebas en dispositivo fisico
  static const String baseUrl = 'http://10.0.2.2:8000/api';

  static Future<String?> _getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('token');
  }

  static Future<Map<String, String>> _headers() async {
    final token = await _getToken();
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  // AUTH
  static Future<Map<String, dynamic>> register({
    required String email,
    required String password,
    required String fullName,
    required String phone,
  }) async {
    final resp = await http.post(
      Uri.parse('$baseUrl/auth/register'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'email': email,
        'password': password,
        'full_name': fullName,
        'phone': phone,
        'role': 'client',
      }),
    );
    if (resp.statusCode == 201) {
      final data = jsonDecode(resp.body);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('token', data['access_token']);
      await prefs.setString('user', jsonEncode(data['user']));
      return data;
    }
    String detail;
    try {
      detail = jsonDecode(resp.body)['detail'] ?? 'Error al registrarse';
    } catch (_) {
      detail = 'Error del servidor (${resp.statusCode})';
    }
    throw Exception(detail);
  }

  static Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    final resp = await http.post(
      Uri.parse('$baseUrl/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email, 'password': password}),
    );
    if (resp.statusCode == 200) {
      final data = jsonDecode(resp.body);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('token', data['access_token']);
      await prefs.setString('user', jsonEncode(data['user']));
      return data;
    }
    String detail;
    try {
      detail = jsonDecode(resp.body)['detail'] ?? 'Credenciales incorrectas';
    } catch (_) {
      detail = 'Error del servidor (${resp.statusCode})';
    }
    throw Exception(detail);
  }

  static Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
    await prefs.remove('user');
  }

  static Future<bool> isLoggedIn() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('token') != null;
  }

  static Future<User?> getCurrentUser() async {
    final prefs = await SharedPreferences.getInstance();
    final userStr = prefs.getString('user');
    if (userStr != null) return User.fromJson(jsonDecode(userStr));
    return null;
  }

  static Future<User> fetchProfile() async {
    final resp = await http.get(
      Uri.parse('$baseUrl/users/me'),
      headers: await _headers(),
    );
    if (resp.statusCode == 200) {
      final data = jsonDecode(resp.body);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('user', jsonEncode(data));
      return User.fromJson(data);
    }
    throw Exception('Error al obtener perfil');
  }

  static Future<User> updateProfile({String? fullName, String? phone}) async {
    final body = <String, dynamic>{};
    if (fullName != null) body['full_name'] = fullName;
    if (phone != null) body['phone'] = phone;
    final resp = await http.put(
      Uri.parse('$baseUrl/users/me'),
      headers: await _headers(),
      body: jsonEncode(body),
    );
    if (resp.statusCode == 200) {
      final data = jsonDecode(resp.body);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('user', jsonEncode(data));
      return User.fromJson(data);
    }
    throw Exception('Error al actualizar perfil');
  }

  static Future<void> updateFirebaseToken(String token) async {
    await http.put(
      Uri.parse('$baseUrl/users/me'),
      headers: await _headers(),
      body: jsonEncode({'firebase_token': token}),
    );
  }

  static Future<User> uploadProfilePhoto(File imageFile) async {
    final token = await _getToken();
    final request = http.MultipartRequest(
      'POST',
      Uri.parse('$baseUrl/users/me/photo'),
    );
    request.headers['Authorization'] = 'Bearer $token';
    final ext = imageFile.path.split('.').last.toLowerCase();
    final mimeType = switch (ext) {
      'png' => 'image/png',
      'webp' => 'image/webp',
      _ => 'image/jpeg',
    };
    request.files.add(
      await http.MultipartFile.fromPath(
        'file',
        imageFile.path,
        contentType: MediaType.parse(mimeType),
      ),
    );
    final streamed = await request.send();
    final resp = await http.Response.fromStream(streamed);
    if (resp.statusCode == 200) {
      final data = jsonDecode(resp.body);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('user', jsonEncode(data));
      return User.fromJson(data);
    }
    throw Exception('Error al subir foto');
  }

  // VEHICLES
  static Future<List<Vehicle>> getVehicles() async {
    final resp = await http.get(
      Uri.parse('$baseUrl/vehicles/'),
      headers: await _headers(),
    );
    if (resp.statusCode == 200) {
      return (jsonDecode(resp.body) as List)
          .map((v) => Vehicle.fromJson(v))
          .toList();
    }
    throw Exception('Error al obtener vehiculos');
  }

  static Future<Vehicle> createVehicle(Map<String, dynamic> data) async {
    final resp = await http.post(
      Uri.parse('$baseUrl/vehicles/'),
      headers: await _headers(),
      body: jsonEncode(data),
    );
    if (resp.statusCode == 201) return Vehicle.fromJson(jsonDecode(resp.body));
    throw Exception(
      jsonDecode(resp.body)['detail'] ?? 'Error al crear vehiculo',
    );
  }

  static Future<Vehicle> updateVehicle(
    int id,
    Map<String, dynamic> data,
  ) async {
    final resp = await http.put(
      Uri.parse('$baseUrl/vehicles/$id'),
      headers: await _headers(),
      body: jsonEncode(data),
    );
    if (resp.statusCode == 200) return Vehicle.fromJson(jsonDecode(resp.body));
    throw Exception(
      jsonDecode(resp.body)['detail'] ?? 'Error al actualizar vehiculo',
    );
  }

  static Future<void> deleteVehicle(int id) async {
    final resp = await http.delete(
      Uri.parse('$baseUrl/vehicles/$id'),
      headers: await _headers(),
    );
    if (resp.statusCode != 204) {
      throw Exception(
        jsonDecode(resp.body)['detail'] ?? 'Error al eliminar vehiculo',
      );
    }
  }

  // INCIDENTS
  static Future<Incident> createIncident({
    required int vehicleId,
    required double latitude,
    required double longitude,
    String? address,
    String? description,
  }) async {
    final resp = await http.post(
      Uri.parse('$baseUrl/incidents/'),
      headers: await _headers(),
      body: jsonEncode({
        'vehicle_id': vehicleId,
        'latitude': latitude,
        'longitude': longitude,
        'address': address,
        'description': description,
      }),
    );
    if (resp.statusCode == 201) return Incident.fromJson(jsonDecode(resp.body));
    throw Exception('Error al crear incidente');
  }

  static Future<List<Incident>> getIncidents() async {
    final resp = await http.get(
      Uri.parse('$baseUrl/incidents/'),
      headers: await _headers(),
    );
    if (resp.statusCode == 200) {
      return (jsonDecode(resp.body) as List)
          .map((i) => Incident.fromJson(i))
          .toList();
    }
    throw Exception('Error al obtener incidentes');
  }

  static Future<Incident> getIncident(int id) async {
    final resp = await http.get(
      Uri.parse('$baseUrl/incidents/$id'),
      headers: await _headers(),
    );
    if (resp.statusCode == 200) return Incident.fromJson(jsonDecode(resp.body));
    throw Exception('Incidente no encontrado');
  }

  static Future<Incident> uploadImage(int incidentId, File file) async {
    final token = await _getToken();
    final request = http.MultipartRequest(
      'POST',
      Uri.parse('$baseUrl/incidents/$incidentId/evidence/image'),
    );
    request.headers['Authorization'] = 'Bearer $token';
    request.files.add(await http.MultipartFile.fromPath('file', file.path));
    final streamResp = await request.send();
    final resp = await http.Response.fromStream(streamResp);
    if (resp.statusCode == 200) return Incident.fromJson(jsonDecode(resp.body));
    throw Exception('Error al subir imagen');
  }

  static Future<Incident> uploadAudio(int incidentId, File file) async {
    final token = await _getToken();
    final request = http.MultipartRequest(
      'POST',
      Uri.parse('$baseUrl/incidents/$incidentId/evidence/audio'),
    );
    request.headers['Authorization'] = 'Bearer $token';
    request.files.add(await http.MultipartFile.fromPath('file', file.path));
    final streamResp = await request.send();
    final resp = await http.Response.fromStream(streamResp);
    if (resp.statusCode == 200) return Incident.fromJson(jsonDecode(resp.body));
    throw Exception('Error al subir audio');
  }

  // NOTIFICATIONS
  static Future<List<AppNotification>> getNotifications() async {
    final resp = await http.get(
      Uri.parse('$baseUrl/notifications/'),
      headers: await _headers(),
    );
    if (resp.statusCode == 200) {
      return (jsonDecode(resp.body) as List)
          .map((n) => AppNotification.fromJson(n))
          .toList();
    }
    throw Exception('Error al obtener notificaciones');
  }

  static Future<void> markAllNotificationsRead() async {
    await http.put(
      Uri.parse('$baseUrl/notifications/read-all'),
      headers: await _headers(),
    );
  }

  // PAYMENTS
  static Future<void> createPayment({
    required int incidentId,
    required double amount,
    String method = 'card',
  }) async {
    final resp = await http.post(
      Uri.parse('$baseUrl/payments/'),
      headers: await _headers(),
      body: jsonEncode({
        'incident_id': incidentId,
        'amount': amount,
        'payment_method': method,
      }),
    );
    if (resp.statusCode != 201) {
      throw Exception(jsonDecode(resp.body)['detail'] ?? 'Error en el pago');
    }
  }

  // CHAT
  static Future<List<ChatMessage>> getChatMessages(int incidentId) async {
    final resp = await http.get(
      Uri.parse('$baseUrl/chat/$incidentId/messages'),
      headers: await _headers(),
    );
    if (resp.statusCode == 200) {
      final list = jsonDecode(resp.body) as List;
      return list.map((j) => ChatMessage.fromJson(j)).toList();
    }
    return [];
  }

  static Future<ChatMessage> sendChatMessage(
    int incidentId,
    String message,
  ) async {
    final resp = await http.post(
      Uri.parse('$baseUrl/chat/$incidentId/messages'),
      headers: await _headers(),
      body: jsonEncode({'message': message}),
    );
    if (resp.statusCode == 200) {
      return ChatMessage.fromJson(jsonDecode(resp.body));
    }
    throw Exception('Error al enviar mensaje');
  }

  // REVIEWS
  static Future<Review> createReview({
    required int incidentId,
    required int rating,
    String? comment,
  }) async {
    final resp = await http.post(
      Uri.parse('$baseUrl/reviews/'),
      headers: await _headers(),
      body: jsonEncode({
        'incident_id': incidentId,
        'rating': rating,
        'comment': comment,
      }),
    );
    if (resp.statusCode == 201) {
      return Review.fromJson(jsonDecode(resp.body));
    }
    throw Exception(
      jsonDecode(resp.body)['detail'] ?? 'Error al enviar reseña',
    );
  }

  static Future<Review?> getReviewForIncident(int incidentId) async {
    final resp = await http.get(
      Uri.parse('$baseUrl/reviews/incident/$incidentId'),
      headers: await _headers(),
    );
    if (resp.statusCode == 200 && resp.body != 'null') {
      return Review.fromJson(jsonDecode(resp.body));
    }
    return null;
  }
}
