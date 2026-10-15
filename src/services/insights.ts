import { supabase } from '../lib/supabase';
import { TRANSPORT_OPTIONS } from '../constants/transport';
import type { ProjectStatus } from '../constants/projectStatus';
import type { CategorySummary, DbProject, ProjectSummary } from '../types/database';

export async function fetchProjectSummaries(projects: DbProject[]): Promise<ProjectSummary[]> {
  if (!supabase || projects.length === 0) return [];
  const { data, error } = await supabase.from('project_items').select('project_id, total_price');
  if (error) throw new Error(`Përmbledhja e projekteve nuk u ngarkua: ${error.message}`);
  if (!data) throw new Error('Databaza nuk ktheu të dhëna për përmbledhjen e projekteve.');

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
  if (error) throw new Error(`Përmbledhja e kategorive nuk u ngarkua: ${error.message}`);
  if (!data) throw new Error('Databaza nuk ktheu të dhëna për përmbledhjen e kategorive.');

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

export type MonthlyRevenuePoint = {
  month: string;
  label: string;
  total: number;
  count: number;
  positionCount: number;
  average: number;
};

export type CityUsageSummary = { city: string; count: number };

export async function fetchTransportCityUsage(): Promise<CityUsageSummary[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('item_expenses').select('description, unit_cost').eq('expense_type', 'transport');
  if (error) throw new Error(`Përdorimi i transportit nuk u ngarkua: ${error.message}`);
  if (!data) throw new Error('Databaza nuk ktheu të dhëna për përdorimin e transportit.');

  const counts = new Map<string, number>();
  data.forEach((row) => {
    const description = String(row.description || '');
    let city = description.replace(/^transport\s*:\s*/i, '').trim();
    if (!city || ['transport', 'pa qytet'].includes(city.toLowerCase())) {
      const matchingCities = TRANSPORT_OPTIONS.filter((option) => option.price === Number(row.unit_cost)).map((option) => option.name);
      city = matchingCities.length === 1 ? matchingCities[0] : '';
    }
    if (!city) return;
    counts.set(city, (counts.get(city) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city));
}

type MonthlyOfferProject = {
  created_at?: string | null;
  project_items?: { total_price?: number | string | null }[] | null;
};

/** Kthen gjashtë muaj kalendarikë të ofertave, duke përfshirë edhe muajt pa aktivitet. */
export function buildMonthlyOfferTrend(projects: MonthlyOfferProject[], now = new Date()): MonthlyRevenuePoint[] {
  const firstMonth = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const byMonth = new Map<string, { total: number; count: number; positionCount: number }>();

  for (let offset = 0; offset < 6; offset += 1) {
    const date = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + offset, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    byMonth.set(key, { total: 0, count: 0, positionCount: 0 });
  }

  projects.forEach((project) => {
    if (!project.created_at) return;
    const date = new Date(project.created_at);
    if (Number.isNaN(date.getTime())) return;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const month = byMonth.get(key);
    const items = project.project_items || [];
    if (!month || items.length === 0) return;

    month.total += items.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0);
    month.count += 1;
    month.positionCount += items.length;
  });

  return Array.from(byMonth.entries()).map(([key, summary]) => {
    const [year, month] = key.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    return {
      month: key,
      label: date.toLocaleDateString('sq-AL', { month: 'short', year: 'numeric' }),
      total: Number(summary.total.toFixed(2)),
      count: summary.count,
      positionCount: summary.positionCount,
      average: summary.count > 0 ? Number((summary.total / summary.count).toFixed(2)) : 0,
    };
  });
}

/** Vlera e ofertave sipas muajit të krijimit të projektit; nuk paraqet pagesa apo fitim. */
export async function fetchMonthlyRevenueTrend(status: ProjectStatus | 'all' = 'all'): Promise<MonthlyRevenuePoint[]> {
  if (!supabase) return [];
  let query = supabase.from('projects').select('created_at, project_items(total_price)');
  if (status !== 'all') query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw new Error(`Trendi i ofertave nuk u ngarkua: ${error.message}`);
  return buildMonthlyOfferTrend((data || []) as MonthlyOfferProject[]);
}

export async function fetchTotalSystemValue(): Promise<number> {
  if (!supabase) return 0;
  const { data, error } = await supabase.from('project_items').select('total_price');
  if (error) throw new Error(`Vlera e sistemit nuk u ngarkua: ${error.message}`);
  if (!data) throw new Error('Databaza nuk ktheu të dhëna për vlerën e sistemit.');
  return data.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0);
}
