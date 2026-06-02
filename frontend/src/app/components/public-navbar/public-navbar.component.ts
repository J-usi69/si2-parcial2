import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-public-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <nav class="public-navbar" aria-label="Navegacion principal">
      <a routerLink="/" class="brand" aria-label="RescateYa inicio">
        <img src="logo.svg" alt="RescateYa" class="brand-logo">
        <span>RescateYa</span>
      </a>

      <div class="nav-actions">
        <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" class="nav-link">Inicio</a>
        <a routerLink="/login" routerLinkActive="active" class="nav-link">Ingresar</a>

        <button class="theme-btn" type="button" (click)="toggleTheme()" [title]="themeSvc.theme() === 'dark' ? 'Modo claro' : 'Modo oscuro'" aria-label="Cambiar tema">
          <span class="material-symbols-rounded">{{ themeSvc.theme() === 'dark' ? 'light_mode' : 'dark_mode' }}</span>
        </button>

        <a routerLink="/register" class="register-btn">
          <span>Registrar taller</span>
          <span class="material-symbols-rounded">arrow_forward</span>
        </a>
      </div>
    </nav>
  `,
  styles: [`
    .public-navbar {
      position: sticky;
      top: 0;
      z-index: 100;
      height: var(--navbar-height);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-md);
      padding: 0 clamp(var(--space-md), 4vw, var(--space-2xl));
      background: color-mix(in srgb, var(--color-bg) 92%, transparent);
      backdrop-filter: blur(14px);
    }

    .brand,
    .nav-actions,
    .nav-link,
    .theme-btn,
    .register-btn {
      display: flex;
      align-items: center;
    }

    .brand {
      min-width: 0;
      gap: var(--space-sm);
      font-family: 'Sora', sans-serif;
      font-size: 1.125rem;
      font-weight: 800;
      color: var(--color-text-primary);
    }

    .brand-logo {
      width: 2.5rem;
      height: 2.5rem;
      object-fit: contain;
      border-radius: var(--radius-sm);
      background: white;
      padding: 0.25rem;
      border: 1px solid var(--color-border);
      flex-shrink: 0;
    }

    .nav-actions {
      gap: var(--space-xs);
    }

    .nav-link,
    .theme-btn {
      min-height: 2.5rem;
      border-radius: var(--radius-sm);
      color: var(--color-text-secondary);
      transition: all var(--transition-fast);
    }

    .nav-link {
      padding: 0.625rem 0.75rem;
      font-weight: 700;
    }

    .nav-link:hover,
    .nav-link.active,
    .theme-btn:hover {
      color: var(--color-text-primary);
      background: var(--color-surface-alt);
    }

    .theme-btn {
      justify-content: center;
      width: 2.5rem;
    }

    .theme-btn .material-symbols-rounded {
      font-size: 1.25rem;
    }

    .register-btn {
      justify-content: center;
      gap: var(--space-sm);
      min-height: 2.75rem;
      padding: 0.75rem 1rem;
      border-radius: var(--radius-sm);
      background: var(--color-primary);
      color: var(--color-text-on-primary);
      font-weight: 800;
      line-height: 1;
      box-shadow: var(--shadow-sm);
      transition: transform var(--transition-fast), box-shadow var(--transition-fast), background var(--transition-fast);
    }

    .register-btn:hover {
      transform: translateY(-1px);
      background: var(--color-primary-dark);
      box-shadow: var(--shadow-md);
    }

    .register-btn .material-symbols-rounded {
      font-size: 1.25rem;
    }

    @media (max-width: 640px) {
      .public-navbar {
        padding-inline: var(--space-md);
      }

      .brand span,
      .nav-link,
      .register-btn span:first-child {
        display: none;
      }

      .register-btn {
        width: 2.75rem;
        padding: 0;
      }
    }
  `],
})
export class PublicNavbarComponent {
  constructor(public themeSvc: ThemeService) {}

  toggleTheme() {
    this.themeSvc.toggle();
  }
}