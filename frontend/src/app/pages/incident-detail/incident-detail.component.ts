import { Component, OnInit, OnDestroy, AfterViewChecked, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { WebSocketService } from '../../services/websocket.service';
import { AuthService } from '../../services/auth.service';
import { Incident, Technician, ChatMessage, ServiceOffer } from '../../models/interfaces';

@Component({
  selector: 'app-incident-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-content reveal" *ngIf="incident; else loadingTpl">
        <button class="btn-back" (click)="goBack()">
          <span class="material-symbols-rounded">arrow_back</span>
          Volver a incidentes
        </button>

        <div class="detail-header">
          <div class="header-left">
            <div class="cat-icon" [class]="'cat-' + incident.category">
              <span class="material-symbols-rounded">{{
                getCategoryIcon(incident.category)
              }}</span>
            </div>
            <div>
              <div class="header-meta">
                <span class="header-id">Incidente #{{ incident.id }}</span>
                <span
                  class="badge"
                  [ngClass]="'badge-priority-' + incident.priority"
                >
                  {{ incident.priority | uppercase }}
                </span>
                <span
                  class="badge badge-soft"
                  [ngClass]="'badge-status-' + incident.status"
                >
                  {{ getStatusLabel(incident.status) }}
                </span>
              </div>
              <h1 class="page-title">{{ getCategoryLabel(incident.category) }}</h1>
              <p class="page-subtitle">
                <span class="material-symbols-rounded">schedule</span>
                {{ incident.created_at | date: 'dd/MM/yyyy HH:mm' }}
              </p>
            </div>
          </div>
        </div>

        <div class="detail-grid">
          <!-- Main column -->
          <div class="main-column">
            <!-- AI Analysis -->
            <div class="card card-padded">
              <div class="card-section-header">
                <span class="material-symbols-rounded">auto_awesome</span>
                <h3>Analisis de IA</h3>
              </div>

              <div class="info-rows">
                <div class="info-row">
                  <span class="info-label">Categoria</span>
                  <span class="info-value">
                    {{ getCategoryLabel(incident.category) }}
                  </span>
                </div>
                <div class="info-row" *ngIf="incident.ai_summary">
                  <span class="info-label">Resumen</span>
                  <span class="info-value">{{ incident.ai_summary }}</span>
                </div>
                <div class="info-row" *ngIf="incident.ai_diagnosis">
                  <span class="info-label">Diagnostico</span>
                  <span class="info-value">{{ incident.ai_diagnosis }}</span>
                </div>
              </div>
            </div>

            <!-- Location -->
            <div class="card card-padded">
              <div class="card-section-header">
                <span class="material-symbols-rounded">location_on</span>
                <h3>Ubicacion</h3>
              </div>
              <p class="location-text">
                {{
                  incident.address ||
                    'Lat: ' + incident.latitude + ', Lng: ' + incident.longitude
                }}
              </p>
              <div id="incident-map" class="incident-map"></div>
            </div>

            <!-- User description -->
            <div class="card card-padded" *ngIf="incident.description">
              <div class="card-section-header">
                <span class="material-symbols-rounded">format_quote</span>
                <h3>Descripcion del usuario</h3>
              </div>
              <p class="quote">{{ incident.description }}</p>
            </div>

            <!-- Evidences -->
            <div class="card card-padded" *ngIf="incident.evidences.length > 0">
              <div class="card-section-header">
                <span class="material-symbols-rounded">collections</span>
                <h3>Evidencias ({{ incident.evidences.length }})</h3>
              </div>

              <div class="evidences">
                <div class="evidence" *ngFor="let ev of incident.evidences">
                  <div class="ev-type-row">
                    <span class="ev-type" [class]="'ev-' + ev.type">
                      <span class="material-symbols-rounded">{{
                        getEvidenceIcon(ev.type)
                      }}</span>
                      {{ ev.type | uppercase }}
                    </span>
                  </div>
                  <img
                    *ngIf="ev.type === 'image' && ev.file_url"
                    [src]="'http://localhost:8000' + ev.file_url"
                    alt="Evidencia"
                  />
                  <p
                    *ngIf="ev.type === 'audio' && ev.transcription"
                    class="ev-text"
                  >
                    <strong>Transcripcion:</strong> {{ ev.transcription }}
                  </p>
                  <p *ngIf="ev.type === 'text'" class="ev-text">
                    {{ ev.content }}
                  </p>
                  <div class="ai-tag" *ngIf="ev.ai_analysis">
                    <span class="material-symbols-rounded">psychology</span>
                    <span>{{ ev.ai_analysis }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Status timeline -->
            <div class="card card-padded">
              <div class="card-section-header">
                <span class="material-symbols-rounded">history</span>
                <h3>Historial de estados</h3>
              </div>

              <div class="timeline">
                <div
                  class="timeline-item"
                  *ngFor="let h of incident.status_history; let last = last"
                  [class.last]="last"
                >
                  <div class="timeline-marker">
                    <div
                      class="timeline-dot"
                      [class]="'dot-' + h.status"
                    ></div>
                    <div class="timeline-line" *ngIf="!last"></div>
                  </div>
                  <div class="timeline-content">
                    <strong>{{ getStatusLabel(h.status) }}</strong>
                    <span *ngIf="h.notes" class="timeline-notes">
                      — {{ h.notes }}
                    </span>
                    <div class="timeline-date">
                      {{ h.created_at | date: 'dd/MM/yyyy HH:mm' }} ·
                      {{ h.changed_by }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Chat -->
            <div class="card card-padded" *ngIf="incident.status !== 'pending' && incident.status !== 'cancelled'">
              <div class="card-section-header">
                <span class="material-symbols-rounded">chat</span>
                <h3>Chat con el cliente</h3>
              </div>

              <div class="chat-container" #chatContainer>
                <div class="chat-empty" *ngIf="chatMessages.length === 0">
                  <span class="material-symbols-rounded">forum</span>
                  <p>No hay mensajes aun. Inicia la conversacion.</p>
                </div>

                <div
                  *ngFor="let msg of chatMessages"
                  class="chat-bubble"
                  [class.mine]="msg.sender_id === currentUserId"
                  [class.other]="msg.sender_id !== currentUserId"
                >
                  <div class="chat-sender" *ngIf="msg.sender_id !== currentUserId">
                    {{ msg.sender_name }}
                    <span class="chat-role">{{ msg.sender_role === 'client' ? 'Cliente' : 'Taller' }}</span>
                  </div>
                  <div class="chat-text">{{ msg.message }}</div>
                  <div class="chat-time">{{ msg.created_at | date: 'HH:mm' }}</div>
                </div>
              </div>

              <div class="chat-input-row">
                <input
                  type="text"
                  [(ngModel)]="chatInput"
                  (keydown.enter)="sendMessage()"
                  placeholder="Escribe un mensaje..."
                  class="input chat-input"
                />
                <button class="btn btn-primary btn-icon" (click)="sendMessage()" [disabled]="!chatInput.trim()">
                  <span class="material-symbols-rounded">send</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Side panel -->
          <div class="side-column">
            <!-- Status hero -->
            <div
              class="status-hero"
              [class]="'hero-' + incident.status"
            >
              <div class="hero-icon">
                <span class="material-symbols-rounded">{{
                  getStatusIcon(incident.status)
                }}</span>
              </div>
              <div class="hero-label">Estado actual</div>
              <div class="hero-status">{{ getStatusLabel(incident.status) }}</div>
              <div class="hero-eta" *ngIf="incident.estimated_arrival">
                <span class="material-symbols-rounded">timer</span>
                ETA {{ incident.estimated_arrival }} min
              </div>
            </div>

            <!-- Pending: offer/reject -->
            <div class="card card-padded" *ngIf="incident.status === 'pending'">
              <div class="card-section-header">
                <span class="material-symbols-rounded">local_offer</span>
                <h3>{{ currentOffer ? 'Oferta enviada' : 'Enviar oferta' }}</h3>
              </div>

              <div class="offer-sent" *ngIf="currentOffer; else offerFormTpl">
                <div class="offer-sent-icon">
                  <span class="material-symbols-rounded">check_circle</span>
                </div>
                <div class="offer-sent-title">Tu oferta ya fue enviada al cliente</div>
                <div class="offer-sent-text">
                  El cliente la vera en la app movil y podra aceptarla o compararla con otras ofertas.
                </div>
                <div class="offer-summary">
                  <div>
                    <span>Costo</span>
                    <strong>Bs. {{ currentOffer.cost | number: '1.2-2' }}</strong>
                  </div>
                  <div>
                    <span>ETA</span>
                    <strong>{{ currentOffer.estimated_arrival }} min</strong>
                  </div>
                  <div *ngIf="currentOffer.technician_name">
                    <span>Tecnico</span>
                    <strong>{{ currentOffer.technician_name }}</strong>
                  </div>
                </div>
              </div>

              <ng-template #offerFormTpl>

              <div class="field">
                <label class="field-label">Asignar tecnico (opcional)</label>
                <select [(ngModel)]="selectedTechnician" class="select" [disabled]="offerSubmitting">
                  <option [ngValue]="null">Sin asignar</option>
                  <option *ngFor="let t of technicians" [ngValue]="t.id">
                    {{ t.name }}
                  </option>
                </select>
              </div>

              <div class="field">
                <label class="field-label">Costo ofertado (Bs.)</label>
                <input type="number" class="input" [(ngModel)]="offerCost" min="1" [disabled]="offerSubmitting" />
              </div>

              <div class="field">
                <label class="field-label">Tiempo estimado de llegada (min)</label>
                <input type="number" class="input" [(ngModel)]="offerEta" min="1" [disabled]="offerSubmitting" />
              </div>

              <div class="field">
                <label class="field-label">Mensaje para el cliente</label>
                <textarea class="input" [(ngModel)]="offerMessage" rows="3" [disabled]="offerSubmitting"></textarea>
              </div>

              <div class="form-error" *ngIf="offerError">
                <span class="material-symbols-rounded">error</span>
                {{ offerError }}
              </div>

              <button class="btn btn-success btn-block" (click)="sendOffer()" [disabled]="offerSubmitting">
                <span class="material-symbols-rounded">{{ offerSubmitting ? 'hourglass_top' : 'send' }}</span>
                {{ offerSubmitting ? 'Enviando oferta...' : 'Enviar oferta al cliente' }}
              </button>
              </ng-template>

              <button
                class="btn btn-outline btn-block reject-btn"
                (click)="rejectIncident()"
                [disabled]="offerSubmitting || !!currentOffer"
              >
                <span class="material-symbols-rounded">close</span>
                Rechazar
              </button>
            </div>

            <!-- Assigned/in_progress: update -->
            <div
              class="card card-padded"
              *ngIf="incident.status === 'assigned' || incident.status === 'in_progress'"
            >
              <div class="card-section-header">
                <span class="material-symbols-rounded">build</span>
                <h3>Actualizar estado</h3>
              </div>

              <button
                class="btn btn-primary btn-block"
                *ngIf="incident.status === 'assigned'"
                (click)="updateStatus('in_progress')"
              >
                <span class="material-symbols-rounded">play_arrow</span>
                Iniciar servicio
              </button>

              <div *ngIf="incident.status === 'in_progress'" class="payment-note">
                <span class="material-symbols-rounded">info</span>
                <p>El cierre y el pago los realiza el cliente desde la app movil. El monto queda fijado por la oferta aceptada.</p>
              </div>
            </div>

            <!-- Final cost -->
            <div
              class="cost-card"
              *ngIf="incident.final_cost"
            >
              <div class="cost-icon">
                <span class="material-symbols-rounded">payments</span>
              </div>
              <div class="cost-label">Costo del servicio</div>
              <div class="cost-amount">
                Bs. {{ incident.final_cost | number: '1.2-2' }}
              </div>
              <div class="cost-commission">
                Comision (10%): Bs.
                {{ incident.commission_amount | number: '1.2-2' }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <ng-template #loadingTpl>
        <div class="page-content">
          <div class="skeleton-detail">
            <div class="skeleton" style="height: 60px; margin-bottom: 24px;"></div>
            <div class="skeleton" style="height: 200px; margin-bottom: 16px;"></div>
            <div class="skeleton" style="height: 120px;"></div>
          </div>
        </div>
      </ng-template>
  `,
  styles: [
    `
      /* ── Mobile-first base styles ── */
      .btn-back {
        display: inline-flex; align-items: center; gap: 0.375rem;
        background: none; color: var(--color-text-secondary);
        font-size: 0.8125rem; font-weight: 500;
        padding: 0.5rem 0.75rem; margin-left: -0.75rem; margin-bottom: var(--space-sm);
        border-radius: var(--radius-md); transition: all 0.2s var(--ease-out);
        .material-symbols-rounded { font-size: 1.125rem; }
        &:hover { background: var(--color-surface-alt); color: var(--color-text-primary); }
      }

      /* Header */
      .detail-header { margin-bottom: var(--space-md); }

      .header-left { display: flex; align-items: flex-start; gap: var(--space-sm); }

      .cat-icon {
        width: 3rem; height: 3rem; border-radius: var(--radius-xl);
        display: flex; align-items: center; justify-content: center;
        background: var(--color-primary-50); flex-shrink: 0;
        .material-symbols-rounded { font-size: 1.5rem; color: var(--color-primary); }
        &.cat-battery { background: rgba(247, 127, 0, 0.1); .material-symbols-rounded { color: var(--color-warning); } }
        &.cat-tire { background: rgba(58, 134, 255, 0.1); .material-symbols-rounded { color: var(--color-info); } }
        &.cat-crash { background: rgba(230, 57, 70, 0.1); .material-symbols-rounded { color: var(--color-danger); } }
        &.cat-engine { background: rgba(108, 117, 125, 0.1); .material-symbols-rounded { color: var(--color-text-secondary); } }
      }

      .header-meta { display: flex; align-items: center; gap: var(--space-xs); margin-bottom: 0.25rem; flex-wrap: wrap; }

      .header-id {
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.6875rem; font-weight: 700;
        color: var(--color-text-tertiary); letter-spacing: 0.08em;
      }

      .page-subtitle {
        display: inline-flex; align-items: center; gap: 0.25rem;
        .material-symbols-rounded { font-size: 0.875rem; }
      }

      /* ── Mobile-first: single column grid ── */
      .detail-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: var(--space-md);
      }

      .main-column, .side-column {
        display: flex; flex-direction: column; gap: var(--space-md);
      }

      /* Section headers */
      .card-section-header {
        display: flex; align-items: center; gap: var(--space-xs); margin-bottom: var(--space-sm);
        .material-symbols-rounded { font-size: 1.25rem; color: var(--color-primary); }
        h3 { font-size: 0.9375rem; font-weight: 700; color: var(--color-text-primary); }
      }

      /* Info rows */
      .info-rows { display: flex; flex-direction: column; gap: var(--space-xs); }

      .info-row {
        display: flex; flex-direction: column; gap: 0.125rem;
        padding: var(--space-xs) 0;
        border-bottom: 1px solid var(--color-divider);
        &:last-child { border-bottom: none; }
      }

      .info-label {
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.625rem; font-weight: 700;
        color: var(--color-text-tertiary);
        text-transform: uppercase; letter-spacing: 0.1em;
      }

      .info-value { font-size: 0.875rem; color: var(--color-text-primary); line-height: 1.5; }

      .location-text {
        font-size: 0.875rem; color: var(--color-text-primary);
        background: var(--color-surface-alt); padding: var(--space-sm);
        border-radius: var(--radius-lg);
      }

      .incident-map {
        height: 11rem; border-radius: var(--radius-lg);
        margin-top: var(--space-sm); overflow: hidden; z-index: 0;
      }

      .quote {
        font-size: 0.875rem; color: var(--color-text-primary);
        line-height: 1.6; padding-left: var(--space-sm);
        border-left: 3px solid var(--color-primary); font-style: italic;
      }

      /* Evidences */
      .evidences { display: flex; flex-direction: column; gap: var(--space-sm); }

      .evidence {
        background: var(--color-surface-alt); padding: var(--space-sm);
        border-radius: var(--radius-lg);
        img { max-width: 100%; border-radius: var(--radius-md); margin-top: var(--space-xs); }
      }

      .ev-type {
        display: inline-flex; align-items: center; gap: 0.25rem;
        padding: 0.25rem 0.625rem; border-radius: var(--radius-pill);
        font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.5px;
        background: var(--color-primary-50); color: var(--color-primary);
        .material-symbols-rounded { font-size: 0.875rem; }
        &.ev-image { background: rgba(58, 134, 255, 0.1); color: var(--color-info); }
        &.ev-audio { background: rgba(255, 107, 53, 0.1); color: var(--color-accent); }
        &.ev-text { background: rgba(108, 117, 125, 0.1); color: var(--color-text-secondary); }
      }

      .ev-text { font-size: 0.8125rem; margin-top: var(--space-xs); color: var(--color-text-primary); }

      .ai-tag {
        margin-top: var(--space-xs); padding: var(--space-xs) var(--space-sm);
        background: rgba(58, 134, 255, 0.06);
        border: 1px solid rgba(58, 134, 255, 0.2);
        border-radius: var(--radius-md); font-size: 0.75rem;
        color: var(--color-info); display: flex; align-items: flex-start; gap: 0.375rem;
        .material-symbols-rounded { font-size: 1rem; flex-shrink: 0; }
      }

      /* Timeline */
      .timeline { display: flex; flex-direction: column; }
      .timeline-item { display: flex; gap: var(--space-sm); }

      .timeline-marker { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }

      .timeline-dot {
        width: 0.875rem; height: 0.875rem; border-radius: 50%;
        background: var(--color-primary); margin-top: 0.25rem;
        box-shadow: 0 0 0 3px var(--color-primary-100);
        &.dot-pending { background: var(--color-status-pending); box-shadow: 0 0 0 3px rgba(247, 127, 0, 0.15); }
        &.dot-assigned { background: var(--color-status-assigned); box-shadow: 0 0 0 3px rgba(58, 134, 255, 0.15); }
        &.dot-in_progress { background: var(--color-status-progress); box-shadow: 0 0 0 3px rgba(0, 180, 216, 0.15); }
        &.dot-completed { background: var(--color-success); box-shadow: 0 0 0 3px rgba(6, 167, 125, 0.15); }
        &.dot-cancelled { background: var(--color-status-cancelled); box-shadow: 0 0 0 3px rgba(108, 117, 125, 0.15); }
      }

      .timeline-line { flex: 1; width: 2px; background: var(--color-divider); margin-top: 0.25rem; }

      .timeline-content {
        flex: 1; padding-bottom: var(--space-sm);
        font-size: 0.8125rem; color: var(--color-text-primary);
        strong { font-weight: 700; }
      }

      .timeline-item.last .timeline-content { padding-bottom: 0; }
      .timeline-notes { color: var(--color-text-secondary); }
      .timeline-date { font-size: 0.6875rem; color: var(--color-text-tertiary); margin-top: 0.125rem; }

      /* Status hero */
      .status-hero {
        background: var(--color-primary); color: white;
        border-radius: var(--radius-xl); padding: var(--space-md); text-align: center;
        &.hero-pending { background: #f77f00; }
        &.hero-assigned { background: #3a86ff; }
        &.hero-in_progress { background: #00b4d8; }
        &.hero-completed { background: var(--color-success); }
        &.hero-cancelled { background: #6c757d; }
      }

      .hero-icon {
        width: 3rem; height: 3rem; border-radius: 50%;
        background: rgba(255, 255, 255, 0.18);
        border: 2px solid rgba(255, 255, 255, 0.35);
        display: flex; align-items: center; justify-content: center;
        margin: 0 auto var(--space-xs);
        .material-symbols-rounded { font-size: 1.5rem; color: white; }
      }

      .hero-label {
        font-size: 0.6875rem; font-weight: 600; opacity: 0.85;
        text-transform: uppercase; letter-spacing: 0.8px;
      }

      .hero-status { font-size: 1.25rem; font-weight: 800; margin-top: 0.25rem; }

      .hero-eta {
        display: inline-flex; align-items: center; gap: 0.25rem;
        margin-top: var(--space-xs); padding: 0.25rem 0.75rem;
        background: rgba(255, 255, 255, 0.18); border-radius: var(--radius-pill);
        font-size: 0.75rem; font-weight: 700;
        .material-symbols-rounded { font-size: 0.875rem; }
      }

      .reject-btn {
        margin-top: var(--space-xs); color: var(--color-danger);
        border-color: rgba(230, 57, 70, 0.25);
        &:hover { background: var(--color-danger-light); border-color: var(--color-danger); }
      }

      .offer-sent {
        padding: var(--space-md);
        border-radius: var(--radius-lg);
        background: rgba(6, 167, 125, 0.08);
        border: 1px solid rgba(6, 167, 125, 0.24);
      }

      .offer-sent-icon {
        width: 2.5rem; height: 2.5rem; border-radius: var(--radius-lg);
        display: flex; align-items: center; justify-content: center;
        background: rgba(6, 167, 125, 0.14); color: var(--color-success);
        margin-bottom: var(--space-sm);
      }

      .offer-sent-title {
        color: var(--color-text-primary); font-weight: 800; margin-bottom: 0.25rem;
      }

      .offer-sent-text {
        color: var(--color-text-secondary); font-size: 0.8125rem; line-height: 1.5;
      }

      .offer-summary {
        display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--space-xs); margin-top: var(--space-md);
      }

      .offer-summary div {
        padding: var(--space-sm); border-radius: var(--radius-md);
        background: var(--color-surface);
        border: 1px solid var(--color-divider);
      }

      .offer-summary span {
        display: block; color: var(--color-text-tertiary);
        font-size: 0.625rem; font-weight: 700; text-transform: uppercase;
        letter-spacing: 0.08em; margin-bottom: 0.125rem;
      }

      .offer-summary strong {
        color: var(--color-text-primary); font-size: 0.875rem;
      }

      .form-error {
        display: flex; align-items: center; gap: var(--space-xs);
        margin-bottom: var(--space-sm); padding: var(--space-sm);
        border-radius: var(--radius-md); color: var(--color-danger);
        background: var(--color-danger-light); font-size: 0.8125rem;
        font-weight: 700;
      }

      .payment-note {
        display: flex; gap: var(--space-sm); align-items: flex-start;
        padding: var(--space-md); border-radius: var(--radius-md);
        background: var(--color-surface-alt); color: var(--color-text-secondary);
        .material-symbols-rounded { color: var(--color-primary); font-size: 1.25rem; }
        p { margin: 0; line-height: 1.5; font-size: 0.875rem; }
      }

      /* Cost card */
      .cost-card {
        background: var(--color-success); color: white;
        border-radius: var(--radius-xl); padding: var(--space-md); text-align: center;
      }

      .cost-icon {
        width: 2.75rem; height: 2.75rem; border-radius: var(--radius-lg);
        background: rgba(255, 255, 255, 0.18);
        display: flex; align-items: center; justify-content: center;
        margin: 0 auto var(--space-xs);
        .material-symbols-rounded { font-size: 1.5rem; color: white; }
      }

      .cost-label { font-size: 0.75rem; opacity: 0.9; font-weight: 600; }
      .cost-amount { font-size: 1.75rem; font-weight: 800; margin: 0.25rem 0; letter-spacing: -0.02em; }
      .cost-commission { font-size: 0.75rem; opacity: 0.85; }

      .skeleton-detail { max-width: 50rem; }

      /* Chat */
      .chat-container {
        max-height: 18.75rem; overflow-y: auto;
        padding: var(--space-sm); background: var(--color-surface-alt);
        border-radius: var(--radius-lg); margin-bottom: var(--space-sm);
        display: flex; flex-direction: column; gap: var(--space-xs);
      }

      .chat-empty {
        text-align: center; padding: var(--space-lg) 0;
        color: var(--color-text-tertiary);
        .material-symbols-rounded { font-size: 2.5rem; display: block; margin: 0 auto 0.5rem; }
        p { font-size: 0.8125rem; }
      }

      .chat-bubble {
        max-width: 85%; padding: 0.625rem 0.875rem;
        border-radius: 1rem; font-size: 0.8125rem;
        line-height: 1.5; word-break: break-word;
      }

      .chat-bubble.mine {
        align-self: flex-end; background: var(--color-primary);
        color: #fff; border-bottom-right-radius: 0.25rem;
      }

      .chat-bubble.other {
        align-self: flex-start; background: var(--color-surface);
        color: var(--color-text-primary);
        border: 1px solid var(--color-divider);
        border-bottom-left-radius: 0.25rem;
      }

      .chat-sender {
        font-size: 0.6875rem; font-weight: 700;
        color: var(--color-primary); margin-bottom: 0.125rem;
      }
      .chat-role { font-weight: 400; color: var(--color-text-tertiary); margin-left: 0.25rem; }
      .chat-text { margin: 0; }
      .chat-time { font-size: 0.625rem; margin-top: 0.25rem; opacity: 0.7; text-align: right; }

      .chat-input-row { display: flex; gap: var(--space-xs); align-items: center; }
      .chat-input { flex: 1; }

      .btn-icon {
        width: 2.25rem; height: 2.25rem; padding: 0;
        display: flex; align-items: center; justify-content: center;
        border-radius: var(--radius-lg); flex-shrink: 0;
        .material-symbols-rounded { font-size: 1.25rem; }
      }

      /* ── Tablet (≥576px): larger hero, map ── */
      @media (min-width: 576px) {
        .cat-icon { width: 3.5rem; height: 3.5rem; .material-symbols-rounded { font-size: 1.75rem; } }
        .incident-map { height: 13rem; }
        .hero-icon { width: 3.75rem; height: 3.75rem; .material-symbols-rounded { font-size: 2rem; } }
        .hero-status { font-size: 1.375rem; }
        .cost-amount { font-size: 2rem; }
        .cost-icon { width: 3.25rem; height: 3.25rem; .material-symbols-rounded { font-size: 1.75rem; } }
        .chat-bubble { max-width: 75%; }
        .chat-container { max-height: 22rem; padding: var(--space-md); }
        .evidence { padding: var(--space-md); }
        .btn-icon { width: 2.5rem; height: 2.5rem; }
      }

      /* ── Tablet (≥768px): spacing adjustments ── */
      @media (min-width: 768px) {
        .detail-header { margin-bottom: var(--space-lg); }
        .header-left { gap: var(--space-md); }
        .card-section-header { margin-bottom: var(--space-md); gap: var(--space-sm); }
        .card-section-header .material-symbols-rounded { font-size: 1.375rem; }
        .info-rows { gap: var(--space-sm); }
        .info-row { padding: var(--space-sm) 0; }
        .location-text { padding: var(--space-md); }
        .quote { padding-left: var(--space-md); }
        .evidences { gap: var(--space-md); }
        .timeline-item { gap: var(--space-md); }
        .timeline-content { padding-bottom: var(--space-md); }
        .status-hero { padding: var(--space-lg); }
        .cost-card { padding: var(--space-lg); }
        .chat-container { max-height: 25rem; gap: var(--space-sm); }
        .incident-map { height: 15.625rem; }
      }

      /* ── Desktop (≥1024px): 2-column grid ── */
      @media (min-width: 1024px) {
        .detail-grid { grid-template-columns: 1fr 22.5rem; gap: var(--space-lg); }
        .detail-header { margin-bottom: var(--space-xl); }
        .cat-icon { width: 3.75rem; height: 3.75rem; .material-symbols-rounded { font-size: 2rem; } }
      }
    `,
  ],
})
export class IncidentDetailComponent implements OnInit, OnDestroy, AfterViewChecked {
  incident: Incident | null = null;
  technicians: Technician[] = [];
  selectedTechnician: number | null = null;
  offerCost = 120;
  offerEta = 20;
  offerMessage = 'Podemos atender tu emergencia con tecnico disponible.';
  currentOffer: ServiceOffer | null = null;
  offerSubmitting = false;
  offerError = '';

  // Chat
  chatMessages: ChatMessage[] = [];
  chatInput = '';
  currentUserId = 0;
  private wsSub?: Subscription;
  @ViewChild('chatContainer') chatContainer?: ElementRef;

  // Map
  private map?: google.maps.Map;
  private mapInitialized = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private cdr: ChangeDetectorRef,
    private ws: WebSocketService,
    private auth: AuthService,
  ) {}

  ngAfterViewChecked() {
    if (this.incident && !this.mapInitialized) {
      this.initMap();
    }
  }

  private initMap() {
    const el = document.getElementById('incident-map');
    if (!el || this.mapInitialized) return;
    this.mapInitialized = true;
    const lat = this.incident!.latitude;
    const lng = this.incident!.longitude;
    const pos = { lat, lng };
    this.map = new google.maps.Map(el, {
      center: pos,
      zoom: 15,
      disableDefaultUI: true,
      zoomControl: true,
      mapId: 'incident-map',
    });
    new google.maps.marker.AdvancedMarkerElement({
      map: this.map,
      position: pos,
      title: `Incidente #${this.incident!.id}`,
    });
  }

  ngOnInit() {
    const user = this.auth.getCurrentUser();
    if (user) this.currentUserId = user.id;

    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.api.getIncident(id).subscribe((inc) => {
      this.incident = inc;
      this.cdr.markForCheck();
      this.loadChat(inc.id);
      if (inc.status === 'pending') {
        this.loadMyOffer(inc.id);
      }
    });
    this.api.getTechnicians().subscribe({
      next: (t) => { this.technicians = t; this.cdr.markForCheck(); },
      error: () => { this.technicians = []; this.cdr.markForCheck(); },
    });

    // Listen for incoming chat messages via WebSocket
    this.wsSub = this.ws.notifications$.subscribe((msg: any) => {
      if (msg.type === 'chat_message' && msg.incident_id === id && msg.sender_id !== this.currentUserId) {
        this.chatMessages.push({
          id: 0,
          incident_id: msg.incident_id,
          sender_id: msg.sender_id,
          sender_name: msg.sender_name,
          sender_role: msg.sender_role,
          message: msg.message,
          created_at: new Date().toISOString(),
        });
        this.cdr.markForCheck();
        this.scrollChat();
      }
    });
  }

  ngOnDestroy() {
    this.wsSub?.unsubscribe();
    this.map = undefined;
    this.mapInitialized = false;
  }

  loadChat(incidentId: number) {
    this.api.getChatMessages(incidentId).subscribe({
      next: (msgs) => {
        this.chatMessages = msgs;
        this.cdr.markForCheck();
        this.scrollChat();
      },
      error: () => {},
    });
  }

  loadMyOffer(incidentId: number) {
    this.api.getMyOffer(incidentId).subscribe({
      next: (offer) => {
        this.currentOffer = offer;
        this.cdr.markForCheck();
      },
      error: () => {
        this.currentOffer = null;
        this.cdr.markForCheck();
      },
    });
  }

  sendMessage() {
    if (!this.incident || !this.chatInput.trim()) return;
    const text = this.chatInput.trim();
    this.chatInput = '';
    this.api.sendChatMessage(this.incident.id, text).subscribe({
      next: (msg) => {
        this.chatMessages.push(msg);
        this.cdr.markForCheck();
        this.scrollChat();
      },
    });
  }

  private scrollChat() {
    setTimeout(() => {
      if (this.chatContainer) {
        this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
      }
    }, 50);
  }

  goBack() {
    this.router.navigate(['/incidents']);
  }

  sendOffer() {
    if (!this.incident) return;
    this.offerSubmitting = true;
    this.offerError = '';
    this.cdr.markForCheck();
    this.api
      .createOffer(this.incident.id, {
        cost: this.offerCost,
        estimated_arrival: this.offerEta,
        technician_id: this.selectedTechnician,
        message: this.offerMessage,
      })
      .subscribe({
        next: (offer) => {
          this.currentOffer = offer;
          this.offerSubmitting = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.offerSubmitting = false;
          this.offerError = err?.error?.detail || 'No se pudo enviar la oferta';
          if (this.offerError === 'Ya enviaste una oferta para este incidente') {
            this.loadMyOffer(this.incident!.id);
          }
          this.cdr.markForCheck();
        },
      });
  }

  rejectIncident() {
    if (!this.incident) return;
    this.api.rejectIncident(this.incident.id).subscribe(() => {
      this.router.navigate(['/incidents']);
    });
  }

  updateStatus(status: string) {
    if (!this.incident) return;
    this.api
      .updateIncident(this.incident.id, { status } as any)
      .subscribe((inc) => {
        this.incident = inc;
        this.cdr.markForCheck();
      });
  }

  getCategoryIcon(cat: string): string {
    const icons: Record<string, string> = {
      battery: 'battery_alert',
      tire: 'tire_repair',
      crash: 'car_crash',
      engine: 'settings',
      keys: 'key',
      other: 'help',
      uncertain: 'psychology',
    };
    return icons[cat] || 'help';
  }

  getCategoryLabel(cat: string): string {
    const labels: Record<string, string> = {
      battery: 'Problema de bateria',
      tire: 'Pinchazo de llanta',
      crash: 'Accidente / choque',
      engine: 'Problema de motor',
      keys: 'Problema de llaves',
      other: 'Otro',
      uncertain: 'Sin clasificar',
    };
    return labels[cat] || cat;
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      assigned: 'Asignado',
      in_progress: 'En proceso',
      completed: 'Completado',
      cancelled: 'Cancelado',
    };
    return labels[status] || status;
  }

  getStatusIcon(status: string): string {
    const icons: Record<string, string> = {
      pending: 'schedule',
      assigned: 'handshake',
      in_progress: 'build',
      completed: 'check_circle',
      cancelled: 'cancel',
    };
    return icons[status] || 'help';
  }

  getEvidenceIcon(type: string): string {
    const icons: Record<string, string> = {
      image: 'image',
      audio: 'mic',
      text: 'description',
    };
    return icons[type] || 'attach_file';
  }
}
