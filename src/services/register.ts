import { calculatePositionPrice } from '../lib/pricing';
import { invalidateCache } from '../lib/cache';
import { supabase } from '../lib/supabase';
import { recordPriceSnapshot } from './priceHistory';

export type RegisterFormValues = {
  projectId: string;
  newProjectName: string;
  newProjectClient: string;
  newProjectStatus: string;
  categoryId: string;
  newCategoryName: string;
  location?: string;
  description: string;
  unit: string;
  quantity: number;
  materialPrice: number;
  laborPrice: number;
  days: number;
  foodPrice: number;
  transportPrice: number;
  otherPrice: number;
  profitPercent: number;
  vatPercent: number;
};

export async function saveRegisterRow(values: RegisterFormValues) {
  if (!supabase) throw new Error('Supabase nuk është i lidhur');

  const creatingProject = values.projectId === 'NEW' || !values.projectId;
  const creatingCategory = values.categoryId === 'NEW' || !values.categoryId;
  if (creatingProject && !values.newProjectName.trim()) throw new Error('Shkruaj emrin e projektit');
  if (creatingCategory && !values.newCategoryName.trim()) throw new Error('Shkruaj emrin e kategorisë');

  const quantity = Number(values.quantity) || 0;
  const breakdown = calculatePositionPrice({
    quantity,
    materialPrice: values.materialPrice,
    laborPrice: values.laborPrice,
    days: values.days,
    foodPrice: values.foodPrice,
    transportPrice: values.transportPrice,
    otherPrice: values.otherPrice,
    profitPercent: values.profitPercent,
    vatPercent: values.vatPercent,
  });
  const { materialTotal, laborTotal, foodTotal, transportTotal, otherTotal, total, unitPrice } = breakdown;

  const expenses = [
    { expense_type: 'material', description: 'Material', unit_cost: Number(values.materialPrice) || 0, quantity, total_cost: materialTotal },
    { expense_type: 'labor', description: 'Puna', unit_cost: Number(values.laborPrice) || 0, quantity, total_cost: laborTotal },
    { expense_type: 'food', description: 'Ushqim', unit_cost: Number(values.foodPrice) || 0, quantity: Number(values.days) || 0, total_cost: foodTotal },
    { expense_type: 'transport', description: `Transport: ${values.location?.trim() || 'Pa qytet'}`, unit_cost: Number(values.transportPrice) || 0, quantity: Number(values.days) || 0, total_cost: transportTotal },
    { expense_type: 'other', description: 'Tjera', unit_cost: otherTotal, quantity: 1, total_cost: otherTotal },
  ];

  const { data: saved, error } = await supabase.rpc('save_register_position', {
    p_project_id: creatingProject ? null : values.projectId,
    p_new_project: creatingProject
      ? {
          name: values.newProjectName.trim(),
          client: values.newProjectClient?.trim() || null,
          status: values.newProjectStatus || 'draft',
        }
      : null,
    p_category_id: creatingCategory ? null : values.categoryId,
    p_new_category: creatingCategory ? { name: values.newCategoryName.trim() } : null,
    p_item: {
      description: values.description.trim(),
      unit: values.unit,
      quantity,
      unit_price: unitPrice,
      total_price: total,
      profit_percent: Number(values.profitPercent) || 0,
      vat_percent: values.vatPercent == null ? 18 : Number(values.vatPercent) || 0,
    },
    p_expenses: expenses,
  });
  if (error) throw new Error(`Pozicioni nuk u ruajt: ${error.message}`);
  if (!saved?.item_id || !saved.project_id || !saved.category_id) {
    throw new Error('Databaza nuk ktheu identifikuesit e rreshtit të ruajtur.');
  }
  const { item_id: itemId, project_id: finalProjectId, category_id: finalCategoryId } = saved;
  if (creatingCategory) invalidateCache('categories');

  const priceHistoryResult = await recordPriceSnapshot({
    project_item_id: itemId,
    project_id: finalProjectId,
    category_id: finalCategoryId,
    description: values.description,
    unit: values.unit,
    material_price: Number(values.materialPrice) || 0,
    labor_price: Number(values.laborPrice) || 0,
    quantity,
    unit_price: unitPrice,
    total_price: total,
    profit_percent: Number(values.profitPercent) || 0,
  });

  return {
    unit: values.unit,
    qty: quantity,
    price: Number(unitPrice.toFixed(2)),
    total: Number(total.toFixed(2)),
    priceHistoryError: priceHistoryResult.error,
  };
}