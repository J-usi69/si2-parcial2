import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PublicNavbarComponent } from '../../components/public-navbar/public-navbar.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PublicNavbarComponent],
  template: `
    <app-public-navbar></app-public-navbar>
    <div class="auth-page">
      <div class="auth-wrapper">
        <div class="auth-hero">
          <div class="hero-content">
            <img src="logo.svg" alt="RescateYa" class="hero-logo">
            <h2>Emergencias vehiculares con <span class="highlight">inteligencia artificial</span></h2>
            <p>Panel avanzado para talleres. Asignación automatica, monitoreo GPS en tiempo real y clasificación IA.</p>
            <div class="hero-metrics">
              <div class="metric">
                <span class="metric-value">24/7</span>
                <span class="metric-label">Disponible</span>
              </div>
              <div class="metric-divider"></div>
              <div class="metric">
                <span class="metric-value">IA</span>
                <span class="metric-label">Clasificación</span>
              </div>
              <div class="metric-divider"></div>
              <div class="metric">
                <span class="metric-value">GPS</span>
                <span class="metric-label">Tiempo real</span>
              </div>
            </div>
          </div>
        </div>

        <div class="auth-card">
          <div class="auth-card-inner">
            <div class="brand">
              <h1>Bienvenido</h1>
              <p>Ingresa a tu panel de gestión</p>
            </div>

            <form (ngSubmit)="onLogin()" class="auth-form" #f="ngForm">
              <div class="field">
                <label class="field-label">Correo electrónico</label>
                <div class="input-with-icon">
                  <span class="material-symbols-rounded">mail</span>
                  <input type="email" class="input" [(ngModel)]="email" name="email"
                    placeholder="correo&#64;taller.com" required autocomplete="email" />
                </div>
              </div>

              <div class="field">
                <label class="field-label">Contraseña</label>
                <div class="input-with-icon">
                  <span class="material-symbols-rounded">lock</span>
                  <input [type]="showPassword ? 'text' : 'password'" class="input"
                    [(ngModel)]="password" name="password" placeholder="••••••••"
                    required autocomplete="current-password" />
                  <button type="button" class="toggle-pass" (click)="showPassword = !showPassword" tabindex="-1">
                    <span class="material-symbols-rounded">{{ showPassword ? 'visibility_off' : 'visibility' }}</span>
                  </button>
                </div>
              </div>

              <div class="error-box" *ngIf="error">
                <span class="material-symbols-rounded">error</span>
                <span>{{ error }}</span>
              </div>

              <button type="submit" class="btn btn-primary btn-block login-btn" [disabled]="loading || !f.valid">
                <ng-container *ngIf="!loading">
                  <span>Ingresar al panel</span>
                  <span class="material-symbols-rounded">arrow_forward</span>
                </ng-container>
                <ng-container *ngIf="loading">
                  <span class="spinner"></span>
                  <span>Verificando...</span>
                </ng-container>
              </button>
            </form>

            <div class="auth-footer">
              <span>¿No tienes cuenta?</span>
              <a routerLink="/register">Crear cuenta de taller</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* ── Mobile-first: Auth page ── */
    .auth-page {
      min-height: calc(100vh - var(--navbar-height));
      display: flex; align-items: center; justify-content: center;
      background: var(--color-bg);
      padding: var(--space-sm);
    }

    .auth-wrapper {
      display: flex; flex-direction: column;
      max-width: 100%; width: 100%;
      border-radius: var(--radius-lg); overflow: hidden;
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      box-shadow: var(--shadow-lg);
      animation: revealUp 0.6s var(--ease-out) both;
    }

    .auth-hero {
      background: var(--color-primary);
      padding: var(--space-lg);
      display: flex; align-items: center;
    }

    .hero-content { position: relative; z-index: 1; }

    .hero-logo {
      width: 3rem; height: 3rem;
      border-radius: var(--radius-md);
      object-fit: contain; background: white; padding: 0.375rem;
      margin-bottom: var(--space-md);
    }

    .auth-hero h2 {
      font-size: 1.25rem; font-weight: 800; color: white;
      line-height: 1.3; letter-spacing: -0.03em;
      margin-bottom: var(--space-sm);
    }

    .highlight { color: var(--color-accent); }

    .auth-hero p {
      color: rgba(255,255,255,0.55); font-size: 0.875rem;
      line-height: 1.7; margin-bottom: var(--space-lg);
      max-width: 23.75rem;
    }

    /* Hidden on mobile */
    .hero-metrics { display: none; }

    .metric { display: flex; flex-direction: column; gap: 0.125rem; }
    .metric-value { font-family: 'JetBrains Mono', monospace; font-size: 1.125rem; font-weight: 700; color: white; }
    .metric-label { font-size: 0.625rem; font-weight: 600; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.1em; }
    .metric-divider { width: 1px; height: 1.75rem; background: rgba(255,255,255,0.1); }

    .auth-card {
      width: 100%; flex-shrink: 0;
      background: var(--color-surface); display: flex; align-items: center;
    }

    .auth-card-inner { width: 100%; padding: var(--space-lg) var(--space-md); }

    .brand { margin-bottom: var(--space-lg); }
    .brand h1 { font-size: 1.375rem; font-weight: 800; color: var(--color-text-primary); letter-spacing: -0.03em; margin-bottom: 0.25rem; }
    .brand p { color: var(--color-text-tertiary); font-size: 0.875rem; }

    .auth-form { display: flex; flex-direction: column; gap: var(--space-md); }

    .toggle-pass {
      position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%);
      padding: 0.375rem; border-radius: var(--radius-sm);
      color: var(--color-text-tertiary); display: flex; align-items: center;
      transition: all var(--transition-fast);
      &:hover { background: var(--color-surface-alt); color: var(--color-text-primary); }
      .material-symbols-rounded { font-size: 1.25rem; }
    }

    .login-btn { margin-top: var(--space-sm); min-height: 3rem; font-size: 0.9375rem; border-radius: var(--radius-md); font-weight: 700; letter-spacing: -0.01em; }

    .error-box {
      display: flex; align-items: center; gap: var(--space-sm);
      padding: 0.625rem 0.875rem;
      background: var(--color-danger-light);
      border-radius: var(--radius-md);
      color: var(--color-danger); font-size: 0.8125rem; font-weight: 500;
      animation: fadeIn 0.3s var(--ease-out);
      .material-symbols-rounded { font-size: 1.125rem; }
    }

    .spinner { width: 1.125rem; height: 1.125rem; border: 2.5px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .auth-footer {
      text-align: center; margin-top: var(--space-lg);
      padding-top: var(--space-md); border-top: 1px solid var(--color-divider);
      color: var(--color-text-tertiary); font-size: 0.875rem;
      display: flex; align-items: center; justify-content: center; gap: 0.375rem;
      a { color: var(--color-blue); font-weight: 700; &:hover { color: var(--color-accent); } }
    }

    /* ── ≥576px: more padding ── */
    @media (min-width: 576px) {
      .auth-page { padding: var(--space-md); }
      .auth-wrapper { max-width: 31.25rem; border-radius: var(--radius-xl); }
      .auth-card-inner { padding: var(--space-xl) var(--space-lg); }
      .auth-hero { padding: var(--space-xl); }
      .auth-hero h2 { font-size: 1.375rem; }
    }

    /* ── ≥768px: side-by-side layout, show metrics ── */
    @media (min-width: 768px) {
      .auth-wrapper { flex-direction: row; max-width: 60rem; }
      .auth-hero { flex: 1; padding: var(--space-2xl); }
      .auth-hero h2 { font-size: 1.625rem; }
      .hero-logo { width: 3.5rem; height: 3.5rem; }
      .hero-metrics {
        display: flex; align-items: center; gap: var(--space-lg);
        padding-top: var(--space-lg);
        border-top: 1px solid rgba(255,255,255,0.1);
      }
      .auth-card { width: 26.25rem; }
      .auth-card-inner { padding: var(--space-2xl) var(--space-xl); }
      .brand { margin-bottom: var(--space-xl); }
      .brand h1 { font-size: 1.625rem; }
    }
  `],
})
export class LoginComponent implements OnInit {
  email = '';
  password = '';
  error = '';
  loading = false;
  showPassword = false;

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  ngOnInit() {
    if (this.auth.isLoggedIn()) {
      this.router.navigate([this.getHomeRoute()]);
    }
  }

  onLogin() {
    this.loading = true;
    this.error = '';
    this.auth.login(this.email, this.password).subscribe({
      next: () => {
        const role = this.auth.getCurrentUser()?.role;
        if (role === 'client' || role === 'technician') {
          this.auth.logout();
          this.error = 'Esta cuenta debe ingresar desde la app movil de RescateYa.';
          this.loading = false;
          return;
        }
        this.router.navigate([this.getHomeRoute()]);
      },
      error: (err) => {
        this.error = err.error?.detail || 'Error al iniciar sesion';
        this.loading = false;
      },
    });
  }

  private getHomeRoute(): string {
    const role = this.auth.getCurrentUser()?.role;
    if (role === 'client' || role === 'technician') {
      this.auth.logout();
      return '/login';
    }
    return '/dashboard';
  }
}
