class User {
  final int id;
  final String email;
  final String fullName;
  final String phone;
  final String role;
  final bool isActive;
  final String? profilePhotoUrl;

  User({
    required this.id,
    required this.email,
    required this.fullName,
    required this.phone,
    required this.role,
    required this.isActive,
    this.profilePhotoUrl,
  });

  factory User.fromJson(Map<String, dynamic> json) => User(
    id: json['id'],
    email: json['email'],
    fullName: json['full_name'],
    phone: json['phone'],
    role: json['role'],
    isActive: json['is_active'],
    profilePhotoUrl: json['profile_photo_url'],
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'email': email,
    'full_name': fullName,
    'phone': phone,
    'role': role,
    'is_active': isActive,
    'profile_photo_url': profilePhotoUrl,
  };

  User copyWith({String? fullName, String? phone, String? profilePhotoUrl}) =>
      User(
        id: id,
        email: email,
        fullName: fullName ?? this.fullName,
        phone: phone ?? this.phone,
        role: role,
        isActive: isActive,
        profilePhotoUrl: profilePhotoUrl ?? this.profilePhotoUrl,
      );
}

class Vehicle {
  final int id;
  final int userId;
  final String brand;
  final String model;
  final int year;
  final String color;
  final String plateNumber;

  Vehicle({
    required this.id,
    required this.userId,
    required this.brand,
    required this.model,
    required this.year,
    required this.color,
    required this.plateNumber,
  });

  factory Vehicle.fromJson(Map<String, dynamic> json) => Vehicle(
    id: json['id'],
    userId: json['user_id'],
    brand: json['brand'],
    model: json['model'],
    year: json['year'],
    color: json['color'],
    plateNumber: json['plate_number'],
  );

  Map<String, dynamic> toJson() => {
    'brand': brand,
    'model': model,
    'year': year,
    'color': color,
    'plate_number': plateNumber,
  };
}

class Incident {
  final int id;
  final int userId;
  final int vehicleId;
  final int? workshopId;
  final String? workshopName;
  final String? technicianName;
  final String category;
  final String priority;
  final String status;
  final String? description;
  final String? aiSummary;
  final String? aiDiagnosis;
  final double latitude;
  final double longitude;
  final String? address;
  final int? estimatedArrival;
  final double? finalCost;
  final String createdAt;
  final List<Evidence> evidences;

  Incident({
    required this.id,
    required this.userId,
    required this.vehicleId,
    this.workshopId,
    this.workshopName,
    this.technicianName,
    required this.category,
    required this.priority,
    required this.status,
    this.description,
    this.aiSummary,
    this.aiDiagnosis,
    required this.latitude,
    required this.longitude,
    this.address,
    this.estimatedArrival,
    this.finalCost,
    required this.createdAt,
    this.evidences = const [],
  });

  factory Incident.fromJson(Map<String, dynamic> json) => Incident(
    id: json['id'],
    userId: json['user_id'],
    vehicleId: json['vehicle_id'],
    workshopId: json['workshop_id'],
    workshopName: json['workshop_name'],
    technicianName: json['technician_name'],
    category: json['category'],
    priority: json['priority'],
    status: json['status'],
    description: json['description'],
    aiSummary: json['ai_summary'],
    aiDiagnosis: json['ai_diagnosis'],
    latitude: (json['latitude'] as num).toDouble(),
    longitude: (json['longitude'] as num).toDouble(),
    address: json['address'],
    estimatedArrival: json['estimated_arrival'],
    finalCost: json['final_cost'] != null
        ? (json['final_cost'] as num).toDouble()
        : null,
    createdAt: json['created_at'],
    evidences: (json['evidences'] as List? ?? [])
        .map((e) => Evidence.fromJson(e))
        .toList(),
  );
}

class Evidence {
  final int id;
  final String type;
  final String? fileUrl;
  final String? content;
  final String? transcription;
  final String? aiAnalysis;

  Evidence({
    required this.id,
    required this.type,
    this.fileUrl,
    this.content,
    this.transcription,
    this.aiAnalysis,
  });

  factory Evidence.fromJson(Map<String, dynamic> json) => Evidence(
    id: json['id'],
    type: json['type'],
    fileUrl: json['file_url'],
    content: json['content'],
    transcription: json['transcription'],
    aiAnalysis: json['ai_analysis'],
  );
}

class AppNotification {
  final int id;
  final String title;
  final String message;
  final String type;
  final bool isRead;
  final String createdAt;

  AppNotification({
    required this.id,
    required this.title,
    required this.message,
    required this.type,
    required this.isRead,
    required this.createdAt,
  });

  factory AppNotification.fromJson(Map<String, dynamic> json) =>
      AppNotification(
        id: json['id'],
        title: json['title'],
        message: json['message'],
        type: json['type'],
        isRead: json['is_read'],
        createdAt: json['created_at'],
      );
}

class ChatMessage {
  final int id;
  final int incidentId;
  final int senderId;
  final String senderName;
  final String senderRole;
  final String message;
  final String createdAt;

  ChatMessage({
    required this.id,
    required this.incidentId,
    required this.senderId,
    required this.senderName,
    required this.senderRole,
    required this.message,
    required this.createdAt,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) => ChatMessage(
    id: json['id'],
    incidentId: json['incident_id'],
    senderId: json['sender_id'],
    senderName: json['sender_name'],
    senderRole: json['sender_role'],
    message: json['message'],
    createdAt: json['created_at'],
  );
}

class Review {
  final int id;
  final int incidentId;
  final int userId;
  final int workshopId;
  final int rating;
  final String? comment;
  final String createdAt;
  final String? userName;

  Review({
    required this.id,
    required this.incidentId,
    required this.userId,
    required this.workshopId,
    required this.rating,
    this.comment,
    required this.createdAt,
    this.userName,
  });

  factory Review.fromJson(Map<String, dynamic> json) => Review(
    id: json['id'],
    incidentId: json['incident_id'],
    userId: json['user_id'],
    workshopId: json['workshop_id'],
    rating: json['rating'],
    comment: json['comment'],
    createdAt: json['created_at'],
    userName: json['user_name'],
  );
}
