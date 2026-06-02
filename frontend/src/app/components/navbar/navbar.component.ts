import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { WebSocketService } from '../../services/websocket.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <nav class="navbar">
      <div class="nav-inner">
        <a routerLink="/dashboard" class="nav-brand">
          <div class="brand-icon">
            <img src="logo.svg" alt="RescateYa" class="brand-logo">
          </div>
          <div class="brand-text">
            <span class="brand-name">RescateYa</span>
            <span class="brand-tag">Panel Taller</span>
          </div>
        </a>

        <div class="nav-links">
          <a routerLink="/dashboard" routerLinkActive="active">
            <span class="material-symbols-rounded">dashboard</span>
            <span>Dashboard</span>
          </a>
          <a routerLink="/incidents" routerLinkActive="active">
            <span class="material-symbols-rounded">warning</span>
            <span>Incidentes</span>
          </a>
          <a routerLink="/technicians" routerLinkActive="active">
            <span class="material-symbols-rounded">engineering</span>
            <span>Tecnicos</span>
          </a>
          <a routerLink="/history" routerLinkActive="active">
            <span class="material-symbols-rounded">history</span>
            <span>Historial</span>
          </a>
        </div>

        <div class="nav-right">
          <button class="icon-btn" title="Notificaciones">
            <span class="material-symbols-rounded">notifications</span>
            <span class="notification-dot" *ngIf="unreadCount > 0">
              {{ unreadCount > 9 ? '9+' : unreadCount }}
            </span>
          </button>

          <div class="divider"></div>

          <div class="user-info">
            <div class="user-avatar">{{ initials }}</div>
            <div class="user-meta">
              <span class="user-name">{{ userName || 'Taller' }}</span>
              <span class="user-role">Workshop</span>
            </div>
          </div>

          <button class="icon-btn logout-btn" (click)="logout()" title="Cerrar sesion">
            <span class="material-symbols-rounded">logout</span>
          </button>
        </div>
      </div>
    </nav>
  `,
  styles: [
    `
      .navbar {
        position: sticky;
        top: 0;
        z-index: 100;
        background: var(--color-surface);
        border-bottom: 1px solid var(--color-border);
        box-shadow: var(--shadow-sm);
      }

      .nav-inner {
        max-width: 1440px;
        margin: 0 auto;
        height: var(--navbar-height);
        padding: 0 var(--space-xl);
        display: flex;
        align-items: center;
        gap: var(--space-xl);
      }

      .nav-brand {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        flex-shrink: 0;
      }

      .brand-icon {
        width: 40px;
        height: 40px;
        background: white;
        border-radius: var(--radius-md);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        border: 1px solid var(--color-border);

        .brand-logo {
          width: 30px;
          height: 30px;
          object-fit: contain;
        }
      }

      .brand-text {
        display: flex;
        flex-direction: column;
        line-height: 1.1;
      }

      .brand-name {
        font-size: 16px;
        font-weight: 800;
        color: var(--color-primary);
      }

      .brand-tag {
        font-size: 10px;
        font-weight: 600;
        color: var(--color-text-tertiary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .nav-links {
        display: flex;
        gap: 4px;
        flex: 1;
        margin-left: var(--space-md);
      }

      .nav-links a {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        border-radius: var(--radius-md);
        color: var(--color-text-secondary);
        font-size: 14px;
        font-weight: 500;
        transition: all var(--transition-fast);
        position: relative;

        .material-symbols-rounded {
          font-size: 20px;
        }

        &:hover {
          background: var(--color-surface-alt);
          color: var(--color-text-primary);
        }

        &.active {
          background: var(--color-primary-50);
          color: var(--color-primary);
          font-weight: 600;
        }
      }

      .nav-right {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
      }

      .icon-btn {
        position: relative;
        width: 40px;
        height: 40px;
        border-radius: var(--radius-md);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--color-text-secondary);
        transition: all var(--transition-fast);

        .material-symbols-rounded {
          font-size: 22px;
        }

        &:hover {
          background: var(--color-surface-alt);
          color: var(--color-text-primary);
        }

        &.logout-btn:hover {
          background: rgba(230, 57, 70, 0.08);
          color: var(--color-danger);
        }
      }

      .notification-dot {
        position: absolute;
        top: 4px;
        right: 4px;
        min-width: 18px;
        height: 18px;
        padding: 0 4px;
        background: var(--color-accent);
        color: white;
        border-radius: var(--radius-pill);
        font-size: 10px;
        font-weight: 800;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid var(--color-surface);
      }

      .divider {
        width: 1px;
        height: 28px;
        background: var(--color-border);
      }

      .user-info {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        padding: 4px 8px;
        border-radius: var(--radius-md);
      }

      .user-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: var(--gradient-primary);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 13px;
      }

      .user-meta {
        display: flex;
        flex-direction: column;
        line-height: 1.2;
      }

      .user-name {
        font-size: 13px;
        font-weight: 600;
        color: var(--color-text-primary);
        max-width: 140px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .user-role {
        font-size: 10px;
        font-weight: 600;
        color: var(--color-text-tertiary);
        text-transform: uppercase;
        letter-spacing: 0.4px;
      }

      @media (max-width: 900px) {
        .nav-links a span:not(.material-symbols-rounded) {
          display: none;
        }
        .user-meta {
          display: none;
        }
        .brand-text {
          display: none;
        }
      }
    `,
  ],
})
export class NavbarComponent implements OnInit, OnDestroy {
  userName = '';
  unreadCount = 0;
  private wsSub: Subscription | null = null;

  constructor(
    private auth: AuthService,
    private api: ApiService,
    private router: Router,
    private wsService: WebSocketService,
  ) {}

  ngOnInit() {
    const user = this.auth.getCurrentUser();
    this.userName = user?.full_name || '';
    this.api.getUnreadCount().subscribe({
      next: (res) => (this.unreadCount = res.count),
      error: () => (this.unreadCount = 0),
    });

    // Connect WebSocket for real-time notifications
    this.wsService.connect();
    this.wsSub = this.wsService.notifications$.subscribe(() => {
      this.unreadCount++;
    });
  }

  ngOnDestroy() {
    this.wsSub?.unsubscribe();
  }

  get initials(): string {
    if (!this.userName) return 'T';
    const parts = this.userName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
