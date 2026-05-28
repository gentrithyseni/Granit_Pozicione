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
      .or(`description.ilike.${pattern},position_number.ilike.${pattern}`)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('projects').select('id').ilike('name', pattern),
  ]);

  const results = new Map<string, SearchResultItem>();
  for (const item of itemsByField.data || []) {
    results.set(item.id, item as SearchResultItem);
  }

  const projectIds = (projectsMatch.data || []).map((p) => p.id);
  if (projectIds.length > 0) {
    const { data: itemsByProject } = await supabase
      .from('project_items')
      .select('*, projects(name), categories(name)')
      .in('project_id', projectIds)
      .order('created_at', { ascending: false })
      .limit(50);

    for (const item of itemsByProject || []) {
      results.set(item.id, item as SearchResultItem);
    }
  }

  return Array.from(results.values());
}
