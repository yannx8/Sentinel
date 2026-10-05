import { statusClassMap } from '../../constants';
import { useI18n } from '../../i18n';

/** Renders a colored status pill. Falls back to 'status-new' class for unknown values. */
export function StatusBadge({ value }: { value: string }) {
  const cls = statusClassMap[value] || 'status-new';
  const t = useI18n((s) => s.t);
  return (
    <span className={`status-badge ${cls}`}>
      <i /> {t(`incidentStatuses.${value}`) || value}
    </span>
  );
}
