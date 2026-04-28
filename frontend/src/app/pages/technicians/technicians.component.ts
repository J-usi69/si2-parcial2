import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Technician } from '../../models/interfaces';

@Component({
  selector: 'app-technicians',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-content reveal">
        <div class="page-header">
          <div>
            <h1 class="page-title">Tecnicos</h1>
            <p class="page-subtitle">
              {{ technicians.length }} tecnicos en tu equipo
            </p>
          </div>
          <button
            class="btn"
            [class.btn-primary]="!showForm"
            [class.btn-ghost]="showForm"
            (click)="toggleForm()"
          >
            <span class="material-symbols-rounded">
              {{ showForm ? 'close' : 'person_add' }}
            </span>
            {{ showForm ? 'Cancelar' : 'Nuevo tecnico' }}
          </button>
        </div>

        <div class="error-banner" *ngIf="error && !loading">
          <span class="material-symbols-rounded">cloud_off</span>
          <span>No se pudo cargar los tecnicos</span>
          <button class="retry-btn" (click)="loadData()">
            <span class="material-symbols-rounded">refresh</span>
            Reintentar
          </button>
        </div>

        <!-- Form -->
        <div class="form-card card" *ngIf="showForm">
          <div class="form-header">
            <div class="form-icon">
              <span class="material-symbols-rounded">
                {{ editing ? 'edit' : 'person_add' }}
              </span>
            </div>
            <div>
              <h3>{{ editing ? 'Editar tecnico' : 'Nuevo tecnico' }}</h3>
              <p>Completa la informacion del tecnico</p>
            </div>
          </div>

          <div class="form-grid">
            <div class="field">
              <label>Nombre completo</label>
              <div class="input-with-icon">
                <span class="material-symbols-rounded">badge</span>
                <input
                  class="input"
                  [(ngModel)]="newTech.name"
                  placeholder="Juan Perez"
                />
              </div>
            </div>

            <div class="field">
              <label>Telefono</label>
              <div class="input-with-icon">
                <span class="material-symbols-rounded">call</span>
                <input
                  class="input"
                  [(ngModel)]="newTech.phone"
                  placeholder="77712345"
                />
              </div>
            </div>

            <div class="field">
              <label>Correo electronico</label>
              <div class="input-with-icon">
                <span class="material-symbols-rounded">mail</span>
                <input
                  class="input"
                  type="email"
                  [(ngModel)]="newTech.email"
                  placeholder="tecnico@email.com"
                />
              </div>
            </div>

            <div class="field">
              <label>{{ editing ? 'Nueva contrasena' : 'Contrasena' }}</label>
              <div class="input-with-icon">
                <span class="material-symbols-rounded">lock_reset</span>
                <input
                  class="input"
                  type="password"
                  [(ngModel)]="newTech.password"
                  [placeholder]="editing ? 'Dejar vacio para no cambiar' : '12345678*'"
                />
              </div>
            </div>

            <div class="field full">
              <label>Especialidades</label>
              <div class="spec-chips">
                <button
                  type="button"
                  *ngFor="let opt of specOptions"
                  class="spec-chip"
                  [class.active]="isSpecSelected(opt.value)"
                  (click)="toggleSpec(opt.value)"
                >
                  <span class="material-symbols-rounded">{{ opt.icon }}</span>
                  {{ opt.label }}
                </button>
              </div>
            </div>
          </div>

          <div class="form-actions">
            <button class="btn btn-ghost" (click)="resetForm()">
              Cancelar
            </button>
            <button
              class="btn btn-success"
              (click)="saveTechnician()"
              [disabled]="!canSave()"
            >
              <span class="material-symbols-rounded">
                {{ editing ? 'save' : 'check' }}
              </span>
              {{ editing ? 'Actualizar' : 'Guardar' }}
            </button>
          </div>
        </div>

        <!-- List -->
        <div class="tech-grid" *ngIf="technicians.length > 0; else emptyTpl">
          <div class="tech-card card" *ngFor="let t of technicians">
            <div class="tech-top">
              <div class="tech-avatar">{{ getInitials(t.name) }}</div>
              <span
                class="badge badge-soft"
                [ngClass]="t.is_available ? 'badge-status-available' : 'badge-status-busy'"
              >
                <span class="status-dot" [class.online]="t.is_available"></span>
                {{ t.is_available ? 'Disponible' : 'Ocupado' }}
              </span>
            </div>

            <h3 class="tech-name">{{ t.name }}</h3>

            <div class="tech-info">
              <span class="material-symbols-rounded">call</span>
              <a href="tel:{{ t.phone }}">{{ t.phone }}</a>
            </div>

            <div class="tech-info">
              <span class="material-symbols-rounded">mail</span>
              <a *ngIf="t.user_email; else noEmailTpl" href="mailto:{{ t.user_email }}">
                {{ t.user_email }}
              </a>
              <ng-template #noEmailTpl>
                <span>Sin correo asociado</span>
              </ng-template>
            </div>

            <div class="specialties">
              <span
                *ngFor="let s of t.specialties.split(',')"
                class="spec-tag"
              >
                <span class="material-symbols-rounded">{{
                  getSpecIcon(s)
                }}</span>
                {{ getSpecLabel(s) }}
              </span>
            </div>

            <div class="tech-actions">
              <button
                class="action-btn toggle"
                [class.busy]="!t.is_available"
                (click)="toggleAvailability(t)"
                [title]="t.is_available ? 'Marcar como ocupado' : 'Marcar como disponible'"
              >
                <span class="material-symbols-rounded">
                  {{ t.is_available ? 'pause_circle' : 'play_circle' }}
                </span>
              </button>
              <button
                class="action-btn edit"
                (click)="editTechnician(t)"
                title="Editar"
              >
                <span class="material-symbols-rounded">edit</span>
              </button>
              <button
                class="action-btn delete"
                (click)="deleteTechnician(t.id)"
                title="Eliminar"
              >
                <span class="material-symbols-rounded">delete</span>
              </button>
            </div>
          </div>
        </div>

        <ng-template #emptyTpl>
          <div class="empty-state card">
            <div class="empty-icon">
              <span class="material-symbols-rounded">engineering</span>
            </div>
            <h3>Sin tecnicos</h3>
            <p>Agrega tu primer tecnico para empezar a asignar servicios.</p>
            <button class="btn btn-primary" (click)="toggleForm()" *ngIf="!showForm">
              <span class="material-symbols-rounded">person_add</span>
              Agregar tecnico
            </button>
          </div>
        </ng-template>
    </div>
  `,
  styles: [
    `
      .error-banner {
        display: flex; align-items: center; gap: var(--space-sm);
        background: var(--color-surface); border: 1px solid var(--color-border);
        border-radius: var(--radius-lg); padding: var(--space-sm) var(--space-md);
        margin-bottom: var(--space-md); color: var(--color-text-secondary);
        flex-wrap: wrap;
        .material-symbols-rounded { font-size: 1.25rem; color: var(--color-danger); }
      }
      .retry-btn {
        margin-left: auto; padding: 0.375rem 0.875rem; font-size: 0.8125rem;
        border: 1px solid var(--color-border); border-radius: var(--radius-md);
        color: var(--color-text-primary); display: flex; align-items: center; gap: 0.375rem;
        &:hover { background: var(--color-surface-alt); }
        .material-symbols-rounded { font-size: 1rem; color: var(--color-text-primary); }
      }

      /* ── Mobile-first: Form card ── */
      .form-card {
        padding: var(--space-md);
        margin-bottom: var(--space-md);
        border-radius: var(--radius-xl);
        border-left: 4px solid var(--color-primary);
      }

      .form-header {
        display: flex; align-items: center; gap: var(--space-sm);
        margin-bottom: var(--space-md); padding-bottom: var(--space-sm);
        border-bottom: 1px solid var(--color-divider);
      }

      .form-icon {
        width: 2.75rem; height: 2.75rem; border-radius: var(--radius-lg);
        background: var(--color-primary-50);
        display: flex; align-items: center; justify-content: center;
        .material-symbols-rounded { font-size: 1.25rem; color: var(--color-primary); }
      }

      .form-header h3 { font-size: 1rem; font-weight: 700; color: var(--color-text-primary); margin: 0 0 0.125rem; }
      .form-header p { font-size: 0.8125rem; color: var(--color-text-tertiary); margin: 0; }

      /* Mobile: single column form */
      .form-grid {
        display: grid; grid-template-columns: 1fr;
        gap: var(--space-sm); margin-bottom: var(--space-md);
      }

      .field.full { grid-column: 1 / -1; }

      .spec-chips { display: flex; flex-wrap: wrap; gap: var(--space-xs); }

      .spec-chip {
        display: inline-flex; align-items: center; gap: 0.375rem;
        padding: 0.5rem 0.875rem;
        background: var(--color-surface-alt);
        border: 1.5px solid transparent;
        border-radius: var(--radius-pill);
        font-size: 0.8125rem; font-weight: 500;
        color: var(--color-text-secondary);
        cursor: pointer; transition: all 0.2s var(--ease-out);
        .material-symbols-rounded { font-size: 1rem; }
        &:hover { background: var(--color-surface-hover); color: var(--color-text-primary); }
        &.active { background: var(--color-primary-50); border-color: var(--color-primary); color: var(--color-primary); font-weight: 600; }
      }

      .form-actions {
        display: flex; justify-content: flex-end; gap: var(--space-sm);
        padding-top: var(--space-sm); border-top: 1px solid var(--color-divider);
      }

      /* Mobile: single column tech grid */
      .tech-grid {
        display: grid; grid-template-columns: 1fr;
        gap: var(--space-sm);
      }

      .tech-card {
        padding: var(--space-md); border-radius: var(--radius-xl);
        transition: all 0.25s var(--ease-out);
        &:hover { transform: translateY(-2px); box-shadow: var(--shadow-card-hover); }
      }

      .tech-top {
        display: flex; justify-content: space-between;
        align-items: flex-start; margin-bottom: var(--space-sm);
      }

      .tech-avatar {
        width: 3rem; height: 3rem; border-radius: 50%;
        background: var(--color-primary); color: white;
        display: flex; align-items: center; justify-content: center;
        font-weight: 800; font-size: 1rem;
      }

      .badge-status-available { background: rgba(6, 167, 125, 0.1); color: var(--color-success); }
      .badge-status-busy { background: rgba(230, 57, 70, 0.1); color: var(--color-danger); }

      .status-dot {
        width: 0.5rem; height: 0.5rem; border-radius: 50%;
        background: var(--color-danger); display: inline-block; margin-right: 0.375rem;
        &.online { background: var(--color-success); box-shadow: 0 0 0 3px rgba(6, 167, 125, 0.18); animation: pulse 2s infinite; }
      }

      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }

      .tech-name { font-size: 1.0625rem; font-weight: 700; color: var(--color-text-primary); margin: 0 0 var(--space-xs); }

      .tech-info {
        display: flex; align-items: center; gap: 0.375rem;
        margin-bottom: var(--space-sm); font-size: 0.8125rem; color: var(--color-text-secondary);
        .material-symbols-rounded { font-size: 1rem; color: var(--color-text-tertiary); }
        a { color: var(--color-text-secondary); text-decoration: none; font-weight: 500; transition: color 0.2s; &:hover { color: var(--color-primary); } }
      }

      .specialties {
        display: flex; flex-wrap: wrap; gap: 0.375rem;
        margin-bottom: var(--space-sm); padding-bottom: var(--space-sm);
        border-bottom: 1px solid var(--color-divider);
      }

      .spec-tag {
        display: inline-flex; align-items: center; gap: 0.25rem;
        background: var(--color-surface-alt); color: var(--color-text-secondary);
        padding: 0.25rem 0.625rem; border-radius: var(--radius-pill);
        font-size: 0.6875rem; font-weight: 600;
        .material-symbols-rounded { font-size: 0.875rem; }
      }

      .tech-actions { display: flex; gap: var(--space-xs); }

      .action-btn {
        flex: 1; height: 2.25rem; border-radius: var(--radius-md);
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; transition: all 0.2s var(--ease-out);
        border: 1px solid var(--color-border); background: var(--color-surface);
        .material-symbols-rounded { font-size: 1.25rem; }
        &:hover { transform: translateY(-1px); box-shadow: 0 2px 6px rgba(0,0,0,0.06); }
        &.toggle { color: var(--color-success); &.busy { color: var(--color-warning); } &:hover { background: rgba(6, 167, 125, 0.06); } }
        &.edit { color: var(--color-info); &:hover { background: rgba(58, 134, 255, 0.06); } }
        &.delete { color: var(--color-danger); &:hover { background: var(--color-danger-light); } }
      }

      /* ── Tablet (≥576px): 2-col tech grid ── */
      @media (min-width: 576px) {
        .tech-grid { grid-template-columns: repeat(2, 1fr); gap: var(--space-md); }
        .tech-card { padding: var(--space-lg); }
        .tech-avatar { width: 3.375rem; height: 3.375rem; font-size: 1.125rem; }
        .action-btn { height: 2.375rem; }
      }

      /* ── Tablet (≥768px): 2-col form ── */
      @media (min-width: 768px) {
        .form-grid { grid-template-columns: repeat(2, 1fr); gap: var(--space-md); }
        .form-card { padding: var(--space-lg) var(--space-xl); }
        .form-icon { width: 3rem; height: 3rem; .material-symbols-rounded { font-size: 1.5rem; } }
        .spec-chips { gap: var(--space-sm); }
      }

      /* ── Desktop (≥1024px): auto-fill grid ── */
      @media (min-width: 1024px) {
        .tech-grid { grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr)); }
      }
    `,
  ],
})
export class TechniciansComponent implements OnInit {
  technicians: Technician[] = [];
  loading = true;
  error = false;
  showForm = false;
  editing: number | null = null;
  newTech = {
    name: '',
    phone: '',
    email: '',
    password: '',
    specialties: 'battery,tire,crash,engine',
  };

  specOptions = [
    { value: 'battery', label: 'Bateria', icon: 'battery_alert' },
    { value: 'tire', label: 'Llanta', icon: 'tire_repair' },
    { value: 'crash', label: 'Choque', icon: 'car_crash' },
    { value: 'engine', label: 'Motor', icon: 'settings' },
    { value: 'keys', label: 'Llaves', icon: 'key' },
    { value: 'other', label: 'Otro', icon: 'help' },
  ];

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading = true;
    this.error = false;
    this.api.getTechnicians().subscribe({
      next: (data) => { this.technicians = data; this.loading = false; this.cdr.markForCheck(); },
      error: () => { this.loading = false; this.error = true; this.cdr.markForCheck(); }
    });
  }

  toggleForm() {
    if (this.showForm) {
      this.resetForm();
    } else {
      this.showForm = true;
    }
  }

  isSpecSelected(value: string): boolean {
    return this.newTech.specialties
      .split(',')
      .map((s) => s.trim())
      .includes(value);
  }

  toggleSpec(value: string) {
    const current = this.newTech.specialties
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const idx = current.indexOf(value);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(value);
    }
    this.newTech.specialties = current.join(',');
  }

  canSave(): boolean {
    return (
      this.newTech.name.trim().length > 0 &&
      this.newTech.phone.trim().length > 0 &&
      (!this.newTech.email.trim() || this.newTech.email.includes('@')) &&
      (!this.newTech.password || this.newTech.password.length >= 8) &&
      this.newTech.specialties.trim().length > 0
    );
  }

  saveTechnician() {
    if (!this.canSave()) return;
    const payload = {
      ...this.newTech,
      email: this.newTech.email.trim() || undefined,
      password: this.newTech.password || undefined,
    };
    if (this.editing) {
      this.api.updateTechnician(this.editing, payload).subscribe(() => {
        this.resetForm();
        this.loadData();
      });
    } else {
      this.api.createTechnician(payload).subscribe(() => {
        this.resetForm();
        this.loadData();
      });
    }
  }

  editTechnician(t: Technician) {
    this.editing = t.id;
    this.newTech = {
      name: t.name,
      phone: t.phone,
      email: t.user_email || '',
      password: '',
      specialties: t.specialties,
    };
    this.showForm = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  deleteTechnician(id: number) {
    if (confirm('Eliminar este tecnico?')) {
      this.api.deleteTechnician(id).subscribe(() => this.loadData());
    }
  }

  toggleAvailability(t: Technician) {
    this.api
      .updateTechnician(t.id, { is_available: !t.is_available })
      .subscribe(() => this.loadData());
  }

  resetForm() {
    this.showForm = false;
    this.editing = null;
    this.newTech = {
      name: '',
      phone: '',
      email: '',
      password: '',
      specialties: 'battery,tire,crash,engine',
    };
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }

  getSpecIcon(s: string): string {
    const icons: Record<string, string> = {
      battery: 'battery_alert',
      tire: 'tire_repair',
      crash: 'car_crash',
      engine: 'settings',
      keys: 'key',
      other: 'help',
    };
    return icons[s.trim()] || 'help';
  }

  getSpecLabel(s: string): string {
    const labels: Record<string, string> = {
      battery: 'Bateria',
      tire: 'Llanta',
      crash: 'Choque',
      engine: 'Motor',
      keys: 'Llaves',
      other: 'Otro',
    };
    return labels[s.trim()] || s;
  }
}
