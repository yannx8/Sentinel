import { ClipboardList, Clock, AlertTriangle, CheckCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';

type KpiVariant = 'teal' | 'orange' | 'coral' | 'purple' | 'green';

const VARIANT_CONFIG: Record<KpiVariant, { bg: string; icon: string; Icon: any }> = {
  teal: { bg: '#eff6ff', icon: '#2563eb', Icon: ClipboardList },
  orange: { bg: '#ffedd5', icon: '#ea580c', Icon: Clock },
  coral: { bg: '#fee2e2', icon: '#dc2626', Icon: AlertTriangle },
  purple: { bg: '#f5f3ff', icon: '#7c3aed', Icon: CheckCircle },
  green: { bg: '#d1fae5', icon: '#059669', Icon: CheckCircle }
};

interface KpiCardProps {
  label: string;
  value: number;
  variant: KpiVariant;
  subtitle?: string;
  trend?: number;
  loading?: boolean;
}

/**
 * Displays a single KPI metric with label, value, optional trend indicator,
 * and a color-coded icon derived from the variant.
 */
export function KpiCard({ label, value, variant, subtitle, trend, loading }: KpiCardProps) {
  if (loading) {
    return (
      <div className="kpi-card">
        <div className="kpi-header">
          <div className="kpi-skeleton-text" style={{ width: 80, height: 12 }} />
          <div className="kpi-skeleton-icon" />
        </div>
        <div className="kpi-skeleton-text" style={{ width: 50, height: 32, marginTop: 12 }} />
        <div className="kpi-skeleton-text" style={{ width: 100, height: 10, marginTop: 8 }} />
      </div>
    );
  }

  const config = VARIANT_CONFIG[variant] || VARIANT_CONFIG.teal;
  const { Icon } = config;

  return (
    <div className="kpi-card">
      <div className="kpi-header">
        <div className="kpi-icon" style={{ background: config.bg, color: config.icon }}>
          <Icon size={18} strokeWidth={1.8} />
        </div>
        <div className="kpi-copy">
          <span className="kpi-label">{label}</span>
          <div className="kpi-value">{String(value).padStart(2, '0')}</div>
          {subtitle && <div className="kpi-footer">{subtitle}</div>}
          {trend !== undefined && trend !== 0 && (
            <div className={`kpi-trend ${trend > 0 ? 'kpi-trend-up' : 'kpi-trend-down'}`}>
              {trend > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {Math.abs(trend)}%
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function KpiGrid({ children }: { children: React.ReactNode }) {
  return <div className="kpi-grid">{children}</div>;
}
