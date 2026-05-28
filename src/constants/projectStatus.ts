export const PROJECT_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'in_progress', label: 'Në proces' },
  { value: 'completed', label: 'Përfunduar' },
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number]['value'];

export function statusLabel(status?: string | null) {
  return PROJECT_STATUSES.find((s) => s.value === status)?.label ?? 'Draft';
}
