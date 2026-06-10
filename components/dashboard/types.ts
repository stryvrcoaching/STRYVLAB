// components/dashboard/types.ts

export type AlertSeverity = 'critical' | 'urgent' | 'info';

export type DashboardAlert = {
  id: string;
  severity: AlertSeverity;
  message: string;
  actionLabel: string;
  actionHref: string;
  clientId?: string;
  clientName?: string;
};

export type ClientMetrics = {
  weight?: number;
  bodyFatPct?: number;
  delta?: number; // delta poids vs mesure précédente
};

export type WeightPoint = {
  date: string;
  value: number;
};

export type DashboardClient = {
  id: string;
  firstName: string;
  lastName: string;
  status: 'progressing' | 'stagnant' | 'inactive';
  lastActivityDays: number;
  lastMetrics: ClientMetrics | null;
  weightHistory: WeightPoint[]; // pour sparkline, min 3 points
  subscription: { formulaName: string; status: string } | null;
};

export type DashboardHero = {
  coachFirstName: string;
  activeClients: number;
  mrr: number;
  pendingSubmissions: number;
  alertCount: number;
  revenueThisMonth: number;
};

export type DashboardFinancial = {
  mrr: number;
  revenueThisMonth: number;
  pending: number;
  overdue: number;
};

export type DashboardCoachData = {
  hero: DashboardHero;
  alerts: DashboardAlert[];
  clients: DashboardClient[];
  financial: DashboardFinancial;
};
