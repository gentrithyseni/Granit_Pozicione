import { statusLabel } from '../constants/projectStatus';

export function StatusBadge({ status }: { status?: string | null }) {
  const value = status || 'draft';
  return <span className={`status-badge status-${value}`}>{statusLabel(value)}</span>;
}
