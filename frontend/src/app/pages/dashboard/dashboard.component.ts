import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { Incident, Workshop, Review } from '../../models/interfaces';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page-content reveal">
        <!-- Header -->
        <div class="page-header">
          <div>
            <h1 class="page-title">{{ greeting }}, {{ firstName }} 👋</h1>
            <p class="page-subtitle">Aqui tienes un resumen de tu taller</p>
          </div>
          <a routerLink="/incidents" class="btn btn-primary">
            <span class="material-symbols-rounded">visibility</span>
            Ver incidentes
          </a>
        </div>

        <!-- Workshop setup card -->
        <div class="setup-card" *ngIf="!workshop && !loading">
          <div class="setup-icon">
            <span class="material-symbols-rounded">store</span>
          </div>
          <div class="setup-content">
            <h3>Configura tu taller</h3>
            <p>
              Necesitas registrar la informacion de tu taller para empezar a
              recibir solicitudes de emergencia.
            </p>
          </div>
          <button class="btn btn-primary">
            <span class="material-symbols-rounded">settings</span>
            Configurar
          </button>
        </div>

        <!-- Error banner -->
        <div class="error-banner" *ngIf="error && !loading">
          <span class="material-symbols-rounded">cloud_off</span>
          <span>No se pudo cargar la informacion</span>
          <button class="btn btn-sm" (click)="loadData()">
            <span class="material-symbols-rounded">refresh</span>
            Reintentar
          </button>
        </div>

        <!-- Stats -->
        <div class="stats-grid stagger" *ngIf="workshop || loading">
          <div class="stat-card stat-pending">
            <div class="stat-icon">
              <span class="material-symbols-rounded">schedule</span>
            </div>
            <div class="stat-content">
              <div class="stat-label">Pendientes</div>
              <div class="stat-number">{{ pendingCount }}</div>
            </div>
            <div class="stat-trend" [class.up]="pendingCount > 0">
              <span class="material-symbols-rounded">{{ pendingCount > 0 ? 'trending_up' : 'trending_flat' }}</span>
            </div>
          </div>

          <div class="stat-card stat-progress">
            <div class="stat-icon">
              <span class="material-symbols-rounded">build</span>
            </div>
            <div class="stat-content">
              <div class="stat-label">En proceso</div>
              <div class="stat-number">{{ inProgressCount }}</div>
            </div>
            <div class="stat-trend">
              <span class="material-symbols-rounded">trending_flat</span>
            </div>
          </div>

          <div class="stat-card stat-completed">
            <div class="stat-icon">
              <span class="material-symbols-rounded">check_circle</span>
            </div>
            <div class="stat-content">
              <div class="stat-label">Completados</div>
              <div class="stat-number">{{ completedCount }}</div>
            </div>
            <div class="stat-trend up">
              <span class="material-symbols-rounded">trending_up</span>
            </div>
          </div>

          <div class="stat-card stat-rating">
            <div class="stat-icon">
              <span class="material-symbols-rounded">star</span>
            </div>
            <div class="stat-content">
              <div class="stat-label">Rating</div>
              <div class="stat-number">
                {{ (workshop?.rating || 0) | number: '1.1-1' }}
              </div>
            </div>
            <div class="stat-trend up">
              <span class="material-symbols-rounded">star_half</span>
            </div>
          </div>
        </div>

        <!-- Charts row -->
        <div class="charts-row" *ngIf="workshop">
          <!-- Weekly activity chart -->
          <div class="card chart-card">
            <div class="card-header">
              <h3>
                <span class="material-symbols-rounded">bar_chart</span>
                Actividad semanal
              </h3>
              <span class="chart-period">Ultimos 7 dias</span>
            </div>
            <div class="bar-chart">
              <div class="bar-item" *ngFor="let bar of weeklyBars">
                <div class="bar-wrapper">
                  <div class="bar-fill" [style.height.%]="bar.pct" [class]="'bar-' + bar.color"></div>
                </div>
                <span class="bar-label">{{ bar.day }}</span>
              </div>
            </div>
          </div>

          <!-- Category distribution -->
          <div class="card chart-card">
            <div class="card-header">
              <h3>
                <span class="material-symbols-rounded">donut_large</span>
                Distribucion por categoria
              </h3>
            </div>
            <div class="category-list">
              <div class="category-item" *ngFor="let cat of categoryStats">
                <div class="category-icon" [class]="'cat-icon-' + cat.key">
                  <span class="material-symbols-rounded">{{ getCategoryIcon(cat.key) }}</span>
                </div>
                <div class="category-info">
                  <div class="category-head">
                    <span class="category-name">{{ cat.label }}</span>
                    <span class="category-count">{{ cat.count }}</span>
                  </div>
                  <div class="progress-bar">
                    <div class="progress-fill" [class]="'fill-' + cat.key" [style.width.%]="cat.pct"></div>
                  </div>
                </div>
              </div>
              <div class="empty-categories" *ngIf="categoryStats.length === 0">
                <span class="material-symbols-rounded">pie_chart</span>
                <p>Sin datos de categorias aun</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Bottom row: recent incidents + activity timeline -->
        <div class="bottom-row" *ngIf="workshop">
          <!-- Recent incidents -->
          <div class="card">
            <div class="card-header">
              <h3>
                <span class="material-symbols-rounded">notifications_active</span>
                Solicitudes recientes
              </h3>
              <a routerLink="/incidents" class="see-all">
                Ver todas
                <span class="material-symbols-rounded">arrow_forward</span>
              </a>
            </div>

            <div class="incident-list" *ngIf="recentIncidents.length > 0; else emptyTpl">
              <a
                *ngFor="let inc of recentIncidents"
                [routerLink]="['/incidents', inc.id]"
                class="incident-row"
              >
                <div class="incident-icon" [class]="'cat-' + inc.category">
                  <span class="material-symbols-rounded">{{
                    getCategoryIcon(inc.category)
                  }}</span>
                </div>
                <div class="incident-body">
                  <div class="incident-title-row">
                    <span class="incident-id">#{{ inc.id }}</span>
                    <span
                      class="badge"
                      [ngClass]="'badge-priority-' + inc.priority"
                    >
                      {{ inc.priority | uppercase }}
                    </span>
                    <span
                      class="badge badge-soft"
                      [ngClass]="'badge-status-' + inc.status"
                    >
                      {{ getStatusLabel(inc.status) }}
                    </span>
                  </div>
                  <p class="incident-summary">
                    {{ inc.ai_summary || inc.description || 'Sin descripcion' }}
                  </p>
                  <div class="incident-meta">
                    <span>
                      <span class="material-symbols-rounded">location_on</span>
                      {{ inc.address || ('Lat: ' + inc.latitude.toFixed(4)) }}
                    </span>
                    <span>
                      <span class="material-symbols-rounded">schedule</span>
                      {{ inc.created_at | date: 'short' }}
                    </span>
                  </div>
                </div>
                <span class="material-symbols-rounded chevron">chevron_right</span>
              </a>
            </div>

            <ng-template #emptyTpl>
              <div class="empty-state">
                <div class="empty-icon">
                  <span class="material-symbols-rounded">inbox</span>
                </div>
                <h3>Sin solicitudes</h3>
                <p>Las nuevas emergencias apareceran aqui.</p>
              </div>
            </ng-template>
          </div>

          <!-- Activity timeline -->
          <div class="card timeline-card">
            <div class="card-header">
              <h3>
                <span class="material-symbols-rounded">timeline</span>
                Actividad reciente
              </h3>
            </div>
            <div class="timeline" *ngIf="timelineItems.length > 0; else emptyTimelineTpl">
              <div class="timeline-item" *ngFor="let item of timelineItems">
                <div class="tl-dot" [class]="'tl-' + item.type"></div>
                <div class="tl-content">
                  <p class="tl-text">{{ item.text }}</p>
                  <span class="tl-time">{{ item.time }}</span>
                </div>
              </div>
            </div>
            <ng-template #emptyTimelineTpl>
              <div class="empty-state small">
                <span class="material-symbols-rounded">history</span>
                <p>Sin actividad reciente</p>
              </div>
            </ng-template>
          </div>
        </div>

        <!-- Reviews section -->
        <div class="card reviews-card" *ngIf="workshop && reviews.length > 0">
          <div class="card-header">
            <h3>
              <span class="material-symbols-rounded">reviews</span>
              Reseñas de clientes
            </h3>
            <span class="reviews-avg">
              <span class="material-symbols-rounded star-icon">star</span>
              {{ (workshop?.rating || 0) | number: '1.1-1' }}
              <small>({{ reviews.length }})</small>
            </span>
          </div>
          <div class="review-list">
            <div class="review-item" *ngFor="let r of reviews">
              <div class="review-header">
                <div class="review-avatar">{{ r.user_name.charAt(0) || '?' }}</div>
                <div class="review-meta">
                  <span class="review-name">{{ r.user_name }}</span>
                  <span class="review-date">{{ r.created_at | date: 'mediumDate' }}</span>
                </div>
                <div class="review-stars">
                  <span *ngFor="let s of [1,2,3,4,5]" class="material-symbols-rounded"
                    [class.filled]="s <= r.rating">
                    {{ s <= r.rating ? 'star' : 'star_border' }}
                  </span>
                </div>
              </div>
              <p class="review-comment" *ngIf="r.comment">{{ r.comment }}</p>
            </div>
          </div>
        </div>
    </div>
  `,
  styles: [
    `
      .error-banner {
        display: flex;
        align-items: center;
        gap: var(--space-md);
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        padding: var(--space-md) var(--space-lg);
        margin-bottom: var(--space-xl);
        color: var(--color-text-secondary);
        .material-symbols-rounded { font-size: 20px; color: var(--color-danger); }
        .btn { margin-left: auto; }
      }
      .btn-sm {
        padding: 6px 14px; font-size: 13px; min-height: 34px;
        border: 1px solid var(--color-border); border-radius: var(--radius-md);
        color: var(--color-text-primary); display: flex; align-items: center; gap: 6px;
        &:hover { background: var(--color-surface-alt); }
        .material-symbols-rounded { font-size: 16px; }
      }

      .setup-card {
        display: flex;
        align-items: center;
        gap: var(--space-lg);
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-xl);
        padding: var(--space-lg) var(--space-xl);
        margin-bottom: var(--space-xl);
      }

      .setup-icon {
        width: 60px;
        height: 60px;
        border-radius: var(--radius-lg);
        background: rgba(255, 107, 53, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;

        .material-symbols-rounded {
          font-size: 30px;
          color: var(--color-accent);
        }
      }

      .setup-content {
        flex: 1;
        h3 {
          font-size: 17px;
          font-weight: 700;
          color: var(--color-text-primary);
          margin-bottom: 4px;
        }
        p {
          color: var(--color-text-secondary);
          font-size: 14px;
        }
      }

      /* Stats grid */
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: var(--space-md);
        margin-bottom: var(--space-xl);
      }

      .stat-card {
        background: var(--color-surface);
        border-radius: var(--radius-xl);
        border: 1px solid var(--color-border);
        padding: var(--space-lg);
        display: flex;
        align-items: center;
        gap: var(--space-md);
        transition: all 0.25s var(--ease-out);

        &:hover {
          transform: translateY(-3px);
          box-shadow: var(--shadow-card-hover);
        }
      }

      .stat-icon {
        width: 52px;
        height: 52px;
        border-radius: var(--radius-lg);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;

        .material-symbols-rounded { font-size: 26px; }
      }

      .stat-trend {
        margin-left: auto;
        .material-symbols-rounded {
          font-size: 20px;
          color: var(--color-text-tertiary);
        }
        &.up .material-symbols-rounded {
          color: var(--color-success);
        }
      }

      .stat-pending .stat-icon {
        background: rgba(247, 127, 0, 0.1);
        .material-symbols-rounded { color: var(--color-status-pending); }
      }
      .stat-progress .stat-icon {
        background: rgba(0, 180, 216, 0.1);
        .material-symbols-rounded { color: var(--color-status-progress); }
      }
      .stat-completed .stat-icon {
        background: rgba(6, 167, 125, 0.1);
        .material-symbols-rounded { color: var(--color-success); }
      }
      .stat-rating .stat-icon {
        background: rgba(255, 107, 53, 0.1);
        .material-symbols-rounded { color: var(--color-accent); }
      }

      .stat-content { flex: 1; }

      .stat-label {
        font-family: 'JetBrains Mono', monospace;
        font-size: 10px;
        font-weight: 700;
        color: var(--color-text-tertiary);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        margin-bottom: 4px;
      }

      .stat-number {
        font-family: 'JetBrains Mono', monospace;
        font-size: 32px;
        font-weight: 700;
        color: var(--color-text-primary);
        line-height: 1;
        letter-spacing: -0.04em;
      }

      /* Charts row */
      .charts-row {
        display: grid;
        grid-template-columns: 1.2fr 1fr;
        gap: var(--space-lg);
        margin-bottom: var(--space-xl);
      }

      .chart-card .card-header {
        border-bottom: 1px solid var(--color-divider);
      }

      .chart-period {
        font-family: 'JetBrains Mono', monospace;
        font-size: 10px;
        font-weight: 700;
        color: var(--color-text-tertiary);
        background: var(--color-surface-alt);
        padding: 4px 10px;
        border-radius: var(--radius-pill);
        letter-spacing: 0.04em;
      }

      /* Bar chart */
      .bar-chart {
        display: flex;
        align-items: flex-end;
        gap: var(--space-md);
        padding: var(--space-lg);
        height: 200px;
      }

      .bar-item {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-xs);
        height: 100%;
      }

      .bar-wrapper {
        flex: 1;
        width: 100%;
        display: flex;
        align-items: flex-end;
        justify-content: center;
      }

      .bar-fill {
        width: 65%;
        min-height: 6px;
        border-radius: 6px 6px 2px 2px;
        transition: height 0.8s var(--ease-spring);
        &.bar-primary { background: var(--color-primary); }
        &.bar-accent { background: var(--color-accent); }
        &.bar-success { background: var(--color-success); }
      }

      .bar-label {
        font-size: 11px;
        font-weight: 600;
        color: var(--color-text-tertiary);
        text-transform: uppercase;
      }

      /* Category distribution */
      .category-list {
        padding: var(--space-md) var(--space-lg);
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
      }

      .category-item {
        display: flex;
        align-items: center;
        gap: var(--space-md);
      }

      .category-icon {
        width: 36px;
        height: 36px;
        border-radius: var(--radius-md);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        .material-symbols-rounded { font-size: 20px; }
      }

      .cat-icon-battery { background: rgba(247, 127, 0, 0.1); .material-symbols-rounded { color: var(--color-warning); } }
      .cat-icon-tire { background: rgba(58, 134, 255, 0.1); .material-symbols-rounded { color: var(--color-info); } }
      .cat-icon-crash { background: rgba(230, 57, 70, 0.1); .material-symbols-rounded { color: var(--color-danger); } }
      .cat-icon-engine { background: rgba(108, 117, 125, 0.1); .material-symbols-rounded { color: var(--color-text-secondary); } }
      .cat-icon-keys { background: rgba(255, 107, 53, 0.1); .material-symbols-rounded { color: var(--color-accent); } }
      .cat-icon-other, .cat-icon-uncertain { background: var(--color-primary-50); .material-symbols-rounded { color: var(--color-primary); } }

      .category-info { flex: 1; }

      .category-head {
        display: flex;
        justify-content: space-between;
        margin-bottom: 6px;
      }

      .category-name {
        font-size: 13px;
        font-weight: 600;
        color: var(--color-text-primary);
      }

      .category-count {
        font-size: 13px;
        font-weight: 700;
        color: var(--color-text-secondary);
      }

      .progress-bar {
        height: 6px;
        background: var(--color-surface-alt);
        border-radius: var(--radius-pill);
        overflow: hidden;
      }

      .progress-fill {
        height: 100%;
        border-radius: var(--radius-pill);
        transition: width 0.8s var(--ease-spring);
        &.fill-battery { background: var(--color-warning); }
        &.fill-tire { background: var(--color-info); }
        &.fill-crash { background: var(--color-danger); }
        &.fill-engine { background: var(--color-text-secondary); }
        &.fill-keys { background: var(--color-accent); }
        &.fill-other, &.fill-uncertain { background: var(--color-primary); }
      }

      .empty-categories {
        text-align: center;
        padding: var(--space-xl);
        color: var(--color-text-tertiary);
        .material-symbols-rounded { font-size: 40px; margin-bottom: var(--space-sm); display: block; }
        p { font-size: 13px; }
      }

      /* Bottom row */
      .bottom-row {
        display: grid;
        grid-template-columns: 1.5fr 1fr;
        gap: var(--space-lg);
      }

      /* Card header */
      .card-header h3 {
        display: flex;
        align-items: center;
        gap: var(--space-sm);

        .material-symbols-rounded {
          font-size: 20px;
          color: var(--color-primary);
        }
      }

      .see-all {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 13px;
        font-weight: 600;
        color: var(--color-primary);
        padding: 6px 10px;
        border-radius: var(--radius-sm);
        transition: all 0.2s var(--ease-out);

        .material-symbols-rounded { font-size: 16px; }
        &:hover { background: var(--color-primary-50); }
      }

      /* Incident list */
      .incident-list {
        display: flex;
        flex-direction: column;
      }

      .incident-row {
        display: flex;
        align-items: center;
        gap: var(--space-md);
        padding: var(--space-md) var(--space-lg);
        border-top: 1px solid var(--color-divider);
        transition: all 0.2s var(--ease-out);

        &:hover {
          background: var(--color-surface-hover);
          .chevron { transform: translateX(4px); color: var(--color-primary); }
        }
      }

      .incident-icon {
        width: 44px;
        height: 44px;
        border-radius: var(--radius-lg);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        background: var(--color-primary-50);

        .material-symbols-rounded { font-size: 24px; color: var(--color-primary); }

        &.cat-battery { background: rgba(247, 127, 0, 0.1); .material-symbols-rounded { color: var(--color-warning); } }
        &.cat-tire { background: rgba(58, 134, 255, 0.1); .material-symbols-rounded { color: var(--color-info); } }
        &.cat-crash { background: rgba(230, 57, 70, 0.1); .material-symbols-rounded { color: var(--color-danger); } }
        &.cat-engine { background: rgba(108, 117, 125, 0.1); .material-symbols-rounded { color: var(--color-text-secondary); } }
      }

      .incident-body { flex: 1; min-width: 0; }

      .incident-title-row {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        margin-bottom: 4px;
        flex-wrap: wrap;
      }

      .incident-id {
        font-family: 'JetBrains Mono', monospace;
        font-weight: 700;
        color: var(--color-text-primary);
        font-size: 13px;
      }

      .incident-summary {
        color: var(--color-text-secondary);
        font-size: 13px;
        margin: 4px 0 6px;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
      }

      .incident-meta {
        display: flex;
        gap: var(--space-md);
        font-size: 12px;
        color: var(--color-text-tertiary);

        span { display: inline-flex; align-items: center; gap: 4px; }
        .material-symbols-rounded { font-size: 14px; }
      }

      .chevron {
        color: var(--color-text-tertiary);
        font-size: 24px;
        transition: all 0.2s var(--ease-out);
      }

      /* Timeline */
      .timeline-card .card-header {
        border-bottom: 1px solid var(--color-divider);
      }

      .timeline {
        padding: var(--space-md) var(--space-lg);
        display: flex;
        flex-direction: column;
        gap: 0;
      }

      .timeline-item {
        display: flex;
        gap: var(--space-md);
        padding: var(--space-sm) 0;
        position: relative;

        &:not(:last-child)::before {
          content: '';
          position: absolute;
          left: 7px;
          top: 28px;
          bottom: -4px;
          width: 2px;
          background: var(--color-divider);
        }
      }

      .tl-dot {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        flex-shrink: 0;
        margin-top: 2px;
        border: 3px solid var(--color-border);
        background: var(--color-surface);

        &.tl-new { border-color: var(--color-status-pending); background: rgba(247, 127, 0, 0.15); }
        &.tl-assigned { border-color: var(--color-info); background: rgba(58, 134, 255, 0.15); }
        &.tl-progress { border-color: var(--color-status-progress); background: rgba(0, 180, 216, 0.15); }
        &.tl-completed { border-color: var(--color-success); background: rgba(6, 167, 125, 0.15); }
      }

      .tl-content { flex: 1; }

      .tl-text {
        font-size: 13px;
        font-weight: 500;
        color: var(--color-text-primary);
        line-height: 1.4;
      }

      .tl-time {
        font-family: 'JetBrains Mono', monospace;
        font-size: 10px;
        color: var(--color-text-tertiary);
        margin-top: 2px;
        display: block;
        letter-spacing: 0.02em;
      }

      .empty-state.small {
        padding: var(--space-lg);
        text-align: center;
        color: var(--color-text-tertiary);
        .material-symbols-rounded { font-size: 36px; margin-bottom: var(--space-xs); display: block; }
        p { font-size: 13px; }
      }

      @media (max-width: 1100px) {
        .charts-row, .bottom-row { grid-template-columns: 1fr; }
      }

      @media (max-width: 900px) {
        .stats-grid { grid-template-columns: repeat(2, 1fr); }
      }

      /* Reviews */
      .reviews-card { margin-top: var(--space-xl); }
      .reviews-avg {
        display: flex; align-items: center; gap: 4px;
        font-weight: 700; font-size: 16px; color: var(--color-text-primary);
        small { font-weight: 400; font-size: 13px; color: var(--color-text-tertiary); }
      }
      .star-icon { font-size: 20px; color: #f59e0b; }
      .review-list { display: flex; flex-direction: column; gap: var(--space-md); }
      .review-item {
        padding: var(--space-md);
        background: var(--color-surface-alt);
        border-radius: var(--radius-lg);
      }
      .review-header { display: flex; align-items: center; gap: var(--space-sm); }
      .review-avatar {
        width: 36px; height: 36px; border-radius: 50%;
        background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
        color: white; display: flex; align-items: center; justify-content: center;
        font-weight: 700; font-size: 14px; flex-shrink: 0;
      }
      .review-meta { flex: 1; display: flex; flex-direction: column; }
      .review-name { font-weight: 600; font-size: 14px; color: var(--color-text-primary); }
      .review-date { font-size: 12px; color: var(--color-text-tertiary); }
      .review-stars {
        display: flex; gap: 1px;
        .material-symbols-rounded {
          font-size: 16px; color: #d1d5db;
          &.filled { color: #f59e0b; }
        }
      }
      .review-comment {
        margin-top: var(--space-sm); font-size: 14px; color: var(--color-text-secondary); line-height: 1.5;
      }
    `,
  ],
})
export class DashboardComponent implements OnInit {
  workshop: Workshop | null = null;
  recentIncidents: Incident[] = [];
  allIncidents: Incident[] = [];
  pendingCount = 0;
  inProgressCount = 0;
  completedCount = 0;
  loading = true;
  error = false;

  weeklyBars: { day: string; pct: number; color: string }[] = [];
  categoryStats: { key: string; label: string; count: number; pct: number }[] = [];
  timelineItems: { type: string; text: string; time: string }[] = [];
  reviews: Review[] = [];

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading = true;
    this.error = false;

    this.api.getMyWorkshop().subscribe({
      next: (w) => {
        this.workshop = w;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.workshop = null;
        this.loading = false;
        this.cdr.markForCheck();
      },
    });

    this.api.getIncidents().subscribe({
      next: (incidents) => {
        this.allIncidents = incidents;
        this.recentIncidents = incidents.slice(0, 6);
        this.pendingCount = incidents.filter(
          (i) => i.status === 'pending',
        ).length;
        this.inProgressCount = incidents.filter((i) =>
          ['assigned', 'in_progress'].includes(i.status),
        ).length;
        this.completedCount = incidents.filter(
          (i) => i.status === 'completed',
        ).length;
        this.buildWeeklyBars(incidents);
        this.buildCategoryStats(incidents);
        this.buildTimeline(incidents);
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = true;
        this.cdr.markForCheck();
      },
    });

    this.api.getMyReviews().subscribe({
      next: (reviews) => {
        this.reviews = reviews;
        this.cdr.markForCheck();
      },
      error: () => {},
    });
  }

  private buildWeeklyBars(incidents: Incident[]) {
    const days = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    const counts = new Array(7).fill(0);
    const now = new Date();
    incidents.forEach(inc => {
      const d = new Date(inc.created_at);
      const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
      if (diff < 7) {
        counts[d.getDay()]++;
      }
    });
    const max = Math.max(...counts, 1);
    const todayIdx = now.getDay();
    this.weeklyBars = [];
    for (let i = 6; i >= 0; i--) {
      const idx = (todayIdx - i + 7) % 7;
      const pct = (counts[idx] / max) * 100;
      this.weeklyBars.push({
        day: days[idx],
        pct: Math.max(pct, 4),
        color: i === 0 ? 'accent' : pct > 50 ? 'primary' : 'success',
      });
    }
  }

  private buildCategoryStats(incidents: Incident[]) {
    const labels: Record<string, string> = {
      battery: 'Bateria', tire: 'Llanta', crash: 'Choque',
      engine: 'Motor', keys: 'Llaves', other: 'Otro', uncertain: 'Incierto',
    };
    const map = new Map<string, number>();
    incidents.forEach(inc => {
      const cat = inc.category || 'other';
      map.set(cat, (map.get(cat) || 0) + 1);
    });
    const total = incidents.length || 1;
    this.categoryStats = Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, count]) => ({
        key,
        label: labels[key] || key,
        count,
        pct: (count / total) * 100,
      }));
  }

  private buildTimeline(incidents: Incident[]) {
    const sorted = [...incidents]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 8);

    this.timelineItems = sorted.map(inc => {
      let type = 'new';
      let text = `Nuevo incidente #${inc.id}`;
      if (inc.status === 'completed') {
        type = 'completed';
        text = `Incidente #${inc.id} completado`;
      } else if (inc.status === 'in_progress') {
        type = 'progress';
        text = `Incidente #${inc.id} en proceso`;
      } else if (inc.status === 'assigned') {
        type = 'assigned';
        text = `Incidente #${inc.id} asignado`;
      }
      return { type, text, time: this.timeAgo(inc.created_at) };
    });
  }

  private timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Justo ahora';
    if (mins < 60) return `Hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Hace ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Hace ${days}d`;
  }

  get firstName(): string {
    const user = this.auth.getCurrentUser();
    if (!user?.full_name) return 'Taller';
    return user.full_name.split(' ')[0];
  }

  get greeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos dias';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }

  getCategoryIcon(cat: string): string {
    const icons: Record<string, string> = {
      battery: 'battery_alert',
      tire: 'tire_repair',
      crash: 'car_crash',
      engine: 'settings',
      keys: 'key',
      other: 'help',
      uncertain: 'psychology',
    };
    return icons[cat] || 'help';
  }

  getCategoryLabel(cat: string): string {
    const labels: Record<string, string> = {
      battery: 'Bateria',
      tire: 'Llanta',
      crash: 'Choque',
      engine: 'Motor',
      keys: 'Llaves',
      other: 'Otro',
      uncertain: 'Incierto',
    };
    return labels[cat] || cat;
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      assigned: 'Asignado',
      in_progress: 'En proceso',
      completed: 'Completado',
      cancelled: 'Cancelado',
    };
    return labels[status] || status;
  }
}
