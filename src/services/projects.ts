import { supabase } from '../lib/supabase';
import type { DbProject } from '../types/database';

export async function fetchCompletedProjects(): Promise<DbProject[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from('projects')
    .select('*')
    .eq('status', 'completed')
    .order('updated_at', { ascending: false })
    .limit(8);
  return data || [];
}

export async function updateProject(
  id: string,
  patch: Partial<Pick<DbProject, 'name' | 'client' | 'status' | 'description' | 'actual_total_cost' | 'actual_notes'>>
): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase nuk është i lidhur' };
  const { error } = await supabase.from('projects').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  return { error: error?.message ?? null };
}

/** Fshin projektin dhe (nëpërmjet ON DELETE CASCADE në bazën e të dhënave) të gjitha
 * pozicionet e tij (project_items) dhe kostot përkatëse (item_expenses) — pa hapa shtesë. */
export async function deleteProject(id: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase nuk është i lidhur' };
  const { error } = await supabase.from('projects').delete().eq('id', id);
  return { error: error?.message ?? null };
}

/** Fshin një pozicion të vetëm (project_items) — kostot e tij (item_expenses) fshihen
 * automatikisht nga ON DELETE CASCADE. Historiku i çmimeve (price_history) ruhet (nuk fshihet). */
export async function deletePosition(id: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase nuk është i lidhur' };
  const { error } = await supabase.from('project_items').delete().eq('id', id);
  return { error: error?.message ?? null };
}

export async function exportAllDataJson(): Promise<{ ok: boolean; message?: string }> {
  if (!supabase) return { ok: false, message: 'Supabase nuk është i lidhur' };
  const [projects, categories, items, expenses] = await Promise.all([
    supabase.from('projects').select('*'),
    supabase.from('categories').select('*'),
    supabase.from('project_items').select('*'),
    supabase.from('item_expenses').select('*'),
  ]);
  const payload = {
    exportedAt: new Date().toISOString(),
    projects: projects.data,
    categories: categories.data,
    project_items: items.data,
    item_expenses: expenses.data,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `graniti-backup-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  return { ok: true };
}