import { Component, NgZone, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { timeout } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';
import { ReportResult } from '../../models/interfaces';

// API de reconocimiento de voz del navegador (no tipada en TS por defecto).
declare const window: any;

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
        <div class="textarea-wrap">
          <textarea [(ngModel)]="prompt" rows="3" [disabled]="loading"
            placeholder="Ej: Clientes con mas incidencias en el ultimo mes; o talleres ordenados por servicios completados..."></textarea>
          <button type="button" class="mic-btn" [class.rec]="recording"
            *ngIf="voiceSupported" (click)="toggleVoice()"
            [title]="recording ? 'Detener dictado' : 'Dictar por voz'">
            <span class="material-symbols-rounded">{{ recording ? 'stop_circle' : 'mic' }}</span>
          </button>
        </div>
        <div class="rec-hint" *ngIf="recording">
          <span class="dot"></span> Escuchando... habla tu consulta
        </div>
        <div class="examples">
          <span class="ex" [class.ex-disabled]="loading"
            *ngFor="let e of examples"
            (click)="setExample(e)">{{ e }}</span>
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
            <span class="preview-note" *ngIf="r.rows.length > previewLimit">
              · Vista previa de {{ previewLimit }}; exporta para ver todas
            </span>
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
              <tr *ngFor="let row of previewRows">
                <td *ngFor="let cell of row">{{ cell }}</td>
              </tr>
            </tbody>
          </table>
          <p class="more-rows" *ngIf="r.rows.length > previewLimit">
            + {{ r.rows.length - previewLimit }} fila(s) más. Usa Excel/Word/PDF para el reporte completo.
          </p>
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
    .textarea-wrap { position:relative; }
    textarea { width:100%; border:1px solid var(--color-border); border-radius:var(--radius-md); padding:.7rem 3rem .7rem .7rem; font:inherit; resize:vertical; background:var(--color-surface-alt); color:var(--color-text-primary); }
    .mic-btn { position:absolute; top:.5rem; right:.5rem; width:2.2rem; height:2.2rem; display:flex; align-items:center; justify-content:center; border-radius:50%; background:var(--color-surface); border:1px solid var(--color-border); color:var(--color-text-secondary); cursor:pointer; transition:all .15s; }
    .mic-btn:hover { color:var(--color-primary); border-color:var(--color-primary); }
    .mic-btn.rec { background:var(--color-danger); border-color:var(--color-danger); color:#fff; animation:micpulse 1.2s infinite; }
    @keyframes micpulse { 0%,100%{ box-shadow:0 0 0 0 rgba(229,62,62,.5);} 50%{ box-shadow:0 0 0 6px rgba(229,62,62,0);} }
    .rec-hint { display:flex; align-items:center; gap:.4rem; margin-top:.5rem; font-size:.8rem; color:var(--color-danger); font-weight:600; }
    .rec-hint .dot { width:.5rem; height:.5rem; border-radius:50%; background:var(--color-danger); animation:micpulse 1.2s infinite; }
    .examples { display:flex; flex-wrap:wrap; gap:.4rem; margin:.7rem 0; }
    .ex { font-size:.78rem; padding:.3rem .6rem; background:var(--color-surface-alt); border-radius:var(--radius-pill); color:var(--color-text-secondary); cursor:pointer; user-select:none; }
    .ex:hover:not(.ex-disabled) { background:var(--color-primary-50); color:var(--color-primary); }
    .ex-disabled { opacity:.4; cursor:not-allowed; pointer-events:none; }
    .btn-gen { display:inline-flex; align-items:center; gap:.4rem; padding:.6rem 1.1rem; background:var(--color-primary); color:var(--color-text-on-primary); border-radius:var(--radius-md); font-weight:700; }
    .btn-gen:disabled { opacity:.5; }
    .error { display:flex; align-items:center; gap:.4rem; margin-top:1rem; padding:.7rem 1rem; background:rgba(230,57,70,.1); color:var(--color-danger); border-radius:var(--radius-md); font-size:.9rem; }
    .result { margin-top:1.5rem; background:var(--color-surface); border:1px solid var(--color-border); border-radius:var(--radius-lg); padding:1.1rem; }
    .result-head { display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; flex-wrap:wrap; margin-bottom:.8rem; }
    .result-title { font-size:1.15rem; font-weight:800; color:var(--color-text-primary); }
    .result-count { font-size:.8rem; color:var(--color-text-tertiary); }
    .preview-note { font-size:.78rem; color:var(--color-primary); font-weight:600; }
    .more-rows { padding:.6rem .7rem; font-size:.8rem; color:var(--color-text-tertiary); background:var(--color-surface-alt); border-top:1px solid var(--color-border); margin:0; }
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
export class ReportsAiComponent implements OnDestroy {
  prompt = '';
  loading = false;
  exporting = false;
  error = '';
  result: ReportResult | null = null;
  recording = false;

  // La vista previa solo renderiza estas filas para no congelar el DOM
  // (una consulta puede traer hasta 500 filas; el export las incluye todas).
  readonly previewLimit = 20;
  // Propiedad (no getter): se calcula UNA vez cuando llega la respuesta.
  // Un getter se reevalúa en cada ciclo de change detection → slice() repetido
  // → el DOM tarda en responder aunque la API ya devolvió 200.
  previewRows: (string | number | null)[][] = [];

  private recognition: any = null;

  examples = [
    'Incidentes por categoria de mayor a menor',
    'Talleres ordenados por servicios completados',
    'Clientes con mas de un incidente',
    'Incidentes cancelados con su motivo',
  ];

  constructor(private api: ApiService, private zone: NgZone) {}

  get voiceSupported(): boolean {
    return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  setExample(e: string): void {
    if (this.loading) return;
    this.prompt = e;
  }

  generate(): void {
    this.loading = true;
    this.error = '';
    this.result = null;
    this.previewRows = [];
    this.api.generateReport(this.prompt.trim()).pipe(timeout(60000)).subscribe({
      next: (r) => {
        // Calcular previewRows UNA sola vez aquí, no en cada ciclo de CD.
        this.previewRows = r.rows.slice(0, this.previewLimit);
        this.result = r;
        this.loading = false;
      },
      error: (e) => {
        this.error = e?.name === 'TimeoutError'
          ? 'La IA tardo demasiado en responder. Intenta de nuevo o simplifica la consulta.'
          : (e?.error?.detail || 'No se pudo generar el reporte.');
        this.loading = false;
      },
    });
  }

  toggleVoice(): void {
    if (this.recording) { this.stopVoice(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { this.error = 'Tu navegador no soporta dictado por voz.'; return; }
    const rec = new SR();
    rec.lang = 'es-ES';
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = '';
    rec.onresult = (ev: any) => {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) finalText += t; else interim += t;
      }
      this.zone.run(() => { this.prompt = (finalText + interim).trim(); });
    };
    rec.onerror = () => this.zone.run(() => { this.recording = false; });
    rec.onend = () => this.zone.run(() => { this.recording = false; });
    this.recognition = rec;
    this.recording = true;
    rec.start();
  }

  private stopVoice(): void {
    try { this.recognition?.stop(); } catch { /* ignore */ }
    this.recording = false;
  }

  ngOnDestroy(): void { this.stopVoice(); }

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
