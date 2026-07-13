import { DEFAULT_CATEGORIES } from '../constants/defaultCategories';
import { supabase } from '../lib/supabase';
import type { DbCategory } from '../types/database';

/** Shton kategoritë standarde nëse nuk ekzistojnë (krahasim pa dallim të madhës së shkronjës). */
export async function ensureDefaultCategories(): Promise<DbCategory[]> {
  if (!supabase) return [];

  const { data: existing } = await supabase.from('categories').select('*');
  const list = existing || [];

  const normalize = (s: string) => s.trim().toLowerCase();

  for (const cat of DEFAULT_CATEGORIES) {
    const found = list.some((c) => normalize(c.name) === normalize(cat.name));
    if (!found) {
      const { data: inserted } = await supabase
        .from('categories')
        .insert([{ name: cat.name, description: cat.description }])
        .select()
        .single();
      if (inserted) list.push(inserted);
    }
  }

  return list.sort((a, b) => a.name.localeCompare(b.name, 'sq'));
}

/** Fshin një kategori. Pozicionet që e përdornin (project_items.category_id) mbeten (bëhen
 * "pa kategori", ON DELETE SET NULL) — s'fshihen vetë pozicionet. KUJDES: nëse kategoria është
 * një nga ato "standarde" (DEFAULT_CATEGORIES), ensureDefaultCategories() do ta rikrijojë
 * automatikisht herën tjetër që hapet Ballina/Regjistro — fshirja "mban" vetëm për kategori
 * të krijuara vetë (jo-standarde). */
export async function deleteCategory(id: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase nuk është i lidhur' };
  const { error } = await supabase.from('categories').delete().eq('id', id);
  return { error: error?.message ?? null };
}

export function groupItemsByProject<T extends { project_id: string; projects?: { name: string } | null; total_price: number }>(
  items: T[]
): { projectId: string; projectName: string; items: T[]; subtotal: number }[] {
  const map = new Map<string, { projectId: string; projectName: string; items: T[]; subtotal: number }>();

  for (const item of items) {
    const key = item.project_id;
    const name = item.projects?.name || 'Projekt i panjohur';
    if (!map.has(key)) {
      map.set(key, { projectId: key, projectName: name, items: [], subtotal: 0 });
    }
    const group = map.get(key)!;
    group.items.push(item);
    group.subtotal += Number(item.total_price) || 0;
  }

  return Array.from(map.values()).sort((a, b) => b.subtotal - a.subtotal);
}