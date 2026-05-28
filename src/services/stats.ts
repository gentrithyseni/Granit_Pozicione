import { supabase } from '../lib/supabase';

export async function fetchDashboardStats() {
  if (!supabase) return { projects: 0, categories: 0, items: 0 };
  const [projectsRes, categoriesRes, itemsRes] = await Promise.all([
    supabase.from('projects').select('*', { count: 'exact', head: true }),
    supabase.from('categories').select('*', { count: 'exact', head: true }),
    supabase.from('project_items').select('*', { count: 'exact', head: true }),
  ]);
  return {
    projects: projectsRes.count || 0,
    categories: categoriesRes.count || 0,
    items: itemsRes.count || 0,
  };
}
