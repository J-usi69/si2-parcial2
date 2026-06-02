import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, registerables } from 'chart.js';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { MetricsSummary, Workshop } from '../../models/interfaces';

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
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-content reveal" *ngIf="m; else loadingTpl">
      <div class="page-header">
        <div>
          <h1 class="page-title">Indicadores {{ m!.scope === 'global' ? '— Plataforma' : '— Mi taller' }}</h1>
          <p class="page-subtitle">Métricas clave de atención de emergencias.</p>
        </div>
        <div class="header-actions">
          <div class="tenant-select" *ngIf="isAdmin">
            <span class="material-symbols-rounded">filter_alt</span>
            <select [(ngModel)]="selectedTenant" (ngModelChange)="load()" aria-label="Filtrar por taller">
              <option [ngValue]="null">Toda la plataforma</option>
              <option *ngFor="let w of workshops" [ngValue]="w.tenant_id">{{ w.name }}</option>
            </select>
          </div>
          <button class="btn-refresh" (click)="load()">
            <span class="material-symbols-rounded">refresh</span> Actualizar
          </button>
        </div>
      </div>

      <!-- Tarjetas KPI -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <span class="material-symbols-rounded ic">schedule</span>
          <div>
            <span class="val">{{ m!.avg_assignment_min ?? '—' }}<small>min</small></span>
            <span class="lbl">Tiempo prom. asignación</span>
          </div>
        </div>
        <div class="kpi-card">
          <span class="material-symbols-rounded ic">local_shipping</span>
          <div>
            <span class="val">{{ m!.avg_arrival_min ?? '—' }}<small>min</small></span>
            <span class="lbl">Tiempo prom. llegada</span>
          </div>
        </div>
        <div class="kpi-card">
          <span class="material-symbols-rounded ic">verified</span>
          <div>
            <span class="val">{{ pct(m!.sla.compliance_rate) }}</span>
            <span class="lbl">Dentro del tiempo esperado (SLA)</span>
          </div>
        </div>
        <div class="kpi-card danger">
          <span class="material-symbols-rounded ic">cancel</span>
          <div>
            <span class="val">{{ pct(m!.cancelled.cancellation_rate) }}</span>
            <span class="lbl">Casos cancelados ({{ m!.cancelled.cancelled }})</span>
          </div>
        </div>
      </div>

      <div class="grid-2">
        <!-- Gráfico de barras: categorías -->
        <div class="panel">
          <h3>Incidentes más frecuentes</h3>
          <div class="chart-box">
            <canvas id="ry-cat-chart"></canvas>
          </div>
        </div>

        <!-- Gráfico de dona: estados -->
        <div class="panel">
          <h3>Distribución por estado</h3>
          <div class="chart-box">
            <canvas id="ry-status-chart"></canvas>
          </div>
        </div>

        <!-- Talleres más eficientes -->
        <div class="panel">
          <h3>Talleres más eficientes</h3>
          <table class="tbl">
            <thead><tr><th>Taller</th><th>Compl.</th><th>Rating</th><th>Prom. atención</th></tr></thead>
            <tbody>
              <tr *ngFor="let w of m!.top_workshops">
                <td>{{ w.workshop_name }}</td>
                <td>{{ w.completed }}</td>
                <td>{{ w.rating }}</td>
                <td>{{ w.avg_completion_min != null ? w.avg_completion_min + ' min' : '—' }}</td>
              </tr>
              <tr *ngIf="m!.top_workshops.length === 0">
                <td colspan="4" class="muted">Sin datos aún</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Zonas -->
        <div class="panel">
          <h3>Zonas con más incidencias</h3>
          <table class="tbl">
            <thead><tr><th>Lat</th><th>Lng</th><th>Incidencias</th></tr></thead>
            <tbody>
              <tr *ngFor="let z of m!.zones">
                <td>{{ z.latitude }}</td><td>{{ z.longitude }}</td><td>{{ z.count }}</td>
              </tr>
              <tr *ngIf="m!.zones.length === 0">
                <td colspan="3" class="muted">Sin datos aún</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Motivos de cancelación -->
      <div class="panel" *ngIf="m!.cancelled.reasons.length">
        <h3>Motivos de cancelación</h3>
        <div class="chips">
          <span class="chip" *ngFor="let r of m!.cancelled.reasons">{{ r.reason }} <b>{{ r.count }}</b></span>
        </div>
      </div>
    </div>

    <ng-template #loadingTpl>
      <div class="page-content"><p class="muted">Cargando indicadores...</p></div>
    </ng-template>
  `,
  styles: [`
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; margin-bottom:1.25rem; }
    .page-title { font-size:1.6rem; font-weight:800; color:var(--color-text-primary); }
    .page-subtitle { color:var(--color-text-secondary); font-size:.9rem; }
    .header-actions { display:flex; align-items:center; gap:.6rem; flex-wrap:wrap; }
    .tenant-select { display:flex; align-items:center; gap:.35rem; padding:.35rem .6rem; border-radius:var(--radius-md); background:var(--color-surface); border:1px solid var(--color-border); }
    .tenant-select .material-symbols-rounded { font-size:1.1rem; color:var(--color-primary); }
    .tenant-select select { border:none; background:transparent; color:var(--color-text-primary); font:inherit; font-weight:600; font-size:.85rem; cursor:pointer; outline:none; max-width:200px; }
    .tenant-select select option { background:var(--color-surface); color:var(--color-text-primary); }
    .btn-refresh { display:flex; align-items:center; gap:.4rem; padding:.5rem .9rem; border-radius:var(--radius-md); background:var(--color-surface-alt); color:var(--color-text-secondary); font-weight:600; }
    .kpi-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:.9rem; margin-bottom:1.5rem; }
    .kpi-card { background:var(--color-surface); border:1px solid var(--color-border); border-radius:var(--radius-lg); padding:1rem; display:flex; gap:.85rem; align-items:center; box-shadow:var(--shadow-sm); }
    .kpi-card .ic { font-size:2rem; color:var(--color-primary); background:var(--color-primary-50); border-radius:var(--radius-md); padding:.4rem; }
    .kpi-card.danger .ic { color:var(--color-danger); background:rgba(229,62,62,.1); }
    .kpi-card .val { font-size:1.7rem; font-weight:800; color:var(--color-text-primary); display:block; }
    .kpi-card .val small { font-size:.8rem; font-weight:600; color:var(--color-text-tertiary); margin-left:.2rem; }
    .kpi-card .lbl { font-size:.72rem; text-transform:uppercase; letter-spacing:.04em; color:var(--color-text-tertiary); font-weight:600; }
    .grid-2 { display:grid; grid-template-columns:repeat(2,1fr); gap:1rem; }
    .panel { background:var(--color-surface); border:1px solid var(--color-border); border-radius:var(--radius-lg); padding:1.1rem; margin-bottom:1rem; }
    .panel h3 { font-size:.95rem; font-weight:700; margin-bottom:.9rem; color:var(--color-text-primary); }
    .chart-box { position:relative; height:260px; }
    .tbl { width:100%; border-collapse:collapse; }
    .tbl th, .tbl td { text-align:left; padding:.45rem .5rem; font-size:.82rem; border-bottom:1px solid var(--color-border); }
    .tbl th { color:var(--color-text-tertiary); text-transform:uppercase; font-size:.68rem; letter-spacing:.04em; }
    .muted { color:var(--color-text-tertiary); font-size:.85rem; padding:.5rem; display:block; }
    .chips { display:flex; flex-wrap:wrap; gap:.5rem; }
    .chip { background:var(--color-surface-alt); border-radius:var(--radius-pill); padding:.35rem .7rem; font-size:.8rem; color:var(--color-text-secondary); }
    .chip b { color:var(--color-primary); }
    @media (max-width:880px){ .kpi-grid{ grid-template-columns:repeat(2,1fr); } .grid-2{ grid-template-columns:1fr; } }
  `],
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
    // Usamos getElementById en lugar de @ViewChild porque @ViewChild no
    // actualiza su referencia de forma fiable cuando el <canvas> está dentro
    // de un *ngIf anidado. getElementById opera directamente sobre el DOM
    // real, que ya fue actualizado por detectChanges() arriba.
    const catEl = document.getElementById('ry-cat-chart') as HTMLCanvasElement | null;
    const statusEl = document.getElementById('ry-status-chart') as HTMLCanvasElement | null;

    const accent = '#FF6B00';
    const palette = ['#FF7A00', '#007AFF', '#1E88E5', '#0fad73', '#6b7280', '#9333ea', '#14b8a6'];

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
              backgroundColor: accent,
              borderRadius: 6,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
          },
        });
      } else {
        const ctx = catEl.getContext('2d');
        if (ctx) { ctx.fillStyle = '#8c95a8'; ctx.font = '14px sans-serif'; ctx.fillText('Sin datos aún', 10, 30); }
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
            datasets: [{ data: st.map((s) => s.count), backgroundColor: palette, borderWidth: 0 }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
          },
        });
      } else {
        const ctx = statusEl.getContext('2d');
        if (ctx) { ctx.fillStyle = '#8c95a8'; ctx.font = '14px sans-serif'; ctx.fillText('Sin datos aún', 10, 30); }
      }
    }
  }

  tCat(v: string): string { return CATEGORY_ES[(v || '').toUpperCase()] ?? v; }
  tStatus(v: string): string { return STATUS_ES[(v || '').toUpperCase()] ?? v; }
  pct(rate: number | null): string { return rate == null ? '—' : Math.round(rate * 100) + '%'; }

  ngOnDestroy(): void { this.catChart?.destroy(); this.statusChart?.destroy(); }
}
