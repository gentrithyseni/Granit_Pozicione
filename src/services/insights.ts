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
    .sort((a, b) => b.total - a.total);
}

export async function fetchCategorySummaries(categories: { id: string; name: string }[]): Promise<CategorySummary[]> {
  if (!supabase || categories.length === 0) return [];
  const { data, error } = await supabase.from('project_items').select('category_id, total_price');
  if (error || !data) return [];

  const summaries = new Map<string, { count: number; total: number }>();
  for (const row of data) {
    const id = row.category_id as string | null;
    if (!id) continue;
    const current = summaries.get(id) || { count: 0, total: 0 };
    current.count += 1;
    current.total += Number(row.total_price) || 0;
    summaries.set(id, current);
  }

  return categories
    .map((category) => {
      const summary = summaries.get(category.id) || { count: 0, total: 0 };
      return {
        id: category.id,
        name: category.name,
        count: summary.count,
        total: Number(summary.total.toFixed(2)),
      };
    })
    .filter((item) => item.count > 0)
    .sort((a, b) => b.total - a.total);
}

export type MonthlyRevenuePoint = { month: string; label: string; total: number; count: number; average: number };

/** Trendi i vlerës totale (të ofertuar) sipas muajit — bazuar në created_at të pozicioneve.
 * Përdoret për të parë a po rritet biznesi me kohë (jo fitimi, thjesht vëllimi i ofertave). */
export async function fetchMonthlyRevenueTrend(): Promise<MonthlyRevenuePoint[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('project_items').select('total_price, created_at');
  if (error || !data) return [];

  const byMonth = new Map<string, { total: number; count: number }>();
  data.forEach((row) => {
    const created = row.created_at as string | undefined;
    if (!created) return;
    const date = new Date(created);
    if (Number.isNaN(date.getTime())) return;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const current = byMonth.get(key) || { total: 0, count: 0 };
    current.total += Number(row.total_price) || 0;
    current.count += 1;
    byMonth.set(key, current);
  });

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, summary]) => {
      const [year, month] = key.split('-');
      const date = new Date(Number(year), Number(month) - 1, 1);
      return {
        month: key,
        label: date.toLocaleDateString('sq-AL', { month: 'short', year: '2-digit' }),
        total: Number(summary.total.toFixed(2)),
        count: summary.count,
        average: summary.count > 0 ? Number((summary.total / summary.count).toFixed(2)) : 0,
      };
    });
}

export async function fetchTotalSystemValue(): Promise<number> {
  if (!supabase) return 0;
  const { data } = await supabase.from('project_items').select('total_price');
  return (data || []).reduce((sum, item) => sum + (Number(item.total_price) || 0), 0);
}
