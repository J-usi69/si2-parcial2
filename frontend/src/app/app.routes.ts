import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';
import { workshopGuard } from './guards/workshop.guard';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/landing/landing.component').then(m => m.LandingComponent) },
  { path: 'login', loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent) },
  { path: 'register', loadComponent: () => import('./pages/register/register.component').then(m => m.RegisterComponent) },
  {
    path: '',
    loadComponent: () => import('./components/layout/layout.component').then(m => m.LayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'incidents', loadComponent: () => import('./pages/incidents/incidents.component').then(m => m.IncidentsComponent) },
      { path: 'incidents/:id', loadComponent: () => import('./pages/incident-detail/incident-detail.component').then(m => m.IncidentDetailComponent) },
      { path: 'admin/users', canActivate: [adminGuard], loadComponent: () => import('./pages/admin-users/admin-users.component').then(m => m.AdminUsersComponent) },
      { path: 'admin/workshops', canActivate: [adminGuard], loadComponent: () => import('./pages/admin-workshops/admin-workshops.component').then(m => m.AdminWorkshopsComponent) },
      { path: 'admin/payments', canActivate: [adminGuard], loadComponent: () => import('./pages/admin-payments/admin-payments.component').then(m => m.AdminPaymentsComponent) },
      { path: 'admin/notifications', canActivate: [adminGuard], loadComponent: () => import('./pages/admin-notifications/admin-notifications.component').then(m => m.AdminNotificationsComponent) },
      { path: 'technicians', canActivate: [workshopGuard], loadComponent: () => import('./pages/technicians/technicians.component').then(m => m.TechniciansComponent) },
      { path: 'invitations', canActivate: [workshopGuard], loadComponent: () => import('./pages/invitations/invitations.component').then(m => m.InvitationsComponent) },
      { path: 'kpis', loadComponent: () => import('./pages/kpis/kpis.component').then(m => m.KpisComponent) },
      { path: 'reports-ai', loadComponent: () => import('./pages/reports-ai/reports-ai.component').then(m => m.ReportsAiComponent) },
      { path: 'history', loadComponent: () => import('./pages/history/history.component').then(m => m.HistoryComponent) },
      { path: 'reports', loadComponent: () => import('./pages/reports/reports.component').then(m => m.ReportsComponent) },
      { path: 'profile', loadComponent: () => import('./pages/profile/profile.component').then(m => m.ProfileComponent) },
    ]
  },
  { path: '**', redirectTo: '/login' },
];
