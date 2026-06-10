import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { User } from '../../models/interfaces';
import { AppIconComponent } from '../../shared/app-icon.component';

@Component({
  selector: 'app-admin-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule, AppIconComponent],
  template: `
    <div class="animate-reveal space-y-6">
      <header class="space-y-1">
        <h1 class="font-display text-3xl font-bold text-slate-900 dark:text-white">Notificaciones push</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">Envío de avisos a clientes y mecánicos de la app móvil</p>
      </header>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-hero-line dark:bg-hero-soft">
          <div class="mb-6 flex items-start gap-3">
            <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/8 text-slate-900 dark:text-white"><app-icon name="campaign" /></div>
            <div>
              <h3 class="font-display text-base font-bold text-slate-900 dark:text-white">Nuevo mensaje</h3>
              <p class="text-xs text-slate-400">Se guardará en notificaciones y se enviará como push si el usuario tiene token activo.</p>
            </div>
          </div>

          <div class="mb-4">
            <label class="mb-1.5 block text-sm font-semibold text-slate-600 dark:text-slate-300">Título</label>
            <input [(ngModel)]="title" maxlength="80" placeholder="Ej. Mantenimiento programado" [ngClass]="inputCls">
          </div>

          <div class="mb-4">
            <label class="mb-1.5 block text-sm font-semibold text-slate-600 dark:text-slate-300">Mensaje</label>
            <textarea [(ngModel)]="message" maxlength="240" rows="5" placeholder="Escribe el mensaje que recibirán en mobile" [ngClass]="inputCls" class="min-h-32 resize-y"></textarea>
            <small class="mt-1 block text-right text-xs text-slate-400">{{ message.length }}/240</small>
          </div>

          <div class="mb-4">
            <label class="mb-1.5 block text-sm font-semibold text-slate-600 dark:text-slate-300">Destinatarios</label>
            <div class="flex flex-wrap gap-2">
              <button type="button" (click)="targetClients = !targetClients; applySelection()"
                class="inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition"
                [ngClass]="targetClients ? 'border-slate-900 dark:border-white/60 bg-slate-100 dark:bg-white/8 text-slate-900 dark:text-white' : 'border-transparent bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300'">
                <app-icon name="directions_car" [size]="18" /> Clientes
              </button>
              <button type="button" (click)="targetTechnicians = !targetTechnicians; applySelection()"
                class="inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition"
                [ngClass]="targetTechnicians ? 'border-slate-900 dark:border-white/60 bg-slate-100 dark:bg-white/8 text-slate-900 dark:text-white' : 'border-transparent bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300'">
                <app-icon name="engineering" [size]="18" /> Mecánicos
              </button>
            </div>
          </div>

          <div class="mb-4">
            <label class="mb-1.5 block text-sm font-semibold text-slate-600 dark:text-slate-300">Alcance</label>
            <select [(ngModel)]="scope" (change)="applySelection()" [ngClass]="inputCls" class="cursor-pointer">
              <option value="roles">Todos los roles seleccionados</option>
              <option value="manual">Selección manual</option>
            </select>
          </div>

          <div class="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-hero-line dark:bg-white/5" *ngIf="scope === 'manual'">
            <div class="relative mb-3">
              <app-icon name="search" [size]="18" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2  text-slate-400" />
              <input [(ngModel)]="searchTerm" (input)="applySelection()" placeholder="Buscar destinatario" [ngClass]="inputCls">
            </div>
            <div class="grid max-h-80 gap-1 overflow-auto">
              <label class="flex cursor-pointer items-center gap-3 rounded-lg bg-white p-2.5 transition hover:bg-slate-50 dark:bg-hero-soft dark:hover:bg-white/5" *ngFor="let user of filteredRecipients">
                <input type="checkbox" [checked]="selectedIds.has(user.id)" (change)="toggleUser(user.id)" class="h-4 w-4 accent-slate-900 dark:accent-white">
                <span class="flex h-8 w-8 items-center justify-center rounded-full bg-[#111111] dark:bg-white dark:text-[#111111] text-xs font-bold text-white">{{ initials(user.full_name) }}</span>
                <span class="flex min-w-0 flex-col">
                  <strong class="text-sm font-semibold text-slate-800 dark:text-slate-100">{{ user.full_name }}</strong>
                  <small class="truncate text-xs text-slate-400">{{ user.email }} · {{ roleLabel(user.role) }}</small>
                </span>
              </label>
            </div>
          </div>

          <div class="mb-4 flex items-center gap-2 rounded-xl bg-emergency-500/10 px-4 py-3 text-sm font-semibold text-emergency-600 dark:text-emergency-300" *ngIf="errorMessage">
            <app-icon name="error" /> {{ errorMessage }}
          </div>

          <button [disabled]="sending || !canSend()" (click)="send()"
            class="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#111111] dark:bg-white dark:text-[#111111] px-5 py-3 text-sm font-semibold text-white shadow-[0_2px_12px_rgba(0,0,0,0.12)] transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50">
            <app-icon [name]="sending ? 'progress_activity' : 'send'" [size]="20" />
            {{ sending ? 'Enviando...' : 'Enviar notificación' }}
          </button>
        </section>

        <aside class="space-y-4">
          <div class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-card dark:border-hero-line dark:bg-hero-soft">
            <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-success/10 text-success"><app-icon name="directions_car" /></div>
            <div><strong class="block font-mono text-2xl font-bold text-slate-900 dark:text-white">{{ countRole('client') }}</strong><small class="text-xs font-semibold uppercase tracking-wide text-slate-400">Clientes mobile</small></div>
          </div>
          <div class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-card dark:border-hero-line dark:bg-hero-soft">
            <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-info/10 text-info"><app-icon name="engineering" /></div>
            <div><strong class="block font-mono text-2xl font-bold text-slate-900 dark:text-white">{{ countRole('technician') }}</strong><small class="text-xs font-semibold uppercase tracking-wide text-slate-400">Mecánicos mobile</small></div>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-card dark:border-hero-line dark:bg-hero-soft" *ngIf="lastResult">
            <h3 class="mb-3 font-display text-base font-bold text-slate-900 dark:text-white">Resultado del envío</h3>
            <div class="flex justify-between border-b border-slate-100 py-2 text-sm text-slate-500 dark:border-hero-line/60 dark:text-slate-400"><span>Destinatarios</span><strong class="text-slate-900 dark:text-white">{{ lastResult.targeted }}</strong></div>
            <div class="flex justify-between border-b border-slate-100 py-2 text-sm text-slate-500 dark:border-hero-line/60 dark:text-slate-400"><span>Notificaciones creadas</span><strong class="text-slate-900 dark:text-white">{{ lastResult.in_app_created }}</strong></div>
            <div class="flex justify-between border-b border-slate-100 py-2 text-sm text-slate-500 dark:border-hero-line/60 dark:text-slate-400"><span>Push enviados</span><strong class="text-slate-900 dark:text-white">{{ lastResult.push_sent }}</strong></div>
            <div class="flex justify-between py-2 text-sm text-slate-500 dark:text-slate-400"><span>Sin token push</span><strong class="text-slate-900 dark:text-white">{{ lastResult.without_push_token }}</strong></div>
          </div>
        </aside>
      </div>
    </div>
  `,
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

  readonly inputCls =
    'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-900 dark:border-white/60 focus:bg-white dark:focus:bg-white/10 focus:ring-2 focus:ring-slate-900 dark:ring-white/20 dark:border-hero-line dark:bg-white/5 dark:text-slate-200 dark:[color-scheme:dark]';

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