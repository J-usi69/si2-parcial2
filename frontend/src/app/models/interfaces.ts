export interface User {
  id: number;
  email: string;
  full_name: string;
  phone: string;
  role: 'client' | 'workshop' | 'technician' | 'admin';
  is_active: boolean;
  profile_photo_url: string | null;
  created_at: string;
}

export interface Token {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Workshop {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  is_available: boolean;
  capacity: number;
  services: string;
  rating: number;
  total_ratings: number;
  created_at: string;
}

export interface Technician {
  id: number;
  workshop_id: number;
  user_id: number | null;
  user_email: string | null;
  name: string;
  phone: string;
  specialties: string;
  is_available: boolean;
  latitude: number | null;
  longitude: number | null;
  last_location_at: string | null;
  created_at: string;
}

export interface Vehicle {
  id: number;
  user_id: number;
  brand: string;
  model: string;
  year: number;
  color: string;
  plate_number: string;
  created_at: string;
}

export interface Evidence {
  id: number;
  type: 'image' | 'audio' | 'text';
  file_url: string | null;
  content: string | null;
  transcription: string | null;
  ai_analysis: string | null;
  created_at: string;
}

export interface StatusHistory {
  id: number;
  status: string;
  notes: string | null;
  changed_by: string | null;
  created_at: string;
}

export interface Incident {
  id: number;
  user_id: number;
  vehicle_id: number;
  workshop_id: number | null;
  technician_id: number | null;
  category: string;
  priority: string;
  status: string;
  description: string | null;
  ai_summary: string | null;
  ai_diagnosis: string | null;
  latitude: number;
  longitude: number;
  address: string | null;
  estimated_arrival: number | null;
  final_cost: number | null;
  commission_amount: number | null;
  created_at: string;
  updated_at: string;
  evidences: Evidence[];
  status_history: StatusHistory[];
  workshop_name: string | null;
  technician_name: string | null;
}

export interface Notification {
  id: number;
  user_id: number;
  incident_id: number | null;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export interface Payment {
  id: number;
  incident_id: number;
  amount: number;
  commission_amount: number;
  payment_method: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  transaction_id: string | null;
  created_at: string;
}

export interface ServiceOffer {
  id: number;
  incident_id: number;
  workshop_id: number;
  technician_id: number | null;
  cost: number;
  estimated_arrival: number;
  distance_km: number;
  score: number;
  recommendation_reason: string | null;
  message: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  workshop_name: string | null;
  workshop_rating: number | null;
  workshop_total_ratings: number | null;
  technician_name: string | null;
  is_recommended: boolean;
}

export interface AssignmentCandidate {
  workshop_id: number;
  workshop_name: string;
  distance_km: number;
  rating: number;
  score: number;
  estimated_arrival_minutes: number;
  technician_id: number;
  technician_name: string;
}

export interface ChatMessage {
  id: number;
  incident_id: number;
  sender_id: number;
  sender_name: string;
  sender_role: 'client' | 'workshop' | 'technician' | 'admin';
  message: string;
  created_at: string;
}

export interface Review {
  id: number;
  incident_id: number;
  user_id: number;
  workshop_id: number;
  rating: number;
  comment: string | null;
  created_at: string;
  user_name: string;
}
