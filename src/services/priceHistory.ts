import { supabase } from '../lib/supabase';
import type { DbPriceHistory } from '../types/database';
import { netAmountFromGross } from '../lib/pricing';

export type PriceHistorySnapshot = {
  project_item_id?: string | null;
  project_id?: string | null;
  category_id?: string | null;
  description?: string | null;
  unit?: string | null;
  material_price: number;
  labor_price: number;
  quantity: number;
  unit_price: number;
  total_price: number;
  profit_percent: number;
};

/** Regjistron një foto çmimi pa e zëvendësuar historikun ekzistues; gabimin e kthen që UI ta njoftojë përdoruesin. */
export async function recordPriceSnapshot(snapshot: PriceHistorySnapshot): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase nuk është i lidhur.' };
  try {
    const { error } = await supabase.from('price_history').insert([snapshot]);
    return { error: error?.message ?? null };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Ndodhi një gabim i panjohur gjatë ruajtjes së historikut të çmimeve.',
    };
  }
}

export type PriceTrendPoint = {
  recordedAt: string;
  unitPrice: number;
  materialPrice: number;
  laborPrice: number;
  description: string;
};

/** Historiku i çmimeve për një kategori (ose të gjitha, nëse categoryId s'jepet), renditur kronologjikisht. */
export async function fetchPriceTrend(categoryIds?: string | string[]): Promise<PriceTrendPoint[]> {
  if (!supabase) return [];
  let query = supabase.from('price_history').select('*').order('recorded_at', { ascending: true });
  if (Array.isArray(categoryIds)) {
    if (categoryIds.length === 0) return [];
    query = query.in('category_id', categoryIds);
  }
  else if (typeof categoryIds === 'string' && categoryIds) query = query.eq('category_id', categoryIds);
  const { data, error } = await query;
  if (error) throw new Error(`Historiku i çmimeve nuk u ngarkua: ${error.message}`);
  if (!data) return [];
  return (data as DbPriceHistory[]).map((row) => ({
    recordedAt: row.recorded_at,
    unitPrice: Number(row.unit_price) || 0,
    materialPrice: Number(row.material_price) || 0,
    laborPrice: Number(row.labor_price) || 0,
    description: row.description || '',
  }));
}

export type ProfitSummary = {
  projectId: string;
  projectName: string;
  plannedCost: number;
  plannedTotal: number;
  profitAmount: number;
  profitPercentAchieved: number;
  /** Kosto reale finale (nëse është plotësuar dorazi te projekti). null = ende s'ka të dhëna. */
  actualCost: number | null;
  realProfitAmount: number | null;
  realProfitPercent: number | null;
  /** Sa larg ka qenë vlerësimi fillestar nga realiteti, në % (0 = perfekt). null nëse s'ka kosto reale. */
  estimateErrorPercent: number | null;
};

/** Përmbledhje e fitimit sipas projektit. Të ardhurat krahasohen pa TVSH me shpenzimet. */
export async function fetchProfitSummaryByProject(): Promise<ProfitSummary[]> {
  if (!supabase) return [];
  const [itemsResult, expensesResult] = await Promise.all([
    supabase.from('project_items').select('id, project_id, total_price, vat_percent, projects(name, actual_total_cost)'),
    supabase.from('item_expenses').select('project_item_id, total_cost'),
  ]);
  if (itemsResult.error) throw new Error(`Pozicionet nuk u lexuan për analizën: ${itemsResult.error.message}`);
  if (expensesResult.error) throw new Error(`Kostot nuk u lexuan për analizën: ${expensesResult.error.message}`);
  const items = itemsResult.data;
  const expenses = expensesResult.data;
  if (!items) return [];

  const costByItem = new Map<string, number>();
  (expenses || []).forEach((exp) => {
    const key = exp.project_item_id as string;
    costByItem.set(key, (costByItem.get(key) || 0) + (Number(exp.total_cost) || 0));
  });

  const byProject = new Map<string, { name: string; cost: number; netTotal: number; actualCost: number | null }>();
  items.forEach((item) => {
    const projectId = item.project_id as string;
    const projectsField = (item as { projects?: { name: string; actual_total_cost?: number | null } | { name: string; actual_total_cost?: number | null }[] | null }).projects;
    const projectData = Array.isArray(projectsField) ? projectsField[0] : projectsField;
    const cost = costByItem.get(item.id as string) || 0;
    const vatPercent = Number(item.vat_percent ?? 18);
    const netTotal = netAmountFromGross(Number(item.total_price) || 0, vatPercent);
    const existing = byProject.get(projectId) || {
      name: projectData?.name || 'Projekt',
      cost: 0,
      netTotal: 0,
      actualCost: projectData?.actual_total_cost ?? null,
    };
    existing.cost += cost;
    existing.netTotal += netTotal;
    byProject.set(projectId, existing);
  });

  return Array.from(byProject.entries()).map(([projectId, v]) => {
    const plannedCost = Number(v.cost.toFixed(2));
    const plannedTotal = Number(v.netTotal.toFixed(2));
    const actualCost = v.actualCost != null ? Number(v.actualCost) : null;
    const realProfitAmount = actualCost != null ? Number((v.netTotal - actualCost).toFixed(2)) : null;
    const realProfitPercent = actualCost != null && actualCost > 0 ? Number((((v.netTotal - actualCost) / actualCost) * 100).toFixed(1)) : null;
    const estimateErrorPercent =
      actualCost != null && actualCost > 0 ? Number((((plannedCost - actualCost) / actualCost) * 100).toFixed(1)) : null;

    return {
      projectId,
      projectName: v.name,
      plannedCost,
      plannedTotal,
      profitAmount: Number((v.netTotal - v.cost).toFixed(2)),
      profitPercentAchieved: v.cost > 0 ? Number((((v.netTotal - v.cost) / v.cost) * 100).toFixed(1)) : 0,
      actualCost,
      realProfitAmount,
      realProfitPercent,
      estimateErrorPercent,
    };
  });
}