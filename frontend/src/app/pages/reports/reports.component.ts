import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);
import { ApiService } from '../../services/api.service';
import { Incident, Payment } from '../../models/interfaces';
import { AppIconComponent } from '../../shared/app-icon.component';

interface MonthData {
  label: string;
  incidents: number;
  completed: number;
  revenue: number;
  commission: number;
}

interface CategoryStat {
  name: string;
  icon: string;
  count: number;
  pct: number;
  cssClass: string;
}

interface TechStat {
  name: string;
  completed: number;
  avgTime: string;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, AppIconComponent],
  template: `
    <div class="animate-reveal space-y-6" *ngIf="!loading; else loadingTpl">
      <!-- Header -->
      <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div class="space-y-1">
          <h1 class="font-display text-3xl font-bold text-slate-900 dark:text-white">Reportes</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400">Análisis y métricas de tu taller</p>
        </div>
        <div class="flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-hero-line dark:bg-hero-soft">
          <app-icon name="calendar_today" [size]="18" class="text-slate-400" />
          <select [(ngModel)]="selectedPeriod" (ngModelChange)="onPeriodChange()"
                  class="cursor-pointer border-0 bg-transparent text-sm font-semibold text-slate-700 outline-none dark:bg-hero-soft dark:text-slate-200 dark:[color-scheme:dark]">
            <option value="7">Últimos 7 días</option>
            <option value="30">Últimos 30 días</option>
            <option value="90">Últimos 3 meses</option>
            <option value="365">Último año</option>
            <option value="0">Todo</option>
          </select>
        </div>
      </header>

      <!-- KPI Cards -->
      <section class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-card transition hover:-translate-y-1 hover:shadow-card-hover dark:border-hero-line dark:bg-hero-soft">
          <div class="flex items-center gap-3">
            <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-info/10 text-info"><app-icon name="assignment" [size]="22" /></div>
            <div class="min-w-0 flex-1">
              <span class="block truncate font-mono text-xl font-bold text-slate-900 dark:text-white">{{ filteredIncidents.length }}</span>
              <span class="text-xs font-semibold uppercase tracking-wide text-slate-400">Total Incidentes</span>
            </div>
            <span class="inline-flex items-center gap-0.5 rounded-md px-2 py-1 text-xs font-bold"
                  [ngClass]="incidentsTrend >= 0 ? 'bg-success/10 text-success' : 'bg-emergency-500/10 text-emergency-500'">
              <app-icon [name]="incidentsTrend >= 0 ? 'trending_up' : 'trending_down'" [size]="16" />
              {{ incidentsTrend | number:'1.0-0' }}%
            </span>
          </div>
        </div>

        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-card transition hover:-translate-y-1 hover:shadow-card-hover dark:border-hero-line dark:bg-hero-soft">
          <div class="flex items-center gap-3">
            <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-success/10 text-success"><app-icon name="check_circle" [size]="22" /></div>
            <div class="min-w-0 flex-1">
              <span class="block truncate font-mono text-xl font-bold text-slate-900 dark:text-white">{{ completedCount }}</span>
              <span class="text-xs font-semibold uppercase tracking-wide text-slate-400">Completados</span>
            </div>
            <span class="whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500 dark:bg-white/5 dark:text-slate-400">{{ completionRate | number:'1.0-0' }}% tasa</span>
          </div>
        </div>

        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-card transition hover:-translate-y-1 hover:shadow-card-hover dark:border-hero-line dark:bg-hero-soft">
          <div class="flex items-center gap-3">
            <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/8 text-slate-900 dark:text-white"><app-icon name="payments" [size]="22" /></div>
            <div class="min-w-0 flex-1">
              <span class="block truncate font-mono text-xl font-bold text-slate-900 dark:text-white">Bs {{ totalRevenue | number:'1.2-2' }}</span>
              <span class="text-xs font-semibold uppercase tracking-wide text-slate-400">Ingresos</span>
            </div>
            <span class="inline-flex items-center gap-0.5 rounded-md px-2 py-1 text-xs font-bold"
                  [ngClass]="revenueTrend >= 0 ? 'bg-success/10 text-success' : 'bg-emergency-500/10 text-emergency-500'">
              <app-icon [name]="revenueTrend >= 0 ? 'trending_up' : 'trending_down'" [size]="16" />
              {{ revenueTrend | number:'1.0-0' }}%
            </span>
          </div>
        </div>

        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-card transition hover:-translate-y-1 hover:shadow-card-hover dark:border-hero-line dark:bg-hero-soft">
          <div class="flex items-center gap-3">
            <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-emergency-500/10 text-emergency-600 dark:text-emergency-300"><app-icon name="receipt_long" [size]="22" /></div>
            <div class="min-w-0 flex-1">
              <span class="block truncate font-mono text-xl font-bold text-slate-900 dark:text-white">Bs {{ totalCommission | number:'1.2-2' }}</span>
              <span class="text-xs font-semibold uppercase tracking-wide text-slate-400">Comisión plataforma</span>
            </div>
            <span class="whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500 dark:bg-white/5 dark:text-slate-400">Neto: Bs {{ totalRevenue - totalCommission | number:'1.0-0' }}</span>
          </div>
        </div>
      </section>

      <!-- Charts row (Chart.js) -->
      <section class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-card dark:border-hero-line dark:bg-hero-soft">
          <div class="mb-4 flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/8 text-slate-900 dark:text-white"><app-icon name="show_chart" /></div>
            <div>
              <h3 class="font-display text-base font-bold text-slate-900 dark:text-white">Tendencia Mensual</h3>
              <p class="text-xs text-slate-400">Incidentes por mes</p>
            </div>
          </div>
          <div class="relative h-64" *ngIf="monthlyData.length > 0; else noDataTpl"><canvas id="rep-monthly"></canvas></div>
          <ng-template #noDataTpl>
            <div class="flex h-64 flex-col items-center justify-center gap-2 text-slate-400">
              <app-icon name="bar_chart" [size]="36" /><p class="text-sm">Sin datos para este periodo</p>
            </div>
          </ng-template>
        </div>

        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-card dark:border-hero-line dark:bg-hero-soft">
          <div class="mb-4 flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-emergency-500/10 text-emergency-600 dark:text-emergency-300"><app-icon name="account_balance_wallet" /></div>
            <div>
              <h3 class="font-display text-base font-bold text-slate-900 dark:text-white">Ingresos Mensuales</h3>
              <p class="text-xs text-slate-400">Ingresos vs comisiones</p>
            </div>
          </div>
          <div class="relative h-64" *ngIf="monthlyData.length > 0; else noRevenueTpl"><canvas id="rep-revenue"></canvas></div>
          <ng-template #noRevenueTpl>
            <div class="flex h-64 flex-col items-center justify-center gap-2 text-slate-400">
              <app-icon name="payments" [size]="36" /><p class="text-sm">Sin ingresos en este periodo</p>
            </div>
          </ng-template>
        </div>
      </section>

      <!-- Bottom row -->
      <section class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <!-- Categories -->
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-card dark:border-hero-line dark:bg-hero-soft">
          <div class="mb-4 flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-info/10 text-info"><app-icon name="category" /></div>
            <div>
              <h3 class="font-display text-base font-bold text-slate-900 dark:text-white">Por Categoría</h3>
              <p class="text-xs text-slate-400">Distribución de incidentes</p>
            </div>
          </div>
          <div class="space-y-3" *ngIf="categoryStats.length > 0; else noCatsTpl">
            <div class="flex items-center gap-3" *ngFor="let cat of categoryStats">
              <div class="flex h-8 w-8 items-center justify-center rounded-lg" [ngClass]="catTile(cat.cssClass)">
                <app-icon [name]="cat.icon" [size]="18" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex justify-between text-sm">
                  <span class="font-medium text-slate-700 dark:text-slate-200">{{ cat.name }}</span>
                  <span class="font-mono font-bold text-slate-500 dark:text-slate-400">{{ cat.count }}</span>
                </div>
                <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                  <div class="h-full rounded-full" [ngClass]="catBar(cat.cssClass)" [style.width.%]="cat.pct"></div>
                </div>
              </div>
              <span class="w-10 text-right font-mono text-xs font-bold text-slate-400">{{ cat.pct | number:'1.0-0' }}%</span>
            </div>
          </div>
          <ng-template #noCatsTpl>
            <div class="flex flex-col items-center gap-2 py-8 text-slate-400"><app-icon name="category" [size]="30" /><p class="text-sm">Sin datos</p></div>
          </ng-template>
        </div>

        <!-- Status -->
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-card dark:border-hero-line dark:bg-hero-soft">
          <div class="mb-4 flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 text-success"><app-icon name="donut_small" /></div>
            <div>
              <h3 class="font-display text-base font-bold text-slate-900 dark:text-white">Por Estado</h3>
              <p class="text-xs text-slate-400">Estado actual de incidentes</p>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div *ngFor="let s of statusStats" class="flex flex-col items-center gap-1 rounded-xl bg-slate-50 p-3 dark:bg-white/5">
              <div class="flex h-12 w-12 items-center justify-center rounded-full border-[3px]" [ngClass]="statusRing(s.key)">
                <span class="font-mono text-base font-bold text-slate-900 dark:text-white">{{ s.count }}</span>
              </div>
              <span class="text-xs font-medium capitalize text-slate-700 dark:text-slate-200">{{ s.label }}</span>
              <span class="font-mono text-[11px] font-bold text-slate-400">{{ s.pct | number:'1.0-0' }}%</span>
            </div>
          </div>
        </div>

        <!-- Technicians -->
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-card dark:border-hero-line dark:bg-hero-soft">
          <div class="mb-4 flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300"><app-icon name="engineering" /></div>
            <div>
              <h3 class="font-display text-base font-bold text-slate-900 dark:text-white">Técnicos</h3>
              <p class="text-xs text-slate-400">Rendimiento por técnico</p>
            </div>
          </div>
          <div class="space-y-2" *ngIf="techStats.length > 0; else noTechTpl">
            <div class="flex items-center gap-3" *ngFor="let t of techStats; let i = index">
              <span class="w-6 text-center font-mono text-sm font-bold text-slate-400">{{ i + 1 }}</span>
              <div class="min-w-0">
                <span class="block truncate text-sm font-medium text-slate-700 dark:text-slate-200">{{ t.name }}</span>
                <span class="text-xs text-slate-400">{{ t.completed }} completados</span>
              </div>
              <div class="ml-auto h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                <div class="h-full rounded-full bg-[#111111] dark:bg-white dark:text-[#111111]" [style.width.%]="techStats.length > 0 ? (t.completed / techStats[0].completed * 100) : 0"></div>
              </div>
            </div>
          </div>
          <ng-template #noTechTpl>
            <div class="flex flex-col items-center gap-2 py-8 text-slate-400"><app-icon name="engineering" [size]="30" /><p class="text-sm">Sin datos de técnicos</p></div>
          </ng-template>
        </div>
      </section>

      <!-- Priority breakdown -->
      <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-card dark:border-hero-line dark:bg-hero-soft">
        <div class="mb-4 flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-emergency-500/10 text-emergency-600 dark:text-emergency-300"><app-icon name="priority_high" /></div>
          <div>
            <h3 class="font-display text-base font-bold text-slate-900 dark:text-white">Por Prioridad</h3>
            <p class="text-xs text-slate-400">Distribución de prioridades</p>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div class="flex flex-col items-center gap-2" *ngFor="let p of priorityStats">
            <div class="w-full rounded-xl p-4 text-center" [ngClass]="priorityBadge(p.key)">
              <span class="block font-mono text-2xl font-bold text-slate-900 dark:text-white">{{ p.count }}</span>
              <span class="text-[11px] font-bold uppercase tracking-wide" [ngClass]="priorityLabel(p.key)">{{ p.label }}</span>
            </div>
            <div class="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
              <div class="h-full rounded-full" [ngClass]="priorityFill(p.key)" [style.width.%]="p.pct"></div>
            </div>
            <span class="font-mono text-xs font-bold text-slate-400">{{ p.pct | number:'1.0-0' }}%</span>
          </div>
        </div>
      </section>
    </div>

    <ng-template #loadingTpl>
      <div class="flex flex-col items-center justify-center gap-3 py-24 text-slate-400">
        <app-icon name="progress_activity" [size]="30" class="animate-spin" />
        <p class="text-sm">Generando reportes...</p>
      </div>
    </ng-template>
  `,
})
export class ReportsComponent implements OnInit, OnDestroy {
  loading = true;
  selectedPeriod = '30';
  private monthlyChart?: Chart;
  private revenueChart?: Chart;

  allIncidents: Incident[] = [];
  allPayments: Payment[] = [];
  filteredIncidents: Incident[] = [];
  filteredPayments: Payment[] = [];

  completedCount = 0;
  completionRate = 0;
  totalRevenue = 0;
  totalCommission = 0;
  incidentsTrend = 0;
  revenueTrend = 0;

  monthlyData: MonthData[] = [];
  maxMonthIncidents = 1;
  maxMonthRevenue = 1;

  categoryStats: CategoryStat[] = [];
  statusStats: { key: string; label: string; count: number; pct: number }[] = [];
  priorityStats: { key: string; label: string; count: number; pct: number }[] = [];
  techStats: TechStat[] = [];

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.loadData();
  }

  ngOnDestroy() {
    this.monthlyChart?.destroy();
    this.revenueChart?.destroy();
  }

  loadData() {
    this.loading = true;
    let loaded = 0;
    const checkDone = () => {
      loaded++;
      if (loaded >= 2) {
        this.loading = false;
        this.applyFilters();
        this.cdr.markForCheck();
      }
    };

    this.api.getIncidents().subscribe({
      next: (data) => { this.allIncidents = data; checkDone(); },
      error: () => { this.allIncidents = []; checkDone(); }
    });

    this.api.getPayments().subscribe({
      next: (data) => { this.allPayments = data; checkDone(); },
      error: () => { this.allPayments = []; checkDone(); }
    });
  }

  onPeriodChange() {
    this.applyFilters();
    this.cdr.markForCheck();
  }

  applyFilters() {
    const days = parseInt(this.selectedPeriod);
    const now = new Date();

    if (days > 0) {
      const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      this.filteredIncidents = this.allIncidents.filter(i => new Date(i.created_at) >= cutoff);
      this.filteredPayments = this.allPayments.filter(p => new Date(p.created_at) >= cutoff);
    } else {
      this.filteredIncidents = [...this.allIncidents];
      this.filteredPayments = [...this.allPayments];
    }

    this.computeKPIs();
    this.computeMonthly();
    this.computeCategories();
    this.computeStatuses();
    this.computePriorities();
    this.computeTechs();
    this.renderCharts();
  }

  // ── Chart.js (sustituye las barras dibujadas con CSS) ──
  private renderCharts() {
    this.cdr.detectChanges();
    this.renderMonthlyChart();
    this.renderRevenueChart();
  }

  private renderMonthlyChart() {
    const el = document.getElementById('rep-monthly') as HTMLCanvasElement | null;
    if (!el) return;
    this.monthlyChart?.destroy();
    this.monthlyChart = new Chart(el, {
      type: 'bar',
      data: {
        labels: this.monthlyData.map((m) => m.label),
        datasets: [
          { label: 'Completados', data: this.monthlyData.map((m) => m.completed), backgroundColor: '#0fad73', borderRadius: 6, stack: 'a' },
          { label: 'Otros', data: this.monthlyData.map((m) => m.incidents - m.completed), backgroundColor: '#cbd5e1', borderRadius: 6, stack: 'a' },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', boxWidth: 12, usePointStyle: true, padding: 14 } } },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { color: '#94a3b8' } },
          y: { stacked: true, beginAtZero: true, ticks: { color: '#94a3b8', precision: 0 }, grid: { color: 'rgba(148,163,184,0.15)' } },
        },
      },
    });
  }

  private renderRevenueChart() {
    const el = document.getElementById('rep-revenue') as HTMLCanvasElement | null;
    if (!el) return;
    this.revenueChart?.destroy();
    this.revenueChart = new Chart(el, {
      type: 'bar',
      data: {
        labels: this.monthlyData.map((m) => m.label),
        datasets: [
          { label: 'Ingresos', data: this.monthlyData.map((m) => m.revenue), backgroundColor: '#FFFFFF', borderRadius: 6 },
          { label: 'Comisión', data: this.monthlyData.map((m) => m.commission), backgroundColor: '#E63946', borderRadius: 6 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', boxWidth: 12, usePointStyle: true, padding: 14 } } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
          y: { beginAtZero: true, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.15)' } },
        },
      },
    });
  }

  // ── Helpers de clase para badges/anillos (sustituyen al CSS por estado) ──
  catTile(css: string): string {
    const map: Record<string, string> = {
      'cat-battery': 'bg-amber-400/15 text-amber-600 dark:text-amber-300',
      'cat-tire': 'bg-info/10 text-info',
      'cat-crash': 'bg-emergency-500/15 text-emergency-600 dark:text-emergency-300',
      'cat-engine': 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300',
      'cat-keys': 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white',
      'cat-other': 'bg-slate-100 dark:bg-white/8 text-slate-900 dark:text-white',
    };
    return map[css] || map['cat-other'];
  }

  catBar(css: string): string {
    const map: Record<string, string> = {
      'cat-battery': 'bg-amber-400', 'cat-tire': 'bg-info', 'cat-crash': 'bg-emergency-500',
      'cat-engine': 'bg-slate-400', 'cat-keys': 'bg-[#111111] dark:bg-white', 'cat-other': 'bg-[#111111] dark:bg-white',
    };
    return map[css] || 'bg-[#111111] dark:bg-white';
  }

  statusRing(key: string): string {
    const map: Record<string, string> = {
      pending: 'border-slate-900 dark:border-white/60 bg-slate-50 dark:bg-white/5',
      assigned: 'border-info bg-info/5',
      in_progress: 'border-amber-400 bg-amber-400/5',
      completed: 'border-success bg-success/5',
      cancelled: 'border-slate-300 bg-slate-100 dark:bg-white/5',
    };
    return map[key] || 'border-slate-300';
  }

  priorityBadge(key: string): string {
    const map: Record<string, string> = {
      low: 'bg-success/10', medium: 'bg-amber-400/10', high: 'bg-emergency-500/10', critical: 'bg-emergency-700/15',
    };
    return map[key] || 'bg-slate-100';
  }

  priorityLabel(key: string): string {
    const map: Record<string, string> = {
      low: 'text-success', medium: 'text-amber-600 dark:text-amber-300',
      high: 'text-emergency-600 dark:text-emergency-300', critical: 'text-emergency-700 dark:text-emergency-400',
    };
    return map[key] || 'text-slate-500';
  }

  priorityFill(key: string): string {
    const map: Record<string, string> = {
      low: 'bg-success', medium: 'bg-amber-400', high: 'bg-emergency-500', critical: 'bg-emergency-700',
    };
    return map[key] || 'bg-slate-400';
  }

  computeKPIs() {
    const fi = this.filteredIncidents;
    this.completedCount = fi.filter(i => i.status === 'completed').length;
    this.completionRate = fi.length > 0 ? (this.completedCount / fi.length * 100) : 0;
    this.totalRevenue = fi.reduce((s, i) => s + (i.final_cost || 0), 0);
    this.totalCommission = fi.reduce((s, i) => s + (i.commission_amount || 0), 0);

    // Trends: compare current half vs previous half of period
    const days = parseInt(this.selectedPeriod);
    if (days > 0 && fi.length > 0) {
      const now = new Date();
      const midpoint = new Date(now.getTime() - (days / 2) * 24 * 60 * 60 * 1000);
      const recent = fi.filter(i => new Date(i.created_at) >= midpoint).length;
      const older = fi.filter(i => new Date(i.created_at) < midpoint).length;
      this.incidentsTrend = older > 0 ? ((recent - older) / older * 100) : (recent > 0 ? 100 : 0);

      const recentRev = fi.filter(i => new Date(i.created_at) >= midpoint).reduce((s, i) => s + (i.final_cost || 0), 0);
      const olderRev = fi.filter(i => new Date(i.created_at) < midpoint).reduce((s, i) => s + (i.final_cost || 0), 0);
      this.revenueTrend = olderRev > 0 ? ((recentRev - olderRev) / olderRev * 100) : (recentRev > 0 ? 100 : 0);
    } else {
      this.incidentsTrend = 0;
      this.revenueTrend = 0;
    }
  }

  computeMonthly() {
    const map = new Map<string, MonthData>();
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    this.filteredIncidents.forEach(i => {
      const d = new Date(i.created_at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const label = `${months[d.getMonth()]}`;
      if (!map.has(key)) map.set(key, { label, incidents: 0, completed: 0, revenue: 0, commission: 0 });
      const m = map.get(key)!;
      m.incidents++;
      if (i.status === 'completed') m.completed++;
      m.revenue += i.final_cost || 0;
      m.commission += i.commission_amount || 0;
    });

    this.monthlyData = Array.from(map.values()).slice(-6);
    this.maxMonthIncidents = Math.max(1, ...this.monthlyData.map(m => m.incidents));
    this.maxMonthRevenue = Math.max(1, ...this.monthlyData.map(m => m.revenue));
  }

  computeCategories() {
    const catMap: Record<string, string> = {
      battery: 'Bateria', tire: 'Neumatico', crash: 'Choque',
      engine: 'Motor', keys: 'Llaves', other: 'Otro', uncertain: 'Incierto'
    };
    const iconMap: Record<string, string> = {
      battery: 'battery_alert', tire: 'tire_repair', crash: 'car_crash',
      engine: 'settings', keys: 'key', other: 'help', uncertain: 'help'
    };
    const cssMap: Record<string, string> = {
      battery: 'cat-battery', tire: 'cat-tire', crash: 'cat-crash',
      engine: 'cat-engine', keys: 'cat-keys', other: 'cat-other', uncertain: 'cat-other'
    };

    const counts = new Map<string, number>();
    this.filteredIncidents.forEach(i => {
      const cat = i.category || 'other';
      counts.set(cat, (counts.get(cat) || 0) + 1);
    });

    const total = this.filteredIncidents.length || 1;
    this.categoryStats = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({
        name: catMap[key] || key,
        icon: iconMap[key] || 'help',
        count,
        pct: count / total * 100,
        cssClass: cssMap[key] || 'cat-other'
      }));
  }

  computeStatuses() {
    const labels: Record<string, string> = {
      pending: 'Pendiente', assigned: 'Asignado', in_progress: 'En Proceso',
      completed: 'Completado', cancelled: 'Cancelado'
    };
    const counts = new Map<string, number>();
    this.filteredIncidents.forEach(i => counts.set(i.status, (counts.get(i.status) || 0) + 1));

    const total = this.filteredIncidents.length || 1;
    this.statusStats = ['pending', 'assigned', 'in_progress', 'completed', 'cancelled']
      .map(key => ({
        key,
        label: labels[key] || key,
        count: counts.get(key) || 0,
        pct: (counts.get(key) || 0) / total * 100
      }))
      .filter(s => s.count > 0);
  }

  computePriorities() {
    const labels: Record<string, string> = { low: 'Baja', medium: 'Media', high: 'Alta', critical: 'Critica' };
    const counts = new Map<string, number>();
    this.filteredIncidents.forEach(i => counts.set(i.priority, (counts.get(i.priority) || 0) + 1));

    const total = this.filteredIncidents.length || 1;
    this.priorityStats = ['low', 'medium', 'high', 'critical']
      .map(key => ({
        key,
        label: labels[key] || key,
        count: counts.get(key) || 0,
        pct: (counts.get(key) || 0) / total * 100
      }));
  }

  computeTechs() {
    const map = new Map<string, number>();
    this.filteredIncidents
      .filter(i => i.technician_name && i.status === 'completed')
      .forEach(i => map.set(i.technician_name!, (map.get(i.technician_name!) || 0) + 1));

    this.techStats = Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, completed]) => ({ name, completed, avgTime: '' }));
  }

  getBarHeight(value: number, max: number): number {
    if (max <= 0) return 0;
    return Math.max(4, (value / max) * 140);
  }
}
