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
    'id': id,
    'user_id': userId,
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
  final double? technicianLatitude;
  final double? technicianLongitude;
  final String? technicianLastLocationAt;
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
    this.technicianLatitude,
    this.technicianLongitude,
    this.technicianLastLocationAt,
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
    technicianLatitude: json['technician_latitude'] != null
        ? (json['technician_latitude'] as num).toDouble()
        : null,
    technicianLongitude: json['technician_longitude'] != null
        ? (json['technician_longitude'] as num).toDouble()
        : null,
    technicianLastLocationAt: json['technician_last_location_at'],
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

class Technician {
  final int id;
  final int workshopId;
  final int? userId;
  final String name;
  final String phone;
  final String specialties;
  final bool isAvailable;
  final double? latitude;
  final double? longitude;
  final String? lastLocationAt;
  final String createdAt;

  Technician({
    required this.id,
    required this.workshopId,
    this.userId,
    required this.name,
    required this.phone,
    required this.specialties,
    required this.isAvailable,
    this.latitude,
    this.longitude,
    this.lastLocationAt,
    required this.createdAt,
  });

  factory Technician.fromJson(Map<String, dynamic> json) => Technician(
    id: json['id'],
    workshopId: json['workshop_id'],
    userId: json['user_id'],
    name: json['name'],
    phone: json['phone'],
    specialties: json['specialties'],
    isAvailable: json['is_available'],
    latitude: json['latitude'] != null
        ? (json['latitude'] as num).toDouble()
        : null,
    longitude: json['longitude'] != null
        ? (json['longitude'] as num).toDouble()
        : null,
    lastLocationAt: json['last_location_at'],
    createdAt: json['created_at'],
  );
}

class ServiceOffer {
  final int id;
  final int incidentId;
  final int workshopId;
  final int? technicianId;
  final double cost;
  final int estimatedArrival;
  final double distanceKm;
  final double score;
  final String? recommendationReason;
  final String? message;
  final String status;
  final String createdAt;
  final String? workshopName;
  final double? workshopRating;
  final int? workshopTotalRatings;
  final String? technicianName;
  final bool isRecommended;

  ServiceOffer({
    required this.id,
    required this.incidentId,
    required this.workshopId,
    this.technicianId,
    required this.cost,
    required this.estimatedArrival,
    required this.distanceKm,
    required this.score,
    this.recommendationReason,
    this.message,
    required this.status,
    required this.createdAt,
    this.workshopName,
    this.workshopRating,
    this.workshopTotalRatings,
    this.technicianName,
    required this.isRecommended,
  });

  factory ServiceOffer.fromJson(Map<String, dynamic> json) => ServiceOffer(
    id: json['id'],
    incidentId: json['incident_id'],
    workshopId: json['workshop_id'],
    technicianId: json['technician_id'],
    cost: (json['cost'] as num).toDouble(),
    estimatedArrival: json['estimated_arrival'],
    distanceKm: (json['distance_km'] as num).toDouble(),
    score: (json['score'] as num).toDouble(),
    recommendationReason: json['recommendation_reason'],
    message: json['message'],
    status: json['status'],
    createdAt: json['created_at'],
    workshopName: json['workshop_name'],
    workshopRating: json['workshop_rating'] != null
        ? (json['workshop_rating'] as num).toDouble()
        : null,
    workshopTotalRatings: json['workshop_total_ratings'],
    technicianName: json['technician_name'],
    isRecommended: json['is_recommended'] ?? false,
  );
}

class PaymentCard {
  final int id;
  final String holderName;
  final String brand;
  final String last4;
  final int expMonth;
  final int expYear;
  final bool isDefault;

  PaymentCard({
    required this.id,
    required this.holderName,
    required this.brand,
    required this.last4,
    required this.expMonth,
    required this.expYear,
    required this.isDefault,
  });

  factory PaymentCard.fromJson(Map<String, dynamic> json) => PaymentCard(
    id: json['id'],
    holderName: json['holder_name'],
    brand: json['brand'],
    last4: json['last4'],
    expMonth: json['exp_month'],
    expYear: json['exp_year'],
    isDefault: json['is_default'],
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

class AssistantResponse {
  final String message;
  final List<String> suggestedActions;
  final String source;

  AssistantResponse({
    required this.message,
    required this.suggestedActions,
    required this.source,
  });

  factory AssistantResponse.fromJson(Map<String, dynamic> json) =>
      AssistantResponse(
        message: json['message'] ?? '',
        suggestedActions: (json['suggested_actions'] as List? ?? [])
            .map((action) => action.toString())
            .toList(),
        source: json['source'] ?? 'rules',
      );
}
