import { Component, OnInit, OnDestroy, AfterViewChecked, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { WebSocketService } from '../../services/websocket.service';
import { AuthService } from '../../services/auth.service';
import { Incident, Technician, ChatMessage, ServiceOffer } from '../../models/interfaces';
import { environment } from '../../../environments/environment';
import { AppIconComponent } from '../../shared/app-icon.component';

@Component({
  selector: 'app-incident-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, AppIconComponent],
  template: `
    <div class="animate-reveal space-y-5" *ngIf="incident; else loadingTpl">
      <button (click)="goBack()"
        class="-ml-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-100">
        <app-icon name="arrow_back" [size]="18" />
        Volver a incidentes
      </button>

      <!-- Header -->
      <div class="flex items-start gap-3">
        <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" [ngClass]="catTile(incident.category)">
          <app-icon [name]="getCategoryIcon(incident.category)" [size]="24" />
        </div>
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-mono text-[11px] font-bold tracking-wide text-slate-400">Incidente #{{ incident.id }}</span>
            <span class="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide" [ngClass]="priorityCls(incident.priority)">{{ incident.priority }}</span>
            <span class="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">{{ getStatusLabel(incident.status) }}</span>
          </div>
          <h1 class="mt-0.5 font-display text-2xl font-bold text-slate-900 dark:text-white">{{ getCategoryLabel(incident.category) }}</h1>
          <p class="mt-0.5 inline-flex items-center gap-1 text-sm text-slate-400">
            <app-icon name="schedule" [size]="16" />
            {{ incident.created_at | date: 'dd/MM/yyyy HH:mm' }}
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <!-- Main column -->
        <div class="space-y-5 lg:col-span-2">
          <!-- AI Analysis -->
          <div [ngClass]="cardCls">
            <div [ngClass]="cardHeadCls"><app-icon name="auto_awesome" class="text-slate-700 dark:text-white" /><h3 [ngClass]="cardTitleCls">Análisis de IA</h3></div>
            <div class="space-y-3">
              <div class="flex flex-col gap-0.5 border-b border-slate-100 pb-3 last:border-0 last:pb-0 dark:border-hero-line/60">
                <span class="text-xs font-semibold uppercase tracking-wide text-slate-400">Categoría</span>
                <span class="text-sm text-slate-700 dark:text-slate-200">{{ getCategoryLabel(incident.category) }}</span>
              </div>
              <div class="flex flex-col gap-0.5 border-b border-slate-100 pb-3 last:border-0 last:pb-0 dark:border-hero-line/60" *ngIf="incident.ai_summary">
                <span class="text-xs font-semibold uppercase tracking-wide text-slate-400">Resumen</span>
                <span class="text-sm text-slate-700 dark:text-slate-200">{{ incident.ai_summary }}</span>
              </div>
              <div class="flex flex-col gap-0.5" *ngIf="incident.ai_diagnosis">
                <span class="text-xs font-semibold uppercase tracking-wide text-slate-400">Diagnóstico</span>
                <span class="text-sm text-slate-700 dark:text-slate-200">{{ incident.ai_diagnosis }}</span>
              </div>
            </div>
          </div>

          <!-- Location -->
          <div [ngClass]="cardCls">
            <div [ngClass]="cardHeadCls"><app-icon name="location_on" class="text-emergency-500" /><h3 [ngClass]="cardTitleCls">Ubicación</h3></div>
            <p class="text-sm text-slate-600 dark:text-slate-300">
              {{ incident.address || 'Lat: ' + incident.latitude + ', Lng: ' + incident.longitude }}
            </p>
            <div class="mt-3 flex items-center gap-2 rounded-xl bg-slate-100 dark:bg-white/8 px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white" *ngIf="trackingActive">
              <app-icon name="my_location" class="animate-pulse" />
              <span>Técnico en camino<span *ngIf="etaText"> · ETA {{ etaText }}</span></span>
            </div>
            <div id="incident-map" class="mt-3 h-72 w-full overflow-hidden rounded-xl border border-slate-200 dark:border-hero-line"></div>
          </div>

          <!-- User description -->
          <div [ngClass]="cardCls" *ngIf="incident.description">
            <div [ngClass]="cardHeadCls"><app-icon name="format_quote" class="text-slate-400" /><h3 [ngClass]="cardTitleCls">Descripción del usuario</h3></div>
            <p class="border-l-4 border-slate-300 dark:border-white/20 pl-4 text-sm italic text-slate-600 dark:text-slate-300">{{ incident.description }}</p>
          </div>

          <!-- Evidences -->
          <div [ngClass]="cardCls" *ngIf="incident.evidences.length > 0">
            <div [ngClass]="cardHeadCls"><app-icon name="collections" class="text-info" /><h3 [ngClass]="cardTitleCls">Evidencias ({{ incident.evidences.length }})</h3></div>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div class="rounded-xl border border-slate-200 p-3 dark:border-hero-line" *ngFor="let ev of incident.evidences">
                <span class="mb-2 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold uppercase text-slate-600 dark:bg-white/10 dark:text-slate-300">
                  <app-icon [name]="getEvidenceIcon(ev.type)" [size]="14" />{{ ev.type }}
                </span>
                <img *ngIf="ev.type === 'image' && ev.file_url" [src]="apiBaseUrl + ev.file_url" alt="Evidencia" class="w-full rounded-lg">
                <p *ngIf="ev.type === 'audio' && ev.transcription" class="text-sm text-slate-600 dark:text-slate-300"><strong>Transcripción:</strong> {{ ev.transcription }}</p>
                <p *ngIf="ev.type === 'text'" class="text-sm text-slate-600 dark:text-slate-300">{{ ev.content }}</p>
                <div class="mt-2 flex items-start gap-1.5 rounded-lg bg-slate-50 dark:bg-white/5 p-2 text-xs text-slate-900 dark:text-white" *ngIf="ev.ai_analysis">
                  <app-icon name="psychology" [size]="16" /><span>{{ ev.ai_analysis }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Status timeline -->
          <div [ngClass]="cardCls">
            <div [ngClass]="cardHeadCls"><app-icon name="history" class="text-slate-400" /><h3 [ngClass]="cardTitleCls">Historial de estados</h3></div>
            <div class="space-y-0">
              <div class="relative flex gap-3 pb-5 last:pb-0" *ngFor="let h of incident.status_history; let last = last">
                <div class="flex flex-col items-center">
                  <div class="mt-1 h-3 w-3 shrink-0 rounded-full ring-4" [ngClass]="timelineDotCls(h.status)"></div>
                  <div class="mt-1 w-px flex-1 bg-slate-200 dark:bg-hero-line" *ngIf="!last"></div>
                </div>
                <div class="-mt-0.5 pb-1">
                  <strong class="text-sm font-semibold text-slate-800 dark:text-slate-100">{{ getStatusLabel(h.status) }}</strong>
                  <span *ngIf="h.notes" class="text-sm text-slate-500 dark:text-slate-400"> — {{ h.notes }}</span>
                  <div class="text-xs text-slate-400">{{ h.created_at | date: 'dd/MM/yyyy HH:mm' }} · {{ h.changed_by }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Chat -->
          <div [ngClass]="cardCls" *ngIf="incident.status !== 'pending' && incident.status !== 'cancelled'">
            <div [ngClass]="cardHeadCls"><app-icon name="chat" class="text-slate-700 dark:text-white" /><h3 [ngClass]="cardTitleCls">Chat con el cliente</h3></div>
            <div #chatContainer class="max-h-96 space-y-3 overflow-y-auto rounded-xl bg-slate-50 p-4 dark:bg-white/5">
              <div class="flex flex-col items-center gap-2 py-8 text-slate-400" *ngIf="chatMessages.length === 0">
                <app-icon name="forum" [size]="30" />
                <p class="text-sm">No hay mensajes aún. Inicia la conversación.</p>
              </div>
              <div *ngFor="let msg of chatMessages" class="flex flex-col" [ngClass]="msg.sender_id === currentUserId ? 'items-end' : 'items-start'">
                <div class="max-w-[80%] rounded-2xl px-3.5 py-2"
                     [ngClass]="msg.sender_id === currentUserId ? 'bg-[#111111] dark:bg-white text-white' : 'bg-white text-slate-700 shadow-sm dark:bg-hero-soft dark:text-slate-200'">
                  <div class="mb-0.5 flex items-center gap-1.5 text-[11px] font-bold" *ngIf="msg.sender_id !== currentUserId">
                    {{ msg.sender_name }}
                    <span class="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-slate-500 dark:bg-white/10 dark:text-slate-400">{{ msg.sender_role === 'client' ? 'Cliente' : 'Taller' }}</span>
                  </div>
                  <div class="text-sm">{{ msg.message }}</div>
                  <div class="mt-0.5 text-[10px]" [ngClass]="msg.sender_id === currentUserId ? 'text-white/70' : 'text-slate-400'">{{ msg.created_at | date: 'HH:mm' }}</div>
                </div>
              </div>
            </div>
            <div class="mt-3 flex gap-2">
              <input type="text" [(ngModel)]="chatInput" (keydown.enter)="sendMessage()" placeholder="Escribe un mensaje..."
                class="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-900 dark:border-white/60 focus:bg-white dark:focus:bg-white/10 focus:ring-2 focus:ring-slate-900 dark:ring-white/20 dark:border-hero-line dark:bg-white/5 dark:text-slate-200">
              <button (click)="sendMessage()" [disabled]="!chatInput.trim()"
                class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#111111] dark:bg-white text-white shadow-[0_2px_12px_rgba(0,0,0,0.12)] transition hover:bg-slate-800 dark:hover:bg-white/90 disabled:opacity-50">
                <app-icon name="send" />
              </button>
            </div>
          </div>
        </div>

        <!-- Side panel -->
        <div class="space-y-5">
          <!-- Status hero -->
          <div class="overflow-hidden rounded-2xl p-6 text-center text-white shadow-card" [ngClass]="statusHeroCls(incident.status)">
            <div class="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20">
              <app-icon [name]="getStatusIcon(incident.status)" [size]="28" />
            </div>
            <div class="text-xs font-semibold uppercase tracking-wide text-white/70">Estado actual</div>
            <div class="font-display text-xl font-bold">{{ getStatusLabel(incident.status) }}</div>
            <div class="mt-1 inline-flex items-center gap-1 text-sm text-white/90" *ngIf="incident.estimated_arrival">
              <app-icon name="timer" [size]="16" /> ETA {{ incident.estimated_arrival }} min
            </div>
          </div>

          <!-- Pending: offer/reject — talleres y admin -->
          <div [ngClass]="cardCls" *ngIf="incident.status === 'pending' && (isWorkshop || isAdmin)">
            <!-- Taller: panel completo de oferta -->
            <ng-container *ngIf="isWorkshop">
              <div [ngClass]="cardHeadCls"><app-icon name="local_offer" class="text-slate-700 dark:text-white" /><h3 [ngClass]="cardTitleCls">{{ currentOffer ? 'Oferta enviada' : 'Enviar oferta' }}</h3></div>

              <div class="text-center" *ngIf="currentOffer; else offerFormTpl">
                <div class="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
                  <app-icon name="check_circle" />
                </div>
                <div class="font-semibold text-slate-800 dark:text-slate-100">Tu oferta ya fue enviada al cliente</div>
                <div class="mt-1 text-sm text-slate-500 dark:text-slate-400">El cliente la verá en la app móvil y podrá aceptarla o compararla con otras ofertas.</div>
                <div class="mt-4 grid grid-cols-3 gap-2 text-left">
                  <div class="rounded-lg bg-slate-50 p-2.5 dark:bg-white/5"><span class="block text-[11px] text-slate-400">Costo</span><strong class="text-sm text-slate-900 dark:text-white">Bs. {{ currentOffer.cost | number: '1.2-2' }}</strong></div>
                  <div class="rounded-lg bg-slate-50 p-2.5 dark:bg-white/5"><span class="block text-[11px] text-slate-400">ETA</span><strong class="text-sm text-slate-900 dark:text-white">{{ currentOffer.estimated_arrival }} min</strong></div>
                  <div class="rounded-lg bg-slate-50 p-2.5 dark:bg-white/5" *ngIf="currentOffer.technician_name"><span class="block text-[11px] text-slate-400">Técnico</span><strong class="text-sm text-slate-900 dark:text-white">{{ currentOffer.technician_name }}</strong></div>
                </div>
              </div>

              <ng-template #offerFormTpl>
                <div class="space-y-3">
                  <div>
                    <label [ngClass]="labelCls">Asignar técnico (opcional)</label>
                    <select [(ngModel)]="selectedTechnician" [disabled]="offerSubmitting" [ngClass]="fieldCls" class="cursor-pointer">
                      <option [ngValue]="null">Sin asignar</option>
                      <option *ngFor="let t of technicians" [ngValue]="t.id">{{ t.name }}</option>
                    </select>
                  </div>
                  <div>
                    <label [ngClass]="labelCls">Costo ofertado (Bs.)</label>
                    <input type="number" [(ngModel)]="offerCost" min="1" [disabled]="offerSubmitting" [ngClass]="fieldCls" />
                  </div>
                  <div>
                    <label [ngClass]="labelCls">Tiempo estimado de llegada (min)</label>
                    <input type="number" [(ngModel)]="offerEta" min="1" [disabled]="offerSubmitting" [ngClass]="fieldCls" />
                  </div>
                  <div>
                    <label [ngClass]="labelCls">Mensaje para el cliente</label>
                    <textarea [(ngModel)]="offerMessage" rows="3" [disabled]="offerSubmitting" [ngClass]="fieldCls" class="resize-y"></textarea>
                  </div>
                  <div class="flex items-center gap-2 rounded-xl bg-emergency-500/10 px-3 py-2 text-sm font-semibold text-emergency-600 dark:text-emergency-300" *ngIf="offerError">
                    <app-icon name="error" /> {{ offerError }}
                  </div>
                  <button (click)="sendOffer()" [disabled]="offerSubmitting"
                    class="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-success px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50">
                    <app-icon [name]="offerSubmitting ? 'progress_activity' : 'send'" [size]="18" />
                    {{ offerSubmitting ? 'Enviando oferta...' : 'Enviar oferta al cliente' }}
                  </button>
                </div>
              </ng-template>
            </ng-container>

            <!-- Admin: solo cabecera de gestión -->
            <div [ngClass]="cardHeadCls" *ngIf="isAdmin"><app-icon name="admin_panel_settings" class="text-slate-700 dark:text-white" /><h3 [ngClass]="cardTitleCls">Gestión de incidente</h3></div>

            <button (click)="rejectIncident()" [disabled]="offerSubmitting || (!!currentOffer && !isAdmin)"
              class="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-hero-line dark:text-slate-300 dark:hover:bg-white/5">
              <app-icon name="close" [size]="18" /> Rechazar
            </button>
          </div>

          <!-- Assigned/in_progress: update -->
          <div [ngClass]="cardCls" *ngIf="incident.status === 'assigned' || incident.status === 'in_progress'">
            <div [ngClass]="cardHeadCls"><app-icon name="build" class="text-slate-700 dark:text-white" /><h3 [ngClass]="cardTitleCls">Actualizar estado</h3></div>
            <button *ngIf="incident.status === 'assigned'" (click)="updateStatus('in_progress')"
              class="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#111111] dark:bg-white dark:text-[#111111] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_2px_12px_rgba(0,0,0,0.12)] transition hover:brightness-110">
              <app-icon name="play_arrow" [size]="18" /> Iniciar servicio
            </button>
            <div *ngIf="incident.status === 'in_progress'" class="flex items-start gap-2 rounded-xl bg-info/10 p-3 text-sm text-info">
              <app-icon name="info" [size]="18" />
              <p>El cierre y el pago los realiza el cliente desde la app móvil. El monto queda fijado por la oferta aceptada.</p>
            </div>
            <button *ngIf="isAdmin" (click)="rejectIncident()" [disabled]="offerSubmitting"
              class="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emergency-200 px-4 py-2.5 text-sm font-semibold text-emergency-600 transition hover:bg-emergency-50 disabled:opacity-50 dark:border-emergency-500/30 dark:text-emergency-300 dark:hover:bg-emergency-500/10">
              <app-icon name="undo" [size]="18" /> Regresar a pendiente
            </button>
          </div>

          <!-- Final cost -->
          <div class="rounded-2xl border border-success/30 bg-success/5 p-6 text-center" *ngIf="incident.final_cost">
            <div class="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-success/15 text-success">
              <app-icon name="payments" />
            </div>
            <div class="text-xs font-semibold uppercase tracking-wide text-slate-400">Costo del servicio</div>
            <div class="font-display text-2xl font-bold text-slate-900 dark:text-white">Bs. {{ incident.final_cost | number: '1.2-2' }}</div>
            <div class="mt-1 text-sm text-slate-500 dark:text-slate-400">Comisión (10%): Bs. {{ incident.commission_amount | number: '1.2-2' }}</div>
          </div>
        </div>
      </div>
    </div>

    <ng-template #loadingTpl>
      <div class="animate-pulse space-y-4">
        <div class="h-14 rounded-2xl bg-slate-200 dark:bg-white/10"></div>
        <div class="h-52 rounded-2xl bg-slate-200 dark:bg-white/10"></div>
        <div class="h-32 rounded-2xl bg-slate-200 dark:bg-white/10"></div>
      </div>
    </ng-template>
  `,
})
export class IncidentDetailComponent implements OnInit, OnDestroy, AfterViewChecked {
  apiBaseUrl = environment.apiUrl.replace(/\/api$/, '');
  incident: Incident | null = null;
  isWorkshop = false;
  isAdmin = false;
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
  private techMarker?: google.maps.marker.AdvancedMarkerElement;
  private routeLine?: google.maps.Polyline;
  private directionsRenderer?: google.maps.DirectionsRenderer;
  trackingActive = false;
  etaText = '';

  // Clases Tailwind reutilizables (mantienen el template legible).
  readonly cardCls = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-card dark:border-hero-line dark:bg-hero-soft';
  readonly cardHeadCls = 'mb-4 flex items-center gap-2';
  readonly cardTitleCls = 'font-display text-base font-bold text-slate-900 dark:text-white';
  readonly labelCls = 'mb-1.5 block text-sm font-semibold text-slate-600 dark:text-slate-300';
  readonly fieldCls = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-900 dark:border-white/60 focus:bg-white dark:focus:bg-white/10 focus:ring-2 focus:ring-slate-900 dark:ring-white/20 disabled:opacity-60 dark:border-hero-line dark:bg-white/5 dark:text-slate-200';

  catTile(cat: string): string {
    const map: Record<string, string> = {
      battery: 'bg-amber-400/15 text-amber-600 dark:text-amber-300',
      tire: 'bg-info/10 text-info',
      crash: 'bg-emergency-500/15 text-emergency-600 dark:text-emergency-300',
      engine: 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300',
      keys: 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white',
    };
    return map[cat] || 'bg-slate-100 dark:bg-white/8 text-slate-900 dark:text-white';
  }

  priorityCls(priority: string): string {
    const map: Record<string, string> = {
      critical: 'bg-emergency-500/15 text-emergency-600 dark:text-emergency-300',
      high: 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white',
      medium: 'bg-amber-400/15 text-amber-600 dark:text-amber-300',
      low: 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300',
    };
    return map[priority] || map['low'];
  }

  timelineDotCls(status: string): string {
    const map: Record<string, string> = {
      pending: 'bg-[#111111] dark:bg-white ring-black/8 dark:ring-white/10',
      assigned: 'bg-info ring-info/15',
      in_progress: 'bg-amber-400 ring-amber-400/15',
      completed: 'bg-success ring-success/15',
      cancelled: 'bg-slate-400 ring-slate-400/15',
    };
    return map[status] || map['pending'];
  }

  statusHeroCls(status: string): string {
    const map: Record<string, string> = {
      pending: 'bg-slate-700 dark:bg-white/20',
      assigned: 'bg-gradient-to-br from-info to-blue-700',
      in_progress: 'bg-amber-600 dark:bg-amber-500',
      completed: 'bg-gradient-to-br from-success to-emerald-700',
      cancelled: 'bg-gradient-to-br from-slate-500 to-slate-700',
    };
    return map[status] || map['pending'];
  }

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

    // Si el tecnico ya compartio ubicacion, dibujar tracking inicial.
    const tlat = this.incident!.technician_latitude;
    const tlng = this.incident!.technician_longitude;
    if (tlat != null && tlng != null && this.isActiveStatus()) {
      this.updateTechnicianTracking(tlat, tlng);
    }
  }

  private isActiveStatus(): boolean {
    return this.incident?.status === 'assigned' || this.incident?.status === 'in_progress';
  }

  /** Actualiza el marcador del tecnico, la ruta y el ETA hacia el incidente. */
  private updateTechnicianTracking(lat: number, lng: number) {
    if (!this.map || !this.incident) return;
    const techPos = { lat, lng };
    const dest = { lat: this.incident.latitude, lng: this.incident.longitude };
    this.trackingActive = true;

    // Marcador del tecnico (pin azul).
    if (this.techMarker) {
      this.techMarker.position = techPos;
    } else {
      const pin = document.createElement('div');
      pin.title = 'Tecnico';
      pin.style.cssText = 'width:18px;height:18px;border-radius:50%;background:#1E88E5;border:3px solid #fff;box-shadow:0 0 0 2px #1E88E5;';
      this.techMarker = new google.maps.marker.AdvancedMarkerElement({
        map: this.map, position: techPos, content: pin, title: 'Tecnico',
      });
    }

    // ETA por distancia (fallback inmediato).
    const km = this.haversineKm(lat, lng, dest.lat, dest.lng);
    this.etaText = `${Math.max(1, Math.round((km / 30) * 60))} min`;

    // Intentar ruta real con Directions; si falla, linea recta.
    try {
      const svc = new google.maps.DirectionsService();
      svc.route(
        { origin: techPos, destination: dest, travelMode: google.maps.TravelMode.DRIVING },
        (res, status) => {
          if (status === 'OK' && res) {
            this.clearStraightLine();
            if (!this.directionsRenderer) {
              this.directionsRenderer = new google.maps.DirectionsRenderer({ map: this.map, suppressMarkers: true, preserveViewport: true });
            }
            this.directionsRenderer.setDirections(res);
            const leg = res.routes?.[0]?.legs?.[0];
            if (leg?.duration?.text) this.etaText = leg.duration.text;
            this.cdr.markForCheck();
          } else {
            this.drawStraightLine(techPos, dest);
          }
        },
      );
    } catch {
      this.drawStraightLine(techPos, dest);
    }
    this.cdr.markForCheck();
  }

  private drawStraightLine(from: google.maps.LatLngLiteral, to: google.maps.LatLngLiteral) {
    if (!this.map) return;
    if (this.routeLine) {
      this.routeLine.setPath([from, to]);
    } else {
      this.routeLine = new google.maps.Polyline({
        path: [from, to], map: this.map, strokeColor: '#1E88E5', strokeWeight: 4, strokeOpacity: 0.85,
      });
    }
  }

  private clearStraightLine() {
    this.routeLine?.setMap(null);
    this.routeLine = undefined;
  }

  private haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const r = 6371, toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  ngOnInit() {
    const user = this.auth.getCurrentUser();
    if (user) {
      this.currentUserId = user.id;
      this.isWorkshop = user.role === 'workshop';
      this.isAdmin = user.role === 'admin';
    }

    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.loadIncident(id);
    if (this.isWorkshop) {
      this.api.getTechnicians().subscribe({
        next: (t) => { this.technicians = t; this.cdr.markForCheck(); },
        error: () => { this.technicians = []; this.cdr.markForCheck(); },
      });
    }

    this.ws.connect();
    // Listen for incoming chat messages, live technician tracking, y cambios
    // de estado/oferta via WebSocket, para no depender de refrescar la pagina.
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
      if (msg.type === 'technician_location_update' && msg.incident_id === id && msg.latitude != null && msg.longitude != null) {
        if (this.incident) {
          this.incident.technician_latitude = msg.latitude;
          this.incident.technician_longitude = msg.longitude;
        }
        this.updateTechnicianTracking(msg.latitude, msg.longitude);
      }
      if (
        ['status_update', 'incident_assigned', 'new_offer', 'offer_accepted'].includes(msg.type) &&
        (msg.incident_id === id || msg.incident_id === undefined)
      ) {
        this.loadIncident(id);
      }
    });
  }

  private loadIncident(id: number): void {
    this.api.getIncident(id).subscribe((inc) => {
      this.incident = inc;
      this.cdr.markForCheck();
      this.loadChat(inc.id);
      if (inc.status === 'pending' && this.isWorkshop) {
        this.loadMyOffer(inc.id);
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
