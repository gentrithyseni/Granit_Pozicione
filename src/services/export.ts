import { supabase } from '../lib/supabase';

export async function exportProjectCSV(projectId: string): Promise<{ ok: boolean; message?: string }> {
  if (!supabase) return { ok: false, message: 'Supabase nuk është i lidhur' };
  const { data, error } = await supabase.from('project_items').select('*').eq('project_id', projectId);
  if (error) return { ok: false, message: error.message };
  if (!data || data.length === 0) return { ok: false, message: 'Nuk ka të dhëna për t\'u eksportuar' };

  const keys = Object.keys(data[0]);
  const rows = data.map((row) => keys.map((key) => `"${String((row as Record<string, unknown>)[key] ?? '').replace(/"/g, '""')}"`).join(','));
  const csv = [keys.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `project-${projectId}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
  return { ok: true };
}
