import { supabase } from '../lib/supabase';
import { ConstructionBookConfig, ConstructionBookPosition } from '../lib/constructionBook';

export interface ProjectWithItems {
  id: string;
  name: string;
  description: string | null;
  client: string | null;
  items: {
    id: string;
    position_number: string;
    description: string;
    unit: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }[];
}

/**
 * Merr të gjitha projektet nga Supabase
 */
export async function getProjects(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Merr një projekt me të gjitha pozicionet e tij
 */
export async function getProjectWithItems(projectId: string): Promise<ProjectWithItems | null> {
  const { data, error } = await supabase
    .from('projects')
    .select(`
      id,
      name,
      description,
      client,
      project_items (
        id,
        position_number,
        description,
        unit,
        quantity,
        unit_price,
        total_price
      )
    `)
    .eq('id', projectId)
    .single();

  if (error) throw error;
  if (!data) return null;

  // Supabase kthen array për relation 1:N
  const items = (data.project_items || []).map((item: any) => ({
    id: item.id,
    position_number: item.position_number || '',
    description: item.description || '',
    unit: item.unit || 'copë',
    quantity: Number(item.quantity) || 0,
    unit_price: Number(item.unit_price) || 0,
    total_price: Number(item.total_price) || 0
  }));

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    client: data.client,
    items
  };
}

/**
 * Krijon konfigurimin e Librit Ndërtimor nga projekti
 * Kjo funksionon si "factory" - ti mund ta rregullosh sipas nevojës
 */
export function buildBookConfig(
  project: ProjectWithItems,
  options: {
    month?: string;
    executor_name?: string;
    section_title?: string;
    section_number?: string;
    unit_label?: string;
    max_positions_per_page?: number;
  } = {}
): ConstructionBookConfig {
  const positions: ConstructionBookPosition[] = project.items.map(item => ({
    position_number: item.position_number,
    description: item.description,
    unit: item.unit,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total_price: item.total_price
  }));

  // Ndërto string-un e pozicioneve për header (p.sh. "No 5.1, 5.2, 5.3")
  const posNumbers = positions.map(p => p.position_number).filter(Boolean);
  const offerPositions = posNumbers.length > 0 
    ? `No ${posNumbers.join(', ')}` 
    : 'No --';

  // Gjej numrin e seksionit nga pozicioni i parë (p.sh. "5.1" -> "V" ose "5")
  const firstPos = posNumbers[0] || '';
  const sectionNum = firstPos.split('.')[0] || options.section_number || 'V';

  return {
    month: options.month || getCurrentMonthYear(),
    executor_name: options.executor_name || 'MEGRANT ING SH.P.K',
    building_name: project.name || project.description || 'Objekti',
    section_title: options.section_title || `V. PUNIMET TË TJERA`,
    section_number: `No ${sectionNum}`,
    unit_label: options.unit_label || 'm²',
    offer_account: `No ${sectionNum}`,
    offer_positions: offerPositions,
    positions,
    max_positions_per_page: options.max_positions_per_page || 4
  };
}

function getCurrentMonthYear(): string {
  const months = [
    'JANAR', 'SHKURT', 'MARS', 'PRILL', 'MAJ', 'QERSHOR',
    'KORRIK', 'GUSHT', 'SHTATOR', 'TETOR', 'NËNTOR', 'DHJETOR'
  ];
  const now = new Date();
  return `${months[now.getMonth()]} ${now.getFullYear()}`;
}