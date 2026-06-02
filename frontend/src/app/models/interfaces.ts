export interface User {
  id: number;
  email: string;
  full_name: string;
  phone: string;
  role: 'client' | 'workshop' | 'technician' | 'admin';
  is_active: boolean;
  tenant_id: number | null;
  profile_photo_url: string | null;
  created_at: string;
}

export interface WorkshopInvitation {
  id: number;
  incident_id: number;
  workshop_id: number;
  tenant_id: number;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  distance_km: number | null;
  sent_at: string;
  expires_at: string;
  responded_at: string | null;
  response_time_seconds: number | null;
  incident_category: string | null;
  incident_priority: string | null;
  incident_address: string | null;
  incident_status: string | null;
}

export interface MetricsSummary {
  scope: 'global' | 'tenant';
  tenant_id: number | null;
  avg_assignment_min: number | null;
  avg_arrival_min: number | null;
  incidents_by_category: { category: string; count: number }[];
  top_workshops: {
    workshop_id: number;
    workshop_name: string;
    rating: number;
    completed: number;
    avg_completion_min: number | null;
  }[];
  zones: { latitude: number; longitude: number; count: number }[];
  cancelled: {
    total_incidents: number;
    cancelled: number;
    cancellation_rate: number;
    reasons: { reason: string; count: number }[];
  };
  sla: { measured: number; within_sla: number; compliance_rate: number | null };
  status_breakdown: { status: string; count: number }[];
}

export interface Token {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Workshop {
  id: number;
  user_id: number;
  tenant_id: number | null;
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
  technician_latitude: number | null;
  technician_longitude: number | null;
  technician_last_location_at: string | null;
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

export interface AdminPayment extends Payment {
  client_name: string | null;
  workshop_name: string | null;
  incident_status: string | null;
}

export interface AdminPaymentSummary {
  total_payments: number;
  total_amount: number;
  total_commission: number;
  card_amount: number;
  cash_amount: number;
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

export interface ReportResult {
  title: string;
  sql: string;
  columns: string[];
  rows: (string | number | null)[][];
  row_count: number;
}

export interface AssistantRequest {
  platform: 'web' | 'mobile';
  screen: string;
  question?: string | null;
  visible_state: Record<string, unknown>;
}

export interface AssistantResponse {
  message: string;
  suggested_actions: string[];
  source: 'gemini' | 'rules' | string;
}
