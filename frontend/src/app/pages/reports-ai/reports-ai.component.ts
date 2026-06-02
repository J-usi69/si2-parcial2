import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { ReportResult } from '../../models/interfaces';

@Component({
  selector: 'app-reports-ai',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-content reveal">
      <div class="page-header">
        <div>
          <h1 class="page-title">Reportes IA</h1>
          <p class="page-subtitle">Describe en lenguaje natural el reporte que necesitas y la IA lo genera.</p>
        </div>
      </div>

      <div class="prompt-box">
        <textarea [(ngModel)]="prompt" rows="3"
          placeholder="Ej: Clientes con mas incidencias en el ultimo mes; o talleres ordenados por servicios completados..."></textarea>
        <div class="examples">
          <span class="ex" *ngFor="let e of examples" (click)="prompt = e">{{ e }}</span>
        </div>
        <button class="btn-gen" (click)="generate()" [disabled]="loading || !prompt.trim()">
          <span class="material-symbols-rounded">{{ loading ? 'hourglass_top' : 'auto_awesome' }}</span>
          {{ loading ? 'Generando...' : 'Generar reporte' }}
        </button>
      </div>

      <div class="error" *ngIf="error">
        <span class="material-symbols-rounded">error</span> {{ error }}
      </div>

      <div class="result" *ngIf="result as r">
        <div class="result-head">
          <div>
            <h2 class="result-title">{{ r.title }}</h2>
            <span class="result-count">{{ r.row_count }} fila(s)</span>
          </div>
          <div class="export-actions" *ngIf="r.columns.length">
            <button class="exp xlsx" (click)="exportAs('xlsx')" [disabled]="exporting"><span class="material-symbols-rounded">table_view</span> Excel</button>
            <button class="exp docx" (click)="exportAs('docx')" [disabled]="exporting"><span class="material-symbols-rounded">description</span> Word</button>
            <button class="exp pdf" (click)="exportAs('pdf')" [disabled]="exporting"><span class="material-symbols-rounded">picture_as_pdf</span> PDF</button>
          </div>
        </div>

        <details class="sql-box">
          <summary>Ver SQL generado</summary>
          <pre>{{ r.sql }}</pre>
        </details>

        <div class="table-wrap" *ngIf="r.rows.length; else noRows">
          <table>
            <thead><tr><th *ngFor="let col of r.columns">{{ col }}</th></tr></thead>
            <tbody>
              <tr *ngFor="let row of r.rows">
                <td *ngFor="let cell of row">{{ cell }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <ng-template #noRows><p class="muted">La consulta no devolvio resultados.</p></ng-template>
      </div>
    </div>
  `,
  styles: [`
    .page-header { margin-bottom:1.25rem; }
    .page-title { font-size:1.6rem; font-weight:800; color:var(--color-text-primary); }
    .page-subtitle { color:var(--color-text-secondary); font-size:.9rem; }
    .prompt-box { background:var(--color-surface); border:1px solid var(--color-border); border-radius:var(--radius-lg); padding:1rem; box-shadow:var(--shadow-sm); }
    textarea { width:100%; border:1px solid var(--color-border); border-radius:var(--radius-md); padding:.7rem; font:inherit; resize:vertical; background:var(--color-surface-alt); color:var(--color-text-primary); }
    .examples { display:flex; flex-wrap:wrap; gap:.4rem; margin:.7rem 0; }
    .ex { font-size:.78rem; padding:.3rem .6rem; background:var(--color-surface-alt); border-radius:var(--radius-pill); color:var(--color-text-secondary); cursor:pointer; }
    .ex:hover { background:var(--color-primary-50); color:var(--color-primary); }
    .btn-gen { display:inline-flex; align-items:center; gap:.4rem; padding:.6rem 1.1rem; background:var(--color-primary); color:var(--color-text-on-primary); border-radius:var(--radius-md); font-weight:700; }
    .btn-gen:disabled { opacity:.5; }
    .error { display:flex; align-items:center; gap:.4rem; margin-top:1rem; padding:.7rem 1rem; background:rgba(230,57,70,.1); color:var(--color-danger); border-radius:var(--radius-md); font-size:.9rem; }
    .result { margin-top:1.5rem; background:var(--color-surface); border:1px solid var(--color-border); border-radius:var(--radius-lg); padding:1.1rem; }
    .result-head { display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; flex-wrap:wrap; margin-bottom:.8rem; }
    .result-title { font-size:1.15rem; font-weight:800; color:var(--color-text-primary); }
    .result-count { font-size:.8rem; color:var(--color-text-tertiary); }
    .export-actions { display:flex; gap:.5rem; flex-wrap:wrap; }
    .exp { display:inline-flex; align-items:center; gap:.3rem; padding:.45rem .8rem; border-radius:var(--radius-md); font-weight:700; font-size:.82rem; color:#fff; }
    .exp .material-symbols-rounded { font-size:1.05rem; }
    .exp.xlsx { background:#1e7a46; }
    .exp.docx { background:#2b579a; }
    .exp.pdf { background:#c0392b; }
    .exp:disabled { opacity:.6; }
    .sql-box { margin-bottom:.9rem; }
    .sql-box summary { cursor:pointer; font-size:.82rem; color:var(--color-text-secondary); font-weight:600; }
    .sql-box pre { margin-top:.5rem; background:var(--color-surface-alt); padding:.7rem; border-radius:var(--radius-md); overflow-x:auto; font-size:.8rem; color:var(--color-text-primary); }
    .table-wrap { overflow-x:auto; border:1px solid var(--color-border); border-radius:var(--radius-md); }
    table { width:100%; border-collapse:collapse; }
    th, td { text-align:left; padding:.5rem .7rem; font-size:.83rem; border-bottom:1px solid var(--color-border); white-space:nowrap; }
    th { background:var(--color-surface-alt); color:var(--color-text-tertiary); text-transform:uppercase; font-size:.7rem; letter-spacing:.04em; position:sticky; top:0; }
    .muted { color:var(--color-text-tertiary); }
  `],
})
export class ReportsAiComponent {
  prompt = '';
  loading = false;
  exporting = false;
  error = '';
  result: ReportResult | null = null;

  examples = [
    'Incidentes por categoria de mayor a menor',
    'Talleres ordenados por servicios completados',
    'Clientes con mas de un incidente',
    'Incidentes cancelados con su motivo',
  ];

  constructor(private api: ApiService) {}

  generate(): void {
    this.loading = true;
    this.error = '';
    this.result = null;
    this.api.generateReport(this.prompt.trim()).subscribe({
      next: (r) => { this.result = r; this.loading = false; },
      error: (e) => { this.error = e?.error?.detail || 'No se pudo generar el reporte.'; this.loading = false; },
    });
  }

  exportAs(format: 'xlsx' | 'docx' | 'pdf'): void {
    if (!this.result) return;
    this.exporting = true;
    this.api.exportReport({
      title: this.result.title,
      columns: this.result.columns,
      rows: this.result.rows,
      format,
    }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte.${format}`;
        a.click();
        URL.revokeObjectURL(url);
        this.exporting = false;
      },
      error: () => { this.error = 'No se pudo exportar el reporte.'; this.exporting = false; },
    });
  }
}
