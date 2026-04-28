import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { User } from '../../models/interfaces';

@Component({
  selector: 'app-admin-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-content reveal">
      <div class="page-header">
        <div>
          <h1 class="page-title">Notificaciones push</h1>
          <p class="page-subtitle">Envio de avisos a clientes y mecanicos de la app movil</p>
        </div>
      </div>

      <div class="grid">
        <section class="card composer">
          <div class="section-title">
            <span class="material-symbols-rounded">campaign</span>
            <div>
              <h3>Nuevo mensaje</h3>
              <p>Se guardara en notificaciones y se enviara como push si el usuario tiene token activo.</p>
            </div>
          </div>

          <div class="field">
            <label>Titulo</label>
            <input class="input" [(ngModel)]="title" maxlength="80" placeholder="Ej. Mantenimiento programado">
          </div>

          <div class="field">
            <label>Mensaje</label>
            <textarea class="input textarea" [(ngModel)]="message" maxlength="240" rows="5" placeholder="Escribe el mensaje que recibiran en mobile"></textarea>
            <small>{{ message.length }}/240</small>
          </div>

          <div class="field">
            <label>Destinatarios</label>
            <div class="role-row">
              <button type="button" class="role-chip" [class.active]="targetClients" (click)="targetClients = !targetClients; applySelection()">
                <span class="material-symbols-rounded">directions_car</span>
                Clientes
              </button>
              <button type="button" class="role-chip" [class.active]="targetTechnicians" (click)="targetTechnicians = !targetTechnicians; applySelection()">
                <span class="material-symbols-rounded">engineering</span>
                Mecanicos
              </button>
            </div>
          </div>

          <div class="field">
            <label>Alcance</label>
            <select class="input" [(ngModel)]="scope" (change)="applySelection()">
              <option value="roles">Todos los roles seleccionados</option>
              <option value="manual">Seleccion manual</option>
            </select>
          </div>

          <div class="manual-box" *ngIf="scope === 'manual'">
            <div class="search-box">
              <span class="material-symbols-rounded">search</span>
              <input class="input" [(ngModel)]="searchTerm" (input)="applySelection()" placeholder="Buscar destinatario">
            </div>
            <div class="recipient-list">
              <label class="recipient" *ngFor="let user of filteredRecipients">
                <input type="checkbox" [checked]="selectedIds.has(user.id)" (change)="toggleUser(user.id)">
                <span class="avatar">{{ initials(user.full_name) }}</span>
                <span class="recipient-main">
                  <strong>{{ user.full_name }}</strong>
                  <small>{{ user.email }} · {{ roleLabel(user.role) }}</small>
                </span>
              </label>
            </div>
          </div>

          <div class="form-error" *ngIf="errorMessage">
            <span class="material-symbols-rounded">error</span>
            {{ errorMessage }}
          </div>

          <button class="btn btn-primary send-btn" [disabled]="sending || !canSend()" (click)="send()">
            <span class="material-symbols-rounded">{{ sending ? 'hourglass_top' : 'send' }}</span>
            {{ sending ? 'Enviando...' : 'Enviar notificacion' }}
          </button>
        </section>

        <aside class="summary">
          <div class="card stat-card">
            <span class="material-symbols-rounded">directions_car</span>
            <div><strong>{{ countRole('client') }}</strong><small>Clientes mobile</small></div>
          </div>
          <div class="card stat-card">
            <span class="material-symbols-rounded">engineering</span>
            <div><strong>{{ countRole('technician') }}</strong><small>Mecanicos mobile</small></div>
          </div>
          <div class="card result-card" *ngIf="lastResult">
            <h3>Resultado del envio</h3>
            <div class="result-row"><span>Destinatarios</span><strong>{{ lastResult.targeted }}</strong></div>
            <div class="result-row"><span>Notificaciones creadas</span><strong>{{ lastResult.in_app_created }}</strong></div>
            <div class="result-row"><span>Push enviados</span><strong>{{ lastResult.push_sent }}</strong></div>
            <div class="result-row"><span>Sin token push</span><strong>{{ lastResult.without_push_token }}</strong></div>
          </div>
        </aside>
      </div>
    </div>
  `,
  styles: [`
    .grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--space-md); }
    .composer { padding: var(--space-lg); }
    .section-title { display: flex; gap: var(--space-sm); align-items: flex-start; margin-bottom: var(--space-lg); }
    .section-title > .material-symbols-rounded { width: 3rem; height: 3rem; display: grid; place-items: center; border-radius: var(--radius-lg); color: var(--color-primary); background: var(--color-primary-50); }
    .section-title h3 { margin: 0; color: var(--color-text-primary); font-weight: 800; }
    .section-title p { margin: 0.25rem 0 0; color: var(--color-text-tertiary); font-size: 0.875rem; }
    .field { margin-bottom: var(--space-md); }
    .field label { display: block; color: var(--color-text-secondary); font-weight: 800; margin-bottom: var(--space-xs); }
    .field small { display: block; margin-top: 0.375rem; color: var(--color-text-tertiary); text-align: right; }
    .textarea { resize: vertical; min-height: 8rem; }
    .role-row { display: flex; gap: var(--space-sm); flex-wrap: wrap; }
    .role-chip { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1rem; border-radius: var(--radius-pill); background: var(--color-surface-alt); color: var(--color-text-secondary); border: 1.5px solid var(--color-border); font-weight: 800; }
    .role-chip.active { color: var(--color-primary); border-color: var(--color-primary); background: var(--color-primary-50); }
    .manual-box { border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: var(--space-md); margin-bottom: var(--space-md); background: var(--color-surface-alt); }
    .search-box { position: relative; margin-bottom: var(--space-sm); }
    .search-box .material-symbols-rounded { position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: var(--color-text-tertiary); }
    .search-box .input { padding-left: 2.5rem; }
    .recipient-list { display: grid; gap: var(--space-xs); max-height: 20rem; overflow: auto; }
    .recipient { display: flex; align-items: center; gap: var(--space-sm); padding: var(--space-sm); border-radius: var(--radius-md); background: var(--color-surface); cursor: pointer; }
    .avatar { width: 2rem; height: 2rem; border-radius: 50%; display: grid; place-items: center; background: var(--color-primary); color: white; font-size: 0.75rem; font-weight: 800; }
    .recipient-main { display: flex; flex-direction: column; min-width: 0; }
    .recipient-main strong { color: var(--color-text-primary); }
    .recipient-main small { color: var(--color-text-tertiary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .form-error { display: flex; align-items: center; gap: var(--space-xs); padding: var(--space-sm); border-radius: var(--radius-md); color: var(--color-danger); background: var(--color-danger-light); font-weight: 800; margin-bottom: var(--space-md); }
    .send-btn { width: 100%; justify-content: center; }
    .summary { display: grid; gap: var(--space-md); align-content: start; }
    .stat-card { padding: var(--space-md); display: flex; align-items: center; gap: var(--space-md); }
    .stat-card > .material-symbols-rounded { width: 2.75rem; height: 2.75rem; display: grid; place-items: center; border-radius: var(--radius-md); background: var(--color-primary-50); color: var(--color-primary); }
    .stat-card strong { display: block; font-family: 'JetBrains Mono', monospace; font-size: 1.6rem; color: var(--color-text-primary); }
    .stat-card small { color: var(--color-text-secondary); font-weight: 800; }
    .result-card { padding: var(--space-md); }
    .result-card h3 { margin: 0 0 var(--space-sm); color: var(--color-text-primary); }
    .result-row { display: flex; justify-content: space-between; padding: var(--space-xs) 0; border-bottom: 1px solid var(--color-divider); color: var(--color-text-secondary); }
    .result-row:last-child { border-bottom: 0; }
    .result-row strong { color: var(--color-text-primary); }
    @media (min-width: 1024px) { .grid { grid-template-columns: minmax(0, 1fr) 20rem; } }
  `],
})
export class AdminNotificationsComponent implements OnInit {
  users: User[] = [];
  recipients: User[] = [];
  filteredRecipients: User[] = [];
  selectedIds = new Set<number>();
  title = '';
  message = '';
  targetClients = true;
  targetTechnicians = true;
  scope: 'roles' | 'manual' = 'roles';
  searchTerm = '';
  sending = false;
  errorMessage = '';
  lastResult: { targeted: number; in_app_created: number; push_sent: number; without_push_token: number } | null = null;

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.api.getUsers().subscribe({
      next: (users) => {
        this.users = users;
        this.applySelection();
        this.cdr.markForCheck();
      },
      error: () => {
        this.errorMessage = 'No se pudo cargar la lista de usuarios';
        this.cdr.markForCheck();
      },
    });
  }

  applySelection() {
    const roles = this.selectedRoles();
    const term = this.searchTerm.trim().toLowerCase();
    this.recipients = this.users.filter(user => roles.includes(user.role));
    this.filteredRecipients = this.recipients.filter(user => {
      if (!term) return true;
      return [user.full_name, user.email, user.phone].some(value => value.toLowerCase().includes(term));
    });
    this.selectedIds.forEach(id => {
      if (!this.recipients.some(user => user.id === id)) this.selectedIds.delete(id);
    });
  }

  selectedRoles(): string[] {
    const roles: string[] = [];
    if (this.targetClients) roles.push('client');
    if (this.targetTechnicians) roles.push('technician');
    return roles;
  }

  toggleUser(id: number) {
    this.selectedIds.has(id) ? this.selectedIds.delete(id) : this.selectedIds.add(id);
  }

  canSend() {
    if (!this.title.trim() || !this.message.trim()) return false;
    if (this.selectedRoles().length === 0) return false;
    if (this.scope === 'manual' && this.selectedIds.size === 0) return false;
    return true;
  }

  send() {
    if (!this.canSend()) return;
    this.sending = true;
    this.errorMessage = '';
    this.api.sendAdminPush({
      title: this.title.trim(),
      message: this.message.trim(),
      target_roles: this.selectedRoles(),
      user_ids: this.scope === 'manual' ? Array.from(this.selectedIds) : null,
    }).subscribe({
      next: (result) => {
        this.lastResult = result;
        this.sending = false;
        this.message = '';
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.errorMessage = err?.error?.detail || 'No se pudo enviar la notificacion';
        this.sending = false;
        this.cdr.markForCheck();
      },
    });
  }

  countRole(role: User['role']) {
    return this.users.filter(user => user.role === role).length;
  }

  roleLabel(role: User['role']) {
    return role === 'technician' ? 'Mecanico' : role === 'client' ? 'Cliente' : role;
  }

  initials(name: string) {
    const parts = name.split(' ').filter(Boolean);
    return parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : (parts[0]?.[0] || '?').toUpperCase();
  }
}