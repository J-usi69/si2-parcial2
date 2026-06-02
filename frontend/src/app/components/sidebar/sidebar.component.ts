import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <aside class="sidebar" [class.collapsed]="collapsed" [class.mobile-open]="mobileOpen">
      <!-- Brand -->
      <div class="sidebar-brand">
        <a routerLink="/dashboard" class="brand-link">
          <div class="brand-icon">
            <img src="logo.png" alt="RescateYa" class="brand-logo">
          </div>
          <span class="brand-name" *ngIf="!collapsed">RescateYa</span>
        </a>
        <button class="collapse-btn" (click)="toggle()" [title]="collapsed ? 'Expandir' : 'Colapsar'">
          <span class="material-symbols-rounded">{{ collapsed ? 'menu' : 'menu_open' }}</span>
        </button>
      </div>

      <!-- Navigation -->
      <nav class="sidebar-nav">
        <div class="nav-section" *ngIf="role === 'admin'; else nonAdminNav">
          <span class="nav-label" *ngIf="!collapsed">PRINCIPAL</span>
          <a routerLink="/dashboard" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" class="nav-item" [title]="collapsed ? 'Resumen' : ''">
            <span class="material-symbols-rounded">dashboard</span>
            <span class="nav-text" *ngIf="!collapsed">Resumen</span>
          </a>
          <a routerLink="/incidents" routerLinkActive="active" class="nav-item" [title]="collapsed ? 'Incidentes' : ''">
            <span class="material-symbols-rounded">warning</span>
            <span class="nav-text" *ngIf="!collapsed">Incidentes</span>
            <span class="nav-badge" *ngIf="pendingCount > 0 && !collapsed">{{ pendingCount }}</span>
            <span class="nav-dot" *ngIf="pendingCount > 0 && collapsed"></span>
          </a>
          <span class="nav-label section-gap" *ngIf="!collapsed">ADMINISTRACION</span>
          <a routerLink="/admin/workshops" routerLinkActive="active" class="nav-item" [title]="collapsed ? 'Talleres' : ''">
            <span class="material-symbols-rounded">store</span>
            <span class="nav-text" *ngIf="!collapsed">Talleres</span>
          </a>
          <a routerLink="/admin/users" routerLinkActive="active" class="nav-item" [title]="collapsed ? 'Usuarios' : ''">
            <span class="material-symbols-rounded">groups</span>
            <span class="nav-text" *ngIf="!collapsed">Usuarios</span>
          </a>
          <a routerLink="/admin/notifications" routerLinkActive="active" class="nav-item" [title]="collapsed ? 'Notificaciones' : ''">
            <span class="material-symbols-rounded">campaign</span>
            <span class="nav-text" *ngIf="!collapsed">Notificaciones</span>
          </a>
          <a routerLink="/admin/payments" routerLinkActive="active" class="nav-item" [title]="collapsed ? 'Pagos' : ''">
            <span class="material-symbols-rounded">payments</span>
            <span class="nav-text" *ngIf="!collapsed">Pagos</span>
          </a>
          <a routerLink="/kpis" routerLinkActive="active" class="nav-item" [title]="collapsed ? 'KPIs' : ''">
            <span class="material-symbols-rounded">insights</span>
            <span class="nav-text" *ngIf="!collapsed">KPIs</span>
          </a>
          <a routerLink="/reports-ai" routerLinkActive="active" class="nav-item" [title]="collapsed ? 'Reportes IA' : ''">
            <span class="material-symbols-rounded">auto_awesome</span>
            <span class="nav-text" *ngIf="!collapsed">Reportes IA</span>
          </a>
          <a routerLink="/reports" routerLinkActive="active" class="nav-item" [title]="collapsed ? 'Reportes' : ''">
            <span class="material-symbols-rounded">bar_chart</span>
            <span class="nav-text" *ngIf="!collapsed">Reportes</span>
          </a>
        </div>

        <ng-template #nonAdminNav>
          <ng-container *ngTemplateOutlet="workshopNav"></ng-container>
        </ng-template>

        <ng-template #workshopNav>
          <div class="nav-section">
            <span class="nav-label" *ngIf="!collapsed">PRINCIPAL</span>
            <a routerLink="/dashboard" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" class="nav-item" [title]="collapsed ? 'Dashboard' : ''">
              <span class="material-symbols-rounded">dashboard</span>
              <span class="nav-text" *ngIf="!collapsed">Dashboard</span>
            </a>
            <a routerLink="/incidents" routerLinkActive="active" class="nav-item" [title]="collapsed ? 'Solicitudes' : ''">
              <span class="material-symbols-rounded">warning</span>
              <span class="nav-text" *ngIf="!collapsed">Solicitudes</span>
              <span class="nav-badge" *ngIf="pendingCount > 0 && !collapsed">{{ pendingCount }}</span>
              <span class="nav-dot" *ngIf="pendingCount > 0 && collapsed"></span>
            </a>
            <a routerLink="/invitations" routerLinkActive="active" class="nav-item" [title]="collapsed ? 'Invitaciones' : ''">
              <span class="material-symbols-rounded">mark_email_unread</span>
              <span class="nav-text" *ngIf="!collapsed">Invitaciones</span>
            </a>
          </div>

          <div class="nav-section">
            <span class="nav-label" *ngIf="!collapsed">GESTION DEL TALLER</span>
            <a *ngIf="role === 'workshop'" routerLink="/technicians" routerLinkActive="active" class="nav-item" [title]="collapsed ? 'Tecnicos' : ''">
              <span class="material-symbols-rounded">engineering</span>
              <span class="nav-text" *ngIf="!collapsed">Tecnicos</span>
            </a>
            <a routerLink="/history" routerLinkActive="active" class="nav-item" [title]="collapsed ? 'Historial' : ''">
              <span class="material-symbols-rounded">history</span>
              <span class="nav-text" *ngIf="!collapsed">Historial</span>
            </a>
            <a routerLink="/kpis" routerLinkActive="active" class="nav-item" [title]="collapsed ? 'KPIs' : ''">
              <span class="material-symbols-rounded">insights</span>
              <span class="nav-text" *ngIf="!collapsed">KPIs</span>
            </a>
            <a routerLink="/reports-ai" routerLinkActive="active" class="nav-item" [title]="collapsed ? 'Reportes IA' : ''">
              <span class="material-symbols-rounded">auto_awesome</span>
              <span class="nav-text" *ngIf="!collapsed">Reportes IA</span>
            </a>
            <a routerLink="/reports" routerLinkActive="active" class="nav-item" [title]="collapsed ? 'Reportes' : ''">
              <span class="material-symbols-rounded">bar_chart</span>
              <span class="nav-text" *ngIf="!collapsed">Reportes</span>
            </a>
          </div>
        </ng-template>

        <div class="nav-section">
          <span class="nav-label" *ngIf="!collapsed">CUENTA</span>
          <a routerLink="/profile" routerLinkActive="active" class="nav-item" [title]="collapsed ? 'Mi Perfil' : ''">
            <span class="material-symbols-rounded">settings</span>
            <span class="nav-text" *ngIf="!collapsed">Mi Perfil</span>
          </a>
        </div>
      </nav>

      <!-- Footer -->
      <div class="sidebar-footer">
        <div class="footer-divider"></div>
        <div class="sidebar-version" *ngIf="!collapsed">
          <span class="material-symbols-rounded">info</span>
          <span>RescateYa v2.0</span>
        </div>
      </div>
    </aside>
    <div class="sidebar-overlay" [class.visible]="mobileOpen" (click)="closeMobile()"></div>
  `,
  styles: [`
    /* ── Mobile-first: sidebar hidden off-screen by default ── */
    .sidebar {
      position: fixed;
      top: 0; left: 0; bottom: 0;
      width: var(--sidebar-width);
      background: var(--sidebar-bg);
      display: flex; flex-direction: column;
      z-index: 200;
      transition: transform 0.3s var(--ease-spring), width 0.3s var(--ease-spring);
      overflow: hidden;
      transform: translateX(-100%);
    }

    .sidebar.mobile-open {
      transform: translateX(0);
    }

    .sidebar-brand {
      height: var(--navbar-height);
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 0.875rem;
      flex-shrink: 0;
    }

    .brand-link { display: flex; align-items: center; gap: 0.625rem; overflow: hidden; }

    .brand-icon {
      width: 2.375rem; height: 2.375rem; border-radius: 0.625rem;
      background: var(--color-surface-alt); display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }

    .brand-logo { width: 1.75rem; height: 1.75rem; object-fit: contain; }

    .brand-name {
      font-size: 1.125rem; font-weight: 800; color: var(--sidebar-text-active);
      white-space: nowrap; letter-spacing: -0.03em;
    }

    .collapse-btn {
      width: 1.875rem; height: 1.875rem; border-radius: 0.5rem;
      display: none; align-items: center; justify-content: center;
      color: var(--sidebar-text); transition: all 0.2s var(--ease-out);
      flex-shrink: 0;
      .material-symbols-rounded { font-size: 1.25rem; }
      &:hover { background: var(--sidebar-hover); color: var(--sidebar-text-active); }
    }

    .sidebar-nav {
      flex: 1; overflow-y: auto; overflow-x: hidden;
      padding: 1rem 0.625rem;
      display: flex; flex-direction: column; gap: 0.25rem;
    }

    .nav-section { display: flex; flex-direction: column; gap: 0.125rem; margin-bottom: 1rem; }

    .section-gap { margin-top: 1rem; }

    .nav-label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.5625rem; font-weight: 700;
      color: var(--sidebar-text);
      text-transform: uppercase; letter-spacing: 0.14em;
      padding: 0 0.875rem; margin-bottom: 0.5rem; white-space: nowrap;
    }

    .nav-item {
      display: flex; align-items: center; gap: 0.75rem;
      padding: 0.625rem 0.875rem; border-radius: 0.625rem;
      color: var(--sidebar-text); font-size: 0.875rem; font-weight: 500;
      transition: all 0.2s var(--ease-out);
      position: relative; white-space: nowrap; overflow: hidden;

      .material-symbols-rounded { font-size: 1.3125rem; flex-shrink: 0; transition: color 0.2s; }

      &:hover { background: var(--sidebar-hover); color: var(--sidebar-text-active); }

      &.active {
        background: var(--sidebar-active-bg);
        color: var(--sidebar-text-active); font-weight: 600;
        .material-symbols-rounded { color: var(--color-accent); }
        &::before {
          content: ''; position: absolute; left: 0; top: 50%; transform: translateY(-50%);
          width: 3px; height: 1.375rem;
          background: var(--color-accent);
          border-radius: 0 4px 4px 0;
        }
      }
    }

    .nav-text { overflow: hidden; text-overflow: ellipsis; }

    .nav-badge {
      margin-left: auto; min-width: 1.25rem; height: 1.25rem; padding: 0 0.375rem;
      background: var(--color-accent); color: white; border-radius: 0.625rem;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.625rem; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }

    .nav-dot {
      position: absolute; top: 0.5rem; right: 0.5rem;
      width: 0.5rem; height: 0.5rem;
      background: var(--color-accent); border-radius: 50%;
    }

    .sidebar-footer { flex-shrink: 0; padding: 0.75rem; }
    .footer-divider { display: none; }

    .sidebar-version {
      display: flex; align-items: center; gap: 0.5rem;
      padding: 0.5rem 0.875rem; color: var(--sidebar-text);
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.625rem; white-space: nowrap;
      .material-symbols-rounded { font-size: 0.9375rem; }
    }

    /* Mobile overlay */
    .sidebar-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 199;
      backdrop-filter: blur(2px);
    }

    .sidebar-overlay.visible {
      display: block;
    }

    /* ── Tablet (≥768px): show sidebar fixed, collapsed by default ── */
    @media (min-width: 768px) {
      .sidebar {
        transform: translateX(0);
        width: var(--sidebar-collapsed);
      }
      .sidebar.collapsed { width: var(--sidebar-collapsed); }
      .sidebar:not(.collapsed) { width: var(--sidebar-width); }

      .collapse-btn { display: flex; }

      .collapsed .sidebar-brand { justify-content: center; padding: 0; }
      .collapsed .brand-link { display: none; }
      .collapsed .nav-item { justify-content: center; padding: 0.625rem; }

      .sidebar-overlay { display: none !important; }
    }

    /* ── Desktop (≥1024px): sidebar expanded by default ── */
    @media (min-width: 1024px) {
      .sidebar {
        width: var(--sidebar-width);
      }
      .sidebar.collapsed { width: var(--sidebar-collapsed); }
    }
  `]
})
export class SidebarComponent {
  @Input() collapsed = false;
  @Input() pendingCount = 0;
  @Input() mobileOpen = false;
  @Input() role: 'workshop' | 'admin' | null = null;
  @Output() collapsedChange = new EventEmitter<boolean>();
  @Output() mobileOpenChange = new EventEmitter<boolean>();

  toggle() {
    this.collapsed = !this.collapsed;
    this.collapsedChange.emit(this.collapsed);
  }

  closeMobile() {
    this.mobileOpen = false;
    this.mobileOpenChange.emit(false);
  }

  @HostListener('click', ['$event'])
  onNavClick(event: Event) {
    const target = event.target as HTMLElement;
    if (target.closest('.nav-item') && this.mobileOpen) {
      this.closeMobile();
    }
  }
}
