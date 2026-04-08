import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Incident, Notification, Payment, Technician, User, Workshop, ChatMessage, Review } from '../models/interfaces';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Profile
  getMe(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/users/me`);
  }

  updateProfile(data: { full_name?: string; phone?: string }): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/users/me`, data);
  }

  uploadProfilePhoto(file: File): Observable<User> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<User>(`${this.apiUrl}/users/me/photo`, formData);
  }

  // Workshop
  getMyWorkshop(): Observable<Workshop> {
    return this.http.get<Workshop>(`${this.apiUrl}/workshops/me`);
  }

  createWorkshop(data: Partial<Workshop>): Observable<Workshop> {
    return this.http.post<Workshop>(`${this.apiUrl}/workshops/`, data);
  }

  updateWorkshop(data: Partial<Workshop>): Observable<Workshop> {
    return this.http.put<Workshop>(`${this.apiUrl}/workshops/me`, data);
  }

  // Technicians
  getTechnicians(): Observable<Technician[]> {
    return this.http.get<Technician[]>(`${this.apiUrl}/workshops/technicians`);
  }

  createTechnician(data: Partial<Technician>): Observable<Technician> {
    return this.http.post<Technician>(`${this.apiUrl}/workshops/technicians`, data);
  }

  updateTechnician(id: number, data: Partial<Technician>): Observable<Technician> {
    return this.http.put<Technician>(`${this.apiUrl}/workshops/technicians/${id}`, data);
  }

  deleteTechnician(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/workshops/technicians/${id}`);
  }

  // Incidents
  getIncidents(): Observable<Incident[]> {
    return this.http.get<Incident[]>(`${this.apiUrl}/incidents/`);
  }

  getIncident(id: number): Observable<Incident> {
    return this.http.get<Incident>(`${this.apiUrl}/incidents/${id}`);
  }

  acceptIncident(id: number, technicianId?: number): Observable<Incident> {
    const params = technicianId ? `?technician_id=${technicianId}` : '';
    return this.http.post<Incident>(`${this.apiUrl}/incidents/${id}/accept${params}`, {});
  }

  rejectIncident(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/incidents/${id}/reject`, {});
  }

  updateIncident(id: number, data: Partial<Incident>): Observable<Incident> {
    return this.http.put<Incident>(`${this.apiUrl}/incidents/${id}`, data);
  }

  // Notifications
  getNotifications(): Observable<Notification[]> {
    return this.http.get<Notification[]>(`${this.apiUrl}/notifications/`);
  }

  getUnreadCount(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${this.apiUrl}/notifications/unread-count`);
  }

  markAsRead(id: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/notifications/${id}/read`, {});
  }

  markAllAsRead(): Observable<any> {
    return this.http.put(`${this.apiUrl}/notifications/read-all`, {});
  }

  // Payments
  getPayments(): Observable<Payment[]> {
    return this.http.get<Payment[]>(`${this.apiUrl}/payments/my-payments`);
  }

  // Chat
  getChatMessages(incidentId: number): Observable<ChatMessage[]> {
    return this.http.get<ChatMessage[]>(`${this.apiUrl}/chat/${incidentId}/messages`);
  }

  sendChatMessage(incidentId: number, message: string): Observable<ChatMessage> {
    return this.http.post<ChatMessage>(`${this.apiUrl}/chat/${incidentId}/messages`, { message });
  }

  // Reviews
  getMyReviews(): Observable<Review[]> {
    return this.http.get<Review[]>(`${this.apiUrl}/reviews/my-reviews`);
  }
}
