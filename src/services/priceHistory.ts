import { supabase } from '../lib/supabase';
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

export type ProfitSummary = {
  projectId: string;
  projectName: string;
  projectCreatedAt: string | null;
  plannedCost: number;
  plannedTotal: number;
  vatAmount: number;
  totalWithVat: number;
  materialCost: number;
  laborCost: number;
  foodCost: number;
  transportCost: number;
  otherCost: number;
  profitAmount: number | null;
  profitPercentAchieved: number | null;
  hasCostData: boolean;
  hasAnyCostData: boolean;
  itemsWithCost: number;
  itemCount: number;
  /** Kosto reale finale (nëse është plotësuar dorazi te projekti). null = ende s'ka të dhëna. */
  actualCost: number | null;
  realProfitAmount: number | null;
  realProfitPercent: number | null;
  /** Sa larg ka qenë vlerësimi fillestar nga realiteti, në % (0 = perfekt). null nëse s'ka kosto reale. */
  estimateErrorPercent: number | null;
};

/** Përmbledhje e kostove, TVSH-së dhe fitimit të pritshëm sipas projektit. */
export async function fetchProfitSummaryByProject(): Promise<ProfitSummary[]> {
  if (!supabase) return [];
  const [itemsResult, expensesResult] = await Promise.all([
    supabase.from('project_items').select('id, project_id, total_price, vat_percent, projects(name, actual_total_cost, created_at)'),
    supabase.from('item_expenses').select('project_item_id, expense_type, total_cost'),
  ]);
  if (itemsResult.error) throw new Error(`Pozicionet nuk u lexuan për analizën: ${itemsResult.error.message}`);
  if (expensesResult.error) throw new Error(`Kostot nuk u lexuan për analizën: ${expensesResult.error.message}`);
  const items = itemsResult.data;
  const expenses = expensesResult.data;
  if (!items) return [];

  type ItemCost = {
    total: number;
    material: number;
    labor: number;
    food: number;
    transport: number;
    other: number;
    hasRecords: boolean;
  };
  const costByItem = new Map<string, ItemCost>();
  (expenses || []).forEach((exp) => {
    const key = exp.project_item_id as string;
    const amount = Number(exp.total_cost) || 0;
    const cost = costByItem.get(key) ?? {
      total: 0,
      material: 0,
      labor: 0,
      food: 0,
      transport: 0,
      other: 0,
      hasRecords: false,
    };
    cost.total += amount;
    cost.hasRecords = true;
    switch (exp.expense_type) {
      case 'material':
        cost.material += amount;
        break;
      case 'labor':
        cost.labor += amount;
        break;
      case 'food':
        cost.food += amount;
        break;
      case 'transport':
        cost.transport += amount;
        break;
      default:
        cost.other += amount;
    }
    costByItem.set(key, cost);
  });

  const byProject = new Map<string, {
    name: string;
    cost: number;
    netTotal: number;
    createdAt: string | null;
    vatAmount: number;
    totalWithVat: number;
    materialCost: number;
    laborCost: number;
    foodCost: number;
    transportCost: number;
    otherCost: number;
    hasAnyCostData: boolean;
    itemsWithCost: number;
    itemCount: number;
    actualCost: number | null;
  }>();
  items.forEach((item) => {
    const projectId = item.project_id as string;
    const projectsField = (item as {
      projects?: {
        name: string;
        actual_total_cost?: number | null;
        created_at?: string | null;
      } | {
        name: string;
        actual_total_cost?: number | null;
        created_at?: string | null;
      }[] | null
    }).projects;
    const projectData = Array.isArray(projectsField) ? projectsField[0] : projectsField;
    const itemCost = costByItem.get(item.id as string);
    const cost = itemCost?.total ?? 0;
    const grossTotal = Number(item.total_price) || 0;
    const vatPercent = Number(item.vat_percent ?? 18);
    const netTotal = netAmountFromGross(grossTotal, vatPercent);
    const existing = byProject.get(projectId) || {
      name: projectData?.name || 'Projekt',
      createdAt: projectData?.created_at ?? null,
      cost: 0,
      netTotal: 0,
      vatAmount: 0,
      totalWithVat: 0,
      materialCost: 0,
      laborCost: 0,
      foodCost: 0,
      transportCost: 0,
      otherCost: 0,
      hasAnyCostData: false,
      itemsWithCost: 0,
      itemCount: 0,
      actualCost: projectData?.actual_total_cost ?? null,
    };
    existing.itemCount += 1;
    existing.cost += cost;
    existing.netTotal += netTotal;
    existing.vatAmount += grossTotal - netTotal;
    existing.totalWithVat += grossTotal;
    existing.materialCost += itemCost?.material ?? 0;
    existing.laborCost += itemCost?.labor ?? 0;
    existing.foodCost += itemCost?.food ?? 0;
    existing.transportCost += itemCost?.transport ?? 0;
    existing.otherCost += itemCost?.other ?? 0;
    if (itemCost?.hasRecords) existing.itemsWithCost += 1;
    existing.hasAnyCostData ||= itemCost?.hasRecords ?? false;
    byProject.set(projectId, existing);
  });

  return Array.from(byProject.entries()).map(([projectId, v]) => {
    const plannedCost = Number(v.cost.toFixed(2));
    const plannedTotal = Number(v.netTotal.toFixed(2));
    const hasCostData = v.itemCount > 0 && v.itemsWithCost === v.itemCount;
    const actualCost = v.actualCost != null ? Number(v.actualCost) : null;
    const realProfitAmount = actualCost != null ? Number((v.netTotal - actualCost).toFixed(2)) : null;
    const realProfitPercent = actualCost != null && actualCost > 0 ? Number((((v.netTotal - actualCost) / actualCost) * 100).toFixed(1)) : null;
    const estimateErrorPercent =
      actualCost != null && actualCost > 0 ? Number((((plannedCost - actualCost) / actualCost) * 100).toFixed(1)) : null;

    return {
      projectId,
      projectName: v.name,
      projectCreatedAt: v.createdAt,
      plannedCost,
      plannedTotal,
      vatAmount: Number(v.vatAmount.toFixed(2)),
      totalWithVat: Number(v.totalWithVat.toFixed(2)),
      materialCost: Number(v.materialCost.toFixed(2)),
      laborCost: Number(v.laborCost.toFixed(2)),
      foodCost: Number(v.foodCost.toFixed(2)),
      transportCost: Number(v.transportCost.toFixed(2)),
      otherCost: Number(v.otherCost.toFixed(2)),
      profitAmount: hasCostData ? Number((v.netTotal - v.cost).toFixed(2)) : null,
      profitPercentAchieved: hasCostData && v.cost > 0
        ? Number((((v.netTotal - v.cost) / v.cost) * 100).toFixed(1))
        : null,
      hasCostData,
      hasAnyCostData: v.hasAnyCostData,
      itemsWithCost: v.itemsWithCost,
      itemCount: v.itemCount,
      actualCost,
      realProfitAmount,
      realProfitPercent,
      estimateErrorPercent,
    };
  }).sort((a, b) => {
    const aTime = a.projectCreatedAt ? new Date(a.projectCreatedAt).getTime() : 0;
    const bTime = b.projectCreatedAt ? new Date(b.projectCreatedAt).getTime() : 0;
    return bTime - aTime || a.projectName.localeCompare(b.projectName, 'sq');
  });
}