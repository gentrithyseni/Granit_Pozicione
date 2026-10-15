import { supabase } from '../lib/supabase';
import type { SearchResultItem } from '../types/database';

export async function searchPositions(query: string): Promise<SearchResultItem[]> {
  if (!supabase) return [];
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const pattern = `%${trimmed}%`;

  const [itemsByField, projectsMatch] = await Promise.all([
    supabase
      .from('project_items')
      .select('*, projects(name), categories(name)')
      .ilike('description', pattern)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('projects').select('id').ilike('name', pattern),
  ]);
  const [itemsByNumber, categoriesMatch] = await Promise.all([
    supabase
      .from('project_items')
      .select('*, projects(name), categories(name)')
      .ilike('position_number', pattern)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('categories').select('id').ilike('name', pattern),
  ]);
  const queryError = itemsByField.error || projectsMatch.error || itemsByNumber.error || categoriesMatch.error;
  if (queryError) throw new Error(`Kërkimi dështoi: ${queryError.message}`);

  const results = new Map<string, SearchResultItem>();
  for (const item of itemsByField.data || []) {
    results.set(item.id, item as SearchResultItem);
  }
  for (const item of itemsByNumber.data || []) {
    results.set(item.id, item as SearchResultItem);
  }

  const projectIds = (projectsMatch.data || []).map((p) => p.id);
  const categoryIds = (categoriesMatch.data || []).map((category) => category.id);
  const [itemsByProject, itemsByCategory] = await Promise.all([
    projectIds.length > 0
      ? supabase.from('project_items').select('*, projects(name), categories(name)').in('project_id', projectIds).order('created_at', { ascending: false }).limit(50)
      : Promise.resolve({ data: [], error: null }),
    categoryIds.length > 0
      ? supabase.from('project_items').select('*, projects(name), categories(name)').in('category_id', categoryIds).order('created_at', { ascending: false }).limit(50)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (itemsByProject.error || itemsByCategory.error) {
    throw new Error(`Kërkimi dështoi: ${(itemsByProject.error || itemsByCategory.error)?.message}`);
  }

  for (const item of [...(itemsByProject.data || []), ...(itemsByCategory.data || [])]) {
      results.set(item.id, item as SearchResultItem);
  }

  return Array.from(results.values()).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
}
