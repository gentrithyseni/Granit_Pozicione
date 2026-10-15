import { DEFAULT_CATEGORIES } from '../constants/defaultCategories';
import { getCached, invalidateCache } from '../lib/cache';
import { supabase } from '../lib/supabase';
import type { DbCategory } from '../types/database';

const CATEGORIES_CACHE_KEY = 'categories';
const CATEGORIES_CACHE_TTL_MS = 5 * 60 * 1000;

export function categoryNameKey(name: string): string {
  const normalized = name.trim().toLocaleLowerCase('sq');
  return normalized === 'metalik & weld' ? 'metalik & saldim' : normalized;
}

export function categoryDisplayName(name: string): string {
  return name.trim().toLocaleLowerCase('sq') === 'metalik & weld' ? 'Metalik & Saldim' : name;
}

export function uniqueCategories(categories: DbCategory[]): DbCategory[] {
  const unique = new Map<string, DbCategory>();
  for (const category of categories) {
    const key = categoryNameKey(category.name);
    const current = unique.get(key);
    const normalizedName = category.name.trim().toLocaleLowerCase('sq');
    const displayCategory = normalizedName === 'metalik & weld'
      ? { ...category, name: categoryDisplayName(category.name) }
      : category;
    if (!current || normalizedName === key) unique.set(key, displayCategory);
  }
  return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name, 'sq'));
}

/** Shton kategoritë standarde nëse nuk ekzistojnë (krahasim pa dallim të madhës së shkronjës). */
export async function ensureDefaultCategories(): Promise<DbCategory[]> {
  if (!supabase) return [];
  const client = supabase;

  return getCached(
    CATEGORIES_CACHE_KEY,
    async () => {
      const { data: existing, error: fetchError } = await client.from('categories').select('*');
      if (fetchError) throw new Error(`Kategoritë nuk u ngarkuan: ${fetchError.message}`);
      if (!existing) throw new Error('Databaza nuk ktheu të dhëna për kategoritë.');
      const list = existing;

      const normalize = categoryNameKey;

      for (const cat of DEFAULT_CATEGORIES) {
        const found = list.some((c) => normalize(c.name) === normalize(cat.name));
        if (!found) {
          const { data: inserted, error: insertError } = await client
            .from('categories')
            .insert([{ name: cat.name, description: cat.description }])
            .select()
            .single();
          if (insertError) throw new Error(`Kategoria "${cat.name}" nuk u krijua: ${insertError.message}`);
          if (!inserted) throw new Error(`Databaza nuk e ktheu kategorinë "${cat.name}" pas krijimit.`);
          list.push(inserted);
        }
      }

      return list.sort((a, b) => a.name.localeCompare(b.name, 'sq'));
    },
    CATEGORIES_CACHE_TTL_MS
  );
}

/** Fshin një kategori. Pozicionet që e përdornin (project_items.category_id) mbeten (bëhen
 * "pa kategori", ON DELETE SET NULL) — s'fshihen vetë pozicionet. KUJDES: nëse kategoria është
 * një nga ato "standarde" (DEFAULT_CATEGORIES), ensureDefaultCategories() do ta rikrijojë
 * automatikisht herën tjetër që hapet Ballina/Regjistro — fshirja "mban" vetëm për kategori
 * të krijuara vetë (jo-standarde). */
export async function deleteCategory(id: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase nuk është i lidhur' };
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (!error) invalidateCache(CATEGORIES_CACHE_KEY);
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