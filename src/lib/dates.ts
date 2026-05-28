export function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('sq-AL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function wasUpdated(created?: string | null, updated?: string | null): boolean {
  if (!created || !updated) return false;
  return new Date(updated).getTime() - new Date(created).getTime() > 2000;
}
