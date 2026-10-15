import { supabase } from '../lib/supabase';
import type { DbProject } from '../types/database';

export async function fetchCompletedProjects(): Promise<DbProject[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('status', 'completed')
    .order('updated_at', { ascending: false })
    .limit(8);
  if (error) throw new Error(`Projektet e përfunduara nuk u ngarkuan: ${error.message}`);
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

type BackupTable = 'projects' | 'categories' | 'project_items' | 'item_expenses' | 'price_history' | 'libri_exports';

async function fetchAllRows(table: BackupTable): Promise<{ data: unknown[]; error: string | null }> {
  if (!supabase) return { data: [], error: 'Supabase nuk është i lidhur' };
  const pageSize = 1000;
  const rows: unknown[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) return { data: [], error: `${table}: ${error.message}` };
    if (!data) return { data: [], error: `${table}: databaza nuk ktheu të dhëna.` };
    rows.push(...data);
    if (data.length < pageSize) return { data: rows, error: null };
  }
}

export async function exportAllDataJson(): Promise<{ ok: boolean; message?: string }> {
  if (!supabase) return { ok: false, message: 'Supabase nuk është i lidhur' };
  const [projects, categories, items, expenses, priceHistory, libriExports] = await Promise.all([
    fetchAllRows('projects'),
    fetchAllRows('categories'),
    fetchAllRows('project_items'),
    fetchAllRows('item_expenses'),
    fetchAllRows('price_history'),
    fetchAllRows('libri_exports'),
  ]);
  const failedTable = [projects, categories, items, expenses, priceHistory, libriExports].find((result) => result.error);
  if (failedTable?.error) return { ok: false, message: `Backup-i nuk u krijua. ${failedTable.error}` };

  const payload = {
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    projects: projects.data,
    categories: categories.data,
    project_items: items.data,
    item_expenses: expenses.data,
    price_history: priceHistory.data,
    libri_exports: libriExports.data,
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