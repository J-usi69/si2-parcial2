import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { WebSocketService } from '../../services/websocket.service';
import { Incident } from '../../models/interfaces';
import { AppIconComponent } from '../../shared/app-icon.component';

@Component({
  selector: 'app-incidents',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, AppIconComponent],
  template: `
    <div class="animate-reveal space-y-6">

      <!-- ── Header operacional ── -->
      <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div class="space-y-2">
          <!-- Badge ops — punto rojo pulsante + conteo live -->
          <div class="inline-flex items-center gap-2 rounded-lg border border-slate-200/60 bg-white px-3 py-1.5 shadow-sm dark:border-white/8 dark:bg-white/5">
            <span class="relative flex h-2 w-2">
              <span class="absolute inline-flex h-full w-full animate-beacon rounded-full bg-emergency-400 opacity-75"></span>
              <span class="relative inline-flex h-2 w-2 rounded-full bg-emergency-500"></span>
            </span>
            <span class="font-mono text-[0.65rem] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-white/50">Operaciones</span>
            <span class="h-3.5 w-px bg-slate-200 dark:bg-white/10"></span>
            <span class="font-mono text-[0.65rem] font-bold text-emergency-500">{{ pendingCount }} pendientes</span>
          </div>
          <h1 class="font-display text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Solicitudes&nbsp;<span class="text-slate-400 dark:text-white/40">/ emergencia</span>
          </h1>
          <p class="font-mono text-[0.7rem] text-slate-400 dark:text-white/30">
            {{ filteredIncidents.length }}&nbsp;de&nbsp;{{ incidents.length }}&nbsp;incidentes
          </p>
        </div>
      </header>

      <!-- ── Error banner ── -->
      <div *ngIf="error && !loading"
           class="flex flex-wrap items-center gap-3 rounded-2xl border border-emergency-200 bg-emergency-50 px-4 py-3 text-sm text-emergency-700 dark:border-emergency-500/30 dark:bg-emergency-500/10 dark:text-emergency-300">
        <app-icon name="cloud_off" />
        <span>No se pudo cargar los incidentes</span>
        <button (click)="loadData()"
                class="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-emergency-300 px-3 py-1.5 text-xs font-semibold transition hover:bg-emergency-100 dark:border-emergency-500/40 dark:hover:bg-emergency-500/20">
          <app-icon name="refresh" [size]="16" /> Reintentar
        </button>
      </div>

      <!-- ── Barra de filtros ── -->
      <div class="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white shadow-card dark:border-white/8 dark:bg-hero-soft">
        <!-- Fila principal: búsqueda + selects -->
        <div class="flex flex-col gap-3 p-4 md:flex-row md:items-center">
          <!-- Search -->
          <div class="relative flex-1">
            <app-icon name="search" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/30" />
            <input type="text" [(ngModel)]="searchTerm" (input)="applyFilter()"
                   placeholder="Buscar por descripción, ID, dirección…"
                   class="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm text-slate-700 outline-none transition
                          focus:border-slate-400 focus:bg-white dark:focus:bg-white/10 focus:ring-2 focus:ring-black/8
                          dark:border-white/8 dark:bg-white/5 dark:text-white dark:placeholder:text-white/25
                          dark:focus:border-white/30 dark:focus:ring-white/8" />
          </div>

          <!-- Selects group -->
          <div class="flex flex-wrap items-center gap-2">
            <!-- Estado -->
            <div class="relative">
              <app-icon name="filter_alt" [size]="16" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/30" />
              <select [(ngModel)]="filterStatus" (change)="applyFilter()"
                      class="h-10 cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-8 text-sm font-medium text-slate-700 outline-none transition
                             hover:border-slate-300 focus:border-slate-400 focus:ring-2 focus:ring-black/8
                             dark:border-white/8 dark:bg-white/5 dark:text-white dark:[color-scheme:dark]
                             dark:hover:border-white/15 dark:focus:border-white/30 dark:focus:ring-white/8">
                <option value="">Todos los estados</option>
                <option value="pending">Pendientes</option>
                <option value="assigned">Asignados</option>
                <option value="in_progress">En proceso</option>
                <option value="completed">Completados</option>
                <option value="cancelled">Cancelados</option>
              </select>
            </div>

            <!-- Categoría -->
            <div class="relative">
              <app-icon name="category" [size]="16" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/30" />
              <select [(ngModel)]="filterCategory" (change)="applyFilter()"
                      class="h-10 cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-8 text-sm font-medium text-slate-700 outline-none transition
                             hover:border-slate-300 focus:border-slate-400 focus:ring-2 focus:ring-black/8
                             dark:border-white/8 dark:bg-white/5 dark:text-white dark:[color-scheme:dark]
                             dark:hover:border-white/15 dark:focus:border-white/30 dark:focus:ring-white/8">
                <option value="">Todas las categorías</option>
                <option value="battery">Batería</option>
                <option value="tire">Llanta</option>
                <option value="crash">Choque</option>
                <option value="engine">Motor</option>
                <option value="keys">Llaves</option>
                <option value="other">Otro</option>
              </select>
            </div>

            <!-- Limpiar -->
            <button *ngIf="hasFilters()" (click)="clearFilters()"
                    class="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-500 transition hover:bg-slate-50 dark:border-white/8 dark:text-white/40 dark:hover:bg-white/6 dark:hover:text-white">
              <app-icon name="close" [size]="16" />
              Limpiar
            </button>
          </div>
        </div>

        <!-- Chips de filtros activos -->
        <div *ngIf="hasFilters()" class="flex flex-wrap gap-2 border-t border-slate-100 px-4 pb-3 pt-2 dark:border-white/6">
          <span *ngIf="filterStatus"
                class="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
            Estado: {{ getStatusLabel(filterStatus) }}
            <button (click)="filterStatus=''; applyFilter()" class="text-slate-400 hover:text-slate-700 dark:hover:text-white">
              <app-icon name="close" [size]="12" />
            </button>
          </span>
          <span *ngIf="filterCategory"
                class="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
            Cat: {{ getCategoryLabel(filterCategory) }}
            <button (click)="filterCategory=''; applyFilter()" class="text-slate-400 hover:text-slate-700 dark:hover:text-white">
              <app-icon name="close" [size]="12" />
            </button>
          </span>
          <span *ngIf="searchTerm"
                class="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60">
            "{{ searchTerm }}"
            <button (click)="searchTerm=''; applyFilter()" class="text-slate-400 hover:text-slate-700 dark:hover:text-white">
              <app-icon name="close" [size]="12" />
            </button>
          </span>
        </div>
      </div>

      <!-- ── Grid de incidentes ── -->
      <div *ngIf="filteredIncidents.length > 0; else emptyTpl"
           class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <a *ngFor="let inc of filteredIncidents" [routerLink]="['/incidents', inc.id]"
           class="group relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-card transition hover:-translate-y-1 hover:shadow-card-hover dark:bg-hero-soft"
           [ngClass]="cardBorderCls(inc.priority)">

          <!-- Barra izquierda de prioridad -->
          <div class="absolute left-0 top-0 h-full w-[3px] rounded-l-2xl"
               [ngClass]="priorityAccentBar(inc.priority)"></div>

          <!-- Tinte de fondo para críticos -->
          <div *ngIf="inc.priority === 'critical'"
               class="pointer-events-none absolute inset-0 bg-emergency-500/[0.03] dark:bg-emergency-500/[0.06]"></div>

          <div class="flex flex-1 flex-col p-5 pl-[1.4rem]">
            <!-- Top row: icon + priority badge -->
            <div class="mb-3 flex items-start justify-between">
              <div class="flex h-10 w-10 items-center justify-center rounded-xl" [ngClass]="catTile(inc.category)">
                <app-icon [name]="getCategoryIcon(inc.category)" [size]="20" />
              </div>
              <span class="rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em]"
                    [ngClass]="priorityCls(inc.priority)">
                {{ inc.priority }}
              </span>
            </div>

            <!-- Body -->
            <div class="flex-1">
              <div class="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/25">#{{ inc.id }}</div>
              <h3 class="mt-0.5 font-display text-[0.925rem] font-bold leading-snug text-slate-900 dark:text-white">
                {{ getCategoryLabel(inc.category) }}
              </h3>
              <p class="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {{ inc.ai_summary || inc.description || 'Sin descripción' }}
              </p>
            </div>
          </div>

          <!-- Footer: estado + timestamp -->
          <div class="flex items-center justify-between border-t px-5 py-3 pl-[1.4rem]"
               [ngClass]="inc.priority === 'critical' ? 'border-emergency-100 dark:border-emergency-500/15' : 'border-slate-100 dark:border-white/6'">
            <!-- Estado con dot -->
            <span class="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold"
                  [ngClass]="statusCls(inc.status)">
              <span class="h-1.5 w-1.5 shrink-0 rounded-full" [ngClass]="statusDotCls(inc.status)"></span>
              {{ getStatusLabel(inc.status) }}
            </span>
            <!-- Timestamp -->
            <span class="inline-flex items-center gap-1 font-mono text-[10px] text-slate-400 dark:text-white/25">
              <app-icon name="schedule" [size]="12" />
              {{ inc.created_at | date: 'dd/MM HH:mm' }}
            </span>
          </div>
        </a>
      </div>

      <!-- ── Estado vacío ── -->
      <ng-template #emptyTpl>
        <div class="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white py-20 text-center shadow-card dark:border-white/8 dark:bg-hero-soft">
          <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-white/5">
            <app-icon name="search_off" [size]="32" />
          </div>
          <div>
            <h3 class="font-display text-base font-bold text-slate-700 dark:text-slate-200">Sin resultados</h3>
            <p class="mt-1 text-sm text-slate-400" *ngIf="hasFilters()">Prueba ajustando los filtros de búsqueda.</p>
            <p class="mt-1 text-sm text-slate-400" *ngIf="!hasFilters()">Aún no hay solicitudes registradas.</p>
          </div>
          <button *ngIf="hasFilters()" (click)="clearFilters()"
                  class="inline-flex items-center gap-1.5 rounded-xl bg-[#111111] dark:bg-white px-4 py-2 text-sm font-semibold text-white transition hover:opacity-80 dark:text-[#111111]">
            <app-icon name="refresh" [size]="16" />
            Limpiar filtros
          </button>
        </div>
      </ng-template>

    </div>
  `,
})
export class IncidentsComponent implements OnInit, OnDestroy {
  incidents: Incident[] = [];
  filteredIncidents: Incident[] = [];
  filterStatus = '';
  filterCategory = '';
  searchTerm = '';
  loading = true;
  error = false;
  private wsSub?: Subscription;

  constructor(
    private api: ApiService,
    private ws: WebSocketService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.loadData();
    this.ws.connect();
    this.wsSub = this.ws.notifications$.subscribe((message) => {
      if (
        ['new_incident', 'invitation', 'status_update', 'incident_assigned', 'new_offer', 'offer_accepted'].includes(
          message.type,
        )
      ) {
        this.loadData(false);
      }
    });
  }

  ngOnDestroy() {
    this.wsSub?.unsubscribe();
  }

  loadData(showLoading = true) {
    if (showLoading) this.loading = true;
    this.error = false;
    this.api.getIncidents().subscribe({
      next: (data) => {
        this.incidents = data;
        this.applyFilter();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.error = true;
        this.cdr.markForCheck();
      },
    });
  }

  applyFilter() {
    const term = this.searchTerm.trim().toLowerCase();
    this.filteredIncidents = this.incidents.filter((i) => {
      if (this.filterStatus && i.status !== this.filterStatus) return false;
      if (this.filterCategory && i.category !== this.filterCategory)
        return false;
      if (term) {
        const haystack = [
          String(i.id),
          i.description || '',
          i.ai_summary || '',
          i.address || '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }

  hasFilters(): boolean {
    return !!(this.filterStatus || this.filterCategory || this.searchTerm);
  }

  clearFilters() {
    this.filterStatus = '';
    this.filterCategory = '';
    this.searchTerm = '';
    this.applyFilter();
  }

  get pendingCount(): number {
    return this.incidents.filter(i => i.status === 'pending').length;
  }

  /** Borde exterior de la card según prioridad */
  cardBorderCls(priority: string): string {
    const map: Record<string, string> = {
      critical: 'border-emergency-200 dark:border-emergency-500/30',
      high:     'border-orange-200  dark:border-orange-500/25',
      medium:   'border-amber-200   dark:border-amber-400/20',
      low:      'border-slate-200   dark:border-white/8',
    };
    return map[priority] || map['low'];
  }

  /** Barra izquierda de acento por prioridad */
  priorityAccentBar(priority: string): string {
    const map: Record<string, string> = {
      critical: 'bg-emergency-500',
      high:     'bg-orange-500',
      medium:   'bg-amber-400',
      low:      'bg-slate-300 dark:bg-slate-600',
    };
    return map[priority] || map['low'];
  }

  /** Colores del badge de estado con dot */
  statusCls(status: string): string {
    const map: Record<string, string> = {
      pending:     'bg-amber-400/12 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
      assigned:    'bg-blue-500/12 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
      in_progress: 'bg-violet-500/12 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
      completed:   'bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
      cancelled:   'bg-slate-100 text-slate-500 dark:bg-white/8 dark:text-slate-400',
    };
    return map[status] || map['pending'];
  }

  /** Dot de color dentro del badge de estado */
  statusDotCls(status: string): string {
    const map: Record<string, string> = {
      pending:     'bg-amber-400',
      assigned:    'bg-blue-500',
      in_progress: 'bg-violet-500',
      completed:   'bg-emerald-500',
      cancelled:   'bg-slate-400',
    };
    return map[status] || 'bg-slate-400';
  }

  catTile(cat: string): string {
    const map: Record<string, string> = {
      battery: 'bg-amber-400/15 text-amber-600 dark:text-amber-400',
      tire:    'bg-blue-500/15 text-blue-600 dark:text-blue-400',
      crash:   'bg-emergency-500/15 text-emergency-600 dark:text-emergency-400',
      engine:  'bg-violet-500/15 text-violet-600 dark:text-violet-400',
      keys:    'bg-slate-100 text-slate-600 dark:bg-white/8 dark:text-slate-300',
    };
    return map[cat] || 'bg-slate-100 dark:bg-white/8 text-slate-600 dark:text-slate-300';
  }

  priorityCls(priority: string): string {
    const map: Record<string, string> = {
      critical: 'bg-emergency-500/15 text-emergency-700 dark:bg-emergency-500/20 dark:text-emergency-300',
      high:     'bg-orange-500/15 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
      medium:   'bg-amber-400/15 text-amber-700 dark:bg-amber-400/20 dark:text-amber-300',
      low:      'bg-slate-100 text-slate-600 dark:bg-white/8 dark:text-slate-400',
    };
    return map[priority] || map['low'];
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
}
