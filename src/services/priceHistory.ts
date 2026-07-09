import { supabase } from '../lib/supabase';
import type { DbPriceHistory } from '../types/database';

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

/** Regjistron një "foto" të re të çmimit — THIRRET PËRVEÇ ruajtjes normale (project_items/item_expenses),
 * kurrë s'e zëvendëson një rekord ekzistues. Nëse tabela s'ekziston ende (migrimi s'është ekzekutuar),
 * dështon në heshtje për të mos e prishur rrjedhën kryesore të ruajtjes. */
export async function recordPriceSnapshot(snapshot: PriceHistorySnapshot): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from('price_history').insert([snapshot]);
  } catch {
    // tabela price_history mund të mos ekzistojë ende (migrimi i pa ekzekutuar) — s'duam
    // që kjo ta ndalojë ruajtjen kryesore të pozicionit.
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
export async function fetchPriceTrend(categoryId?: string): Promise<PriceTrendPoint[]> {
  if (!supabase) return [];
  let query = supabase.from('price_history').select('*').order('recorded_at', { ascending: true });
  if (categoryId) query = query.eq('category_id', categoryId);
  const { data, error } = await query;
  if (error || !data) return [];
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
};

/** Përmbledhje fitimi (i planifikuar, jo real-pas-përfundimit) sipas projektit — nga
 * item_expenses (kosto) kundrejt project_items.total_price (çmimi final i ofertuar). */
export async function fetchProfitSummaryByProject(): Promise<ProfitSummary[]> {
  if (!supabase) return [];
  const { data: items } = await supabase.from('project_items').select('id, project_id, total_price, projects(name)');
  const { data: expenses } = await supabase.from('item_expenses').select('project_item_id, total_cost');
  if (!items) return [];

  const costByItem = new Map<string, number>();
  (expenses || []).forEach((exp) => {
    const key = exp.project_item_id as string;
    costByItem.set(key, (costByItem.get(key) || 0) + (Number(exp.total_cost) || 0));
  });

  const byProject = new Map<string, { name: string; cost: number; total: number }>();
  items.forEach((item) => {
    const projectId = item.project_id as string;
    const projectsField = (item as { projects?: { name: string } | { name: string }[] | null }).projects;
    const projectName = Array.isArray(projectsField) ? projectsField[0]?.name : projectsField?.name;
    const cost = costByItem.get(item.id as string) || 0;
    const total = Number(item.total_price) || 0;
    const existing = byProject.get(projectId) || { name: projectName || 'Projekt', cost: 0, total: 0 };
    existing.cost += cost;
    existing.total += total;
    byProject.set(projectId, existing);
  });

  return Array.from(byProject.entries()).map(([projectId, v]) => ({
    projectId,
    projectName: v.name,
    plannedCost: Number(v.cost.toFixed(2)),
    plannedTotal: Number(v.total.toFixed(2)),
    profitAmount: Number((v.total - v.cost).toFixed(2)),
    profitPercentAchieved: v.cost > 0 ? Number((((v.total - v.cost) / v.cost) * 100).toFixed(1)) : 0,
  }));
}