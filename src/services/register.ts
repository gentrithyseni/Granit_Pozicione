import { calculatePositionPrice } from '../lib/pricing';
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

  let finalProjectId = values.projectId;
  let finalCategoryId = values.categoryId;

  if (finalProjectId === 'NEW' || !finalProjectId) {
    if (!values.newProjectName.trim()) throw new Error('Shkruaj emrin e projektit');
    const { data, error } = await supabase
      .from('projects')
      .insert([
        {
          name: values.newProjectName.trim(),
          client: values.newProjectClient?.trim() || null,
          status: values.newProjectStatus || 'draft',
        },
      ])
      .select()
      .single();
    if (error) throw error;
    finalProjectId = data.id;
  }

  if (finalCategoryId === 'NEW' || !finalCategoryId) {
    if (!values.newCategoryName.trim()) throw new Error('Shkruaj emrin e kategorisë');
    const { data, error } = await supabase.from('categories').insert([{ name: values.newCategoryName.trim() }]).select().single();
    if (error) throw error;
    finalCategoryId = data.id;
  }

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

  const { data: item, error: itemError } = await supabase
    .from('project_items')
    .insert([
      {
        project_id: finalProjectId,
        category_id: finalCategoryId,
        description: values.description,
        unit: values.unit,
        quantity,
        unit_price: unitPrice,
        total_price: total,
      },
    ])
    .select()
    .single();
  if (itemError) throw itemError;

  const { error: expensesError } = await supabase.from('item_expenses').insert([
    { project_item_id: item.id, expense_type: 'material', description: 'Material', unit_cost: Number(values.materialPrice) || 0, quantity, total_cost: materialTotal },
    { project_item_id: item.id, expense_type: 'labor', description: 'Puna', unit_cost: Number(values.laborPrice) || 0, quantity, total_cost: laborTotal },
    { project_item_id: item.id, expense_type: 'food', description: 'Ushqim', unit_cost: Number(values.foodPrice) || 0, quantity: Number(values.days) || 0, total_cost: foodTotal },
    { project_item_id: item.id, expense_type: 'transport', description: 'Transport', unit_cost: Number(values.transportPrice) || 0, quantity: Number(values.days) || 0, total_cost: transportTotal },
    { project_item_id: item.id, expense_type: 'other', description: 'Tjera', unit_cost: otherTotal, quantity: 1, total_cost: otherTotal },
  ]);
  if (expensesError) throw expensesError;

  await recordPriceSnapshot({
    project_item_id: item.id,
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
  };
}