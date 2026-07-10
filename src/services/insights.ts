import { supabase } from '../lib/supabase';
import type { CategorySummary, DbProject, ProjectSummary } from '../types/database';

export async function fetchProjectSummaries(projects: DbProject[]): Promise<ProjectSummary[]> {
  if (!supabase || projects.length === 0) return [];
  const { data, error } = await supabase.from('project_items').select('project_id, total_price');
  if (error || !data) return [];

  const totals = new Map<string, number>();
  for (const row of data) {
    const id = row.project_id as string;
    totals.set(id, (totals.get(id) || 0) + (Number(row.total_price) || 0));
  }

  return projects
    .map((project) => ({
      id: project.id,
      name: project.name,
      total: totals.get(project.id) || 0,
    }))
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
}

export async function fetchCategorySummaries(categories: { id: string; name: string }[]): Promise<CategorySummary[]> {
  if (!supabase || categories.length === 0) return [];
  const { data, error } = await supabase.from('project_items').select('category_id');
  if (error || !data) return [];

  const counts = new Map<string, number>();
  for (const row of data) {
    const id = row.category_id as string | null;
    if (!id) continue;
    counts.set(id, (counts.get(id) || 0) + 1);
  }

  return categories
    .map((category) => ({
      id: category.id,
      name: category.name,
      count: counts.get(category.id) || 0,
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}

export type MonthlyRevenuePoint = { month: string; label: string; total: number };

/** Trendi i vlerës totale (të ofertuar) sipas muajit — bazuar në created_at të pozicioneve.
 * Përdoret për të parë a po rritet biznesi me kohë (jo fitimi, thjesht vëllimi i ofertave). */
export async function fetchMonthlyRevenueTrend(): Promise<MonthlyRevenuePoint[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('project_items').select('total_price, created_at');
  if (error || !data) return [];

  const byMonth = new Map<string, number>();
  data.forEach((row) => {
    const created = row.created_at as string | undefined;
    if (!created) return;
    const date = new Date(created);
    if (Number.isNaN(date.getTime())) return;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    byMonth.set(key, (byMonth.get(key) || 0) + (Number(row.total_price) || 0));
  });

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, total]) => {
      const [year, month] = key.split('-');
      const date = new Date(Number(year), Number(month) - 1, 1);
      return {
        month: key,
        label: date.toLocaleDateString('sq-AL', { month: 'short', year: '2-digit' }),
        total: Number(total.toFixed(2)),
      };
    });
}

export async function fetchTotalSystemValue(): Promise<number> {
  if (!supabase) return 0;
  const { data } = await supabase.from('project_items').select('total_price');
  return (data || []).reduce((sum, item) => sum + (Number(item.total_price) || 0), 0);
}