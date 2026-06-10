import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, registerables } from 'chart.js';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { MetricsSummary, Workshop } from '../../models/interfaces';
import { AppIconComponent } from '../../shared/app-icon.component';

Chart.register(...registerables);

const CATEGORY_ES: Record<string, string> = {
  BATTERY: 'Batería', TIRE: 'Llanta', CRASH: 'Choque', ENGINE: 'Motor',
  KEYS: 'Llaves', OTHER: 'Otro', UNCERTAIN: 'Sin clasificar',
};
const STATUS_ES: Record<string, string> = {
  PENDING: 'Pendiente', ASSIGNED: 'Asignado', IN_PROGRESS: 'En progreso',
  COMPLETED: 'Completado', CANCELLED: 'Cancelado',
};

@Component({
  selector: 'app-kpis',
  standalone: true,
  imports: [CommonModule, FormsModule, AppIconComponent],
  template: `
    <div class="animate-reveal space-y-6" *ngIf="m; else loadingTpl">

      <!-- ── Header ── -->
      <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div class="space-y-2">
          <!-- Badge — mismo estilo que dashboard -->
          <div class="inline-flex items-center gap-2 rounded-lg border border-slate-200/60 bg-white px-3 py-1.5 shadow-sm dark:border-white/8 dark:bg-white/5">
            <div class="flex h-4 w-4 items-center justify-center text-violet-500">
              <app-icon name="insights" [size]="14" />
            </div>
            <span class="font-mono text-[0.65rem] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-white/50">Indicadores</span>
            <span class="h-3.5 w-px bg-slate-200 dark:bg-white/10"></span>
            <span class="font-mono text-[0.65rem] text-slate-400 dark:text-white/30">{{ m!.scope === 'global' ? 'Plataforma' : 'Taller' }}</span>
          </div>
          <h1 class="font-display text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            KPIs&nbsp;<span class="text-slate-400 dark:text-white/40">/ rendimiento</span>
          </h1>
          <p class="text-sm text-slate-400 dark:text-white/35">Métricas clave de atención de emergencias.</p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <!-- Filtro de taller (solo admin) -->
          <div *ngIf="isAdmin"
               class="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-white/8 dark:bg-hero-soft">
            <app-icon name="filter_alt" [size]="18" class="text-slate-400 dark:text-white/40" />
            <select [(ngModel)]="selectedTenant" (ngModelChange)="load()" aria-label="Filtrar por taller"
                    class="max-w-[200px] cursor-pointer border-0 bg-transparent text-sm font-semibold text-slate-700 outline-none dark:bg-hero-soft dark:text-white dark:[color-scheme:dark]">
              <option [ngValue]="null">Toda la plataforma</option>
              <option *ngFor="let w of workshops" [ngValue]="w.tenant_id">{{ w.name }}</option>
            </select>
          </div>
          <button (click)="load()"
                  class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/8 dark:bg-hero-soft dark:text-slate-300 dark:hover:bg-white/8">
            <app-icon name="refresh" [size]="18" /> Actualizar
          </button>
        </div>
      </header>

      <!-- ── Tarjetas KPI — mismo diseño que dashboard ── -->
      <section class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div *ngFor="let k of kpiCards()"
             class="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card transition hover:-translate-y-1 hover:shadow-card-hover dark:border-white/8 dark:bg-hero-soft">
          <!-- Barra izquierda de acento -->
          <div class="absolute left-0 top-0 h-full w-[3px] rounded-l-2xl" [ngClass]="k.accentBar"></div>
          <!-- Glow blob -->
          <span class="absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-20 blur-xl transition-all duration-500 group-hover:scale-125 group-hover:opacity-30"
                [ngClass]="k.glow"></span>
          <div class="p-5">
            <div class="flex h-11 w-11 items-center justify-center rounded-xl" [ngClass]="k.tile">
              <app-icon [name]="k.icon" [size]="22" />
            </div>
            <div class="mt-4">
              <div class="font-display mt-1 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                {{ k.value }}<small *ngIf="k.unit" class="ml-1 text-base font-semibold text-slate-400">{{ k.unit }}</small>
              </div>
              <div class="font-mono mt-1 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-white/30">{{ k.label }}</div>
            </div>
          </div>
        </div>
      </section>

      <!-- ── Gráficos ── -->
      <section class="grid grid-cols-1 gap-4 lg:grid-cols-2">

        <!-- Barras: categorías -->
        <div class="rounded-2xl border border-slate-200 bg-white shadow-card dark:border-white/8 dark:bg-hero-soft">
          <div class="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4 dark:border-white/6">
            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
              <app-icon name="bar_chart" [size]="18" />
            </div>
            <h3 class="font-display text-sm font-bold text-slate-900 dark:text-white">Incidentes por categoría</h3>
          </div>
          <div class="p-5">
            <div class="relative h-60"><canvas id="ry-cat-chart"></canvas></div>
          </div>
        </div>

        <!-- Dona: estados -->
        <div class="rounded-2xl border border-slate-200 bg-white shadow-card dark:border-white/8 dark:bg-hero-soft">
          <div class="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4 dark:border-white/6">
            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-emergency-500/10 text-emergency-600 dark:bg-emergency-500/15 dark:text-emergency-400">
              <app-icon name="donut_large" [size]="18" />
            </div>
            <h3 class="font-display text-sm font-bold text-slate-900 dark:text-white">Distribución por estado</h3>
          </div>
          <div class="p-5">
            <div class="relative h-60"><canvas id="ry-status-chart"></canvas></div>
          </div>
        </div>

        <!-- Talleres más eficientes -->
        <div class="rounded-2xl border border-slate-200 bg-white shadow-card dark:border-white/8 dark:bg-hero-soft">
          <div class="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4 dark:border-white/6">
            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400/15 text-amber-600 dark:bg-amber-400/20 dark:text-amber-400">
              <app-icon name="workspace_premium" [size]="18" />
            </div>
            <h3 class="font-display text-sm font-bold text-slate-900 dark:text-white">Talleres más eficientes</h3>
          </div>
          <div class="overflow-x-auto p-5 pt-0">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400 dark:border-white/6">
                  <th class="py-3 pr-2 font-bold">Taller</th>
                  <th class="py-3 px-2 font-bold">Compl.</th>
                  <th class="py-3 px-2 font-bold">Rating</th>
                  <th class="py-3 pl-2 font-bold">Prom. atención</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-white/5">
                <tr *ngFor="let w of m!.top_workshops; let odd = odd"
                    class="transition hover:bg-slate-50 dark:hover:bg-white/4"
                    [class.bg-slate-50]="odd" [class.dark:bg-white/2]="odd">
                  <td class="py-2.5 pr-2 font-semibold text-slate-700 dark:text-slate-200">{{ w.workshop_name }}</td>
                  <td class="py-2.5 px-2">
                    <span class="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">{{ w.completed }}</span>
                  </td>
                  <td class="py-2.5 px-2">
                    <span class="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                      <app-icon name="star" [size]="13" />
                      {{ w.rating }}
                    </span>
                  </td>
                  <td class="py-2.5 pl-2 text-slate-500 dark:text-slate-400">{{ w.avg_completion_min != null ? w.avg_completion_min + ' min' : '—' }}</td>
                </tr>
                <tr *ngIf="m!.top_workshops.length === 0">
                  <td colspan="4" class="py-6 text-center text-sm text-slate-400">Sin datos aún</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Zonas -->
        <div class="rounded-2xl border border-slate-200 bg-white shadow-card dark:border-white/8 dark:bg-hero-soft">
          <div class="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4 dark:border-white/6">
            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-emergency-500/10 text-emergency-600 dark:bg-emergency-500/15 dark:text-emergency-400">
              <app-icon name="location_on" [size]="18" />
            </div>
            <h3 class="font-display text-sm font-bold text-slate-900 dark:text-white">Zonas con más incidencias</h3>
          </div>
          <div class="overflow-x-auto p-5 pt-0">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400 dark:border-white/6">
                  <th class="py-3 pr-4 font-bold">Zona / Barrio</th>
                  <th class="py-3 pl-2 font-bold">Incidencias</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-white/5">
                <tr *ngFor="let z of m!.zones; let i = index" class="transition hover:bg-slate-50 dark:hover:bg-white/4">
                  <td class="py-2.5 pr-4">
                    <div class="flex items-center gap-2">
                      <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded font-mono text-[9px] font-black text-white"
                            [ngClass]="i === 0 ? 'bg-emergency-500' : i === 1 ? 'bg-blue-500' : i === 2 ? 'bg-violet-500' : 'bg-slate-400'">
                        {{ i + 1 }}
                      </span>
                      <span class="text-sm font-medium text-slate-700 dark:text-slate-200">{{ z.zone }}</span>
                    </div>
                  </td>
                  <td class="py-2.5 pl-2">
                    <span class="rounded-md bg-blue-500/10 px-2 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">{{ z.count }}</span>
                  </td>
                </tr>
                <tr *ngIf="m!.zones.length === 0">
                  <td colspan="2" class="py-6 text-center text-sm text-slate-400">Sin datos aún</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- ── Motivos de cancelación ── -->
      <section *ngIf="m!.cancelled.reasons.length"
               class="rounded-2xl border border-slate-200 bg-white shadow-card dark:border-white/8 dark:bg-hero-soft">
        <div class="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4 dark:border-white/6">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-emergency-500/10 text-emergency-600 dark:bg-emergency-500/15 dark:text-emergency-400">
            <app-icon name="cancel" [size]="18" />
          </div>
          <h3 class="font-display text-sm font-bold text-slate-900 dark:text-white">Motivos de cancelación</h3>
        </div>
        <div class="flex flex-wrap gap-2 p-5">
          <span *ngFor="let r of m!.cancelled.reasons"
                class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-white/8 dark:bg-white/4 dark:text-slate-300">
            {{ r.reason }}
            <b class="rounded-md bg-emergency-500/10 px-1.5 py-0.5 text-xs font-black text-emergency-600 dark:bg-emergency-500/20 dark:text-emergency-400">{{ r.count }}</b>
          </span>
        </div>
      </section>
    </div>

    <ng-template #loadingTpl>
      <div class="flex items-center justify-center gap-2 py-24 text-sm text-slate-400">
        <app-icon name="progress_activity" class="animate-spin" />
        Cargando indicadores...
      </div>
    </ng-template>
  `,
})
export class KpisComponent implements OnInit, OnDestroy {
  m: MetricsSummary | null = null;
  isAdmin = false;
  workshops: Workshop[] = [];
  selectedTenant: number | null = null;

  private catChart?: Chart;
  private statusChart?: Chart;

  constructor(private api: ApiService, private auth: AuthService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.isAdmin = this.auth.getCurrentUser()?.role === 'admin';
    // Solo el admin puede ver/filtrar por taller (la lista es endpoint admin-only).
    if (this.isAdmin) {
      this.api.getWorkshops().subscribe({ next: (ws) => { this.workshops = ws.filter((w) => w.tenant_id != null); } });
    }
    this.load();
  }

  load(): void {
    // Para admin, selectedTenant=null => global; un id => KPIs de ese taller.
    const params = this.isAdmin && this.selectedTenant != null ? { tenant_id: this.selectedTenant } : undefined;
    this.api.getMetricsSummary(params).subscribe({
      next: (data) => {
        this.m = data;
        // detectChanges() fuerza a Angular a procesar el *ngIf y crear los <canvas>
        // en el DOM ANTES de que intentemos dibujar los gráficos.
        this.cdr.detectChanges();
        this.renderCharts();
      },
    });
  }

  private renderCharts(): void {
    if (!this.m) return;
    const catEl    = document.getElementById('ry-cat-chart')    as HTMLCanvasElement | null;
    const statusEl = document.getElementById('ry-status-chart') as HTMLCanvasElement | null;

    // Paleta semántica — igual que el dashboard para coherencia visual
    const catPalette = ['#3B82F6', '#E63946', '#8B5CF6', '#10B981', '#F59E0B', '#64748B', '#14b8a6'];
    // Estado: pending=amber, assigned=blue, in_progress=violet, completed=emerald, cancelled=red
    const statusPalette = ['#F59E0B', '#3B82F6', '#8B5CF6', '#10B981', '#E63946'];

    const tooltipDefaults = {
      backgroundColor: '#1e293b',
      titleColor: '#94a3b8',
      bodyColor: '#f8fafc',
      padding: 10,
      cornerRadius: 8,
    };

    if (catEl) {
      this.catChart?.destroy();
      const cats = this.m.incidents_by_category;
      if (cats.length) {
        this.catChart = new Chart(catEl, {
          type: 'bar',
          data: {
            labels: cats.map((c) => this.tCat(c.category)),
            datasets: [{
              label: 'Incidentes',
              data: cats.map((c) => c.count),
              // Cada categoría recibe un color diferente del catPalette
              backgroundColor: cats.map((_, i) => catPalette[i % catPalette.length]),
              borderRadius: 8,
              maxBarThickness: 44,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: tooltipDefaults,
            },
            scales: {
              x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 11 } } },
              y: {
                beginAtZero: true,
                ticks: { color: '#94a3b8', precision: 0, font: { size: 11 } },
                grid: { color: 'rgba(148,163,184,0.10)' },
                border: { dash: [4, 4] },
              },
            },
          },
        });
      } else {
        const ctx = catEl.getContext('2d');
        if (ctx) { ctx.fillStyle = '#94a3b8'; ctx.font = '14px sans-serif'; ctx.fillText('Sin datos aún', 10, 30); }
      }
    }

    if (statusEl) {
      this.statusChart?.destroy();
      const st = this.m.status_breakdown;
      if (st.length) {
        this.statusChart = new Chart(statusEl, {
          type: 'doughnut',
          data: {
            labels: st.map((s) => this.tStatus(s.status)),
            datasets: [{
              data: st.map((s) => s.count),
              backgroundColor: st.map((_, i) => statusPalette[i % statusPalette.length]),
              borderWidth: 2,
              borderColor: 'transparent',
              hoverBorderColor: '#ffffff20',
              hoverOffset: 6,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
              legend: {
                position: 'bottom',
                labels: {
                  color: '#94a3b8',
                  boxWidth: 10,
                  boxHeight: 10,
                  padding: 16,
                  usePointStyle: true,
                  pointStyleWidth: 10,
                  font: { size: 11 },
                },
              },
              tooltip: tooltipDefaults,
            },
          },
        });
      } else {
        const ctx = statusEl.getContext('2d');
        if (ctx) { ctx.fillStyle = '#94a3b8'; ctx.font = '14px sans-serif'; ctx.fillText('Sin datos aún', 10, 30); }
      }
    }
  }

  /** KPI cards con acento cromático por tipo — mismo sistema de diseño que dashboard. */
  kpiCards() {
    if (!this.m) return [];
    return [
      {
        label: 'Tiempo prom. asignación', icon: 'schedule', unit: 'min',
        value: this.m.avg_assignment_min ?? '—',
        tile: 'bg-amber-400/15 text-amber-600 dark:text-amber-400',
        glow: 'bg-amber-400',
        accentBar: 'bg-amber-400',
      },
      {
        label: 'Tiempo prom. llegada', icon: 'local_shipping', unit: 'min',
        value: this.m.avg_arrival_min ?? '—',
        tile: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
        glow: 'bg-blue-500',
        accentBar: 'bg-blue-500',
      },
      {
        label: 'Cumplimiento de SLA', icon: 'verified', unit: '',
        value: this.pct(this.m.sla.compliance_rate),
        tile: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
        glow: 'bg-emerald-500',
        accentBar: 'bg-emerald-500',
      },
      {
        label: 'Tasa cancelación (' + this.m.cancelled.cancelled + ')',
        icon: 'cancel', unit: '',
        value: this.pct(this.m.cancelled.cancellation_rate),
        tile: 'bg-emergency-500/15 text-emergency-600 dark:text-emergency-300',
        glow: 'bg-emergency-500',
        accentBar: 'bg-emergency-500',
      },
    ];
  }

  tCat(v: string): string { return CATEGORY_ES[(v || '').toUpperCase()] ?? v; }
  tStatus(v: string): string { return STATUS_ES[(v || '').toUpperCase()] ?? v; }
  pct(rate: number | null): string { return rate == null ? '—' : Math.round(rate * 100) + '%'; }

  ngOnDestroy(): void { this.catChart?.destroy(); this.statusChart?.destroy(); }
}
