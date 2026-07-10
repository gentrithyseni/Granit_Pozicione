export type DbProject = {
  id: string;
  name: string;
  client?: string | null;
  status?: string | null;
  total_amount?: number | null;
  description?: string | null;
  created_at?: string;
  /** Kosto reale finale — plotësuar dorazi kur projekti mbyllet (krahasohet me planin). */
  actual_total_cost?: number | null;
  actual_notes?: string | null;
};

export type DbCategory = {
  id: string;
  name: string;
  description?: string | null;
  created_at?: string;
};

export type DbProjectItem = {
  id: string;
  project_id: string;
  category_id?: string | null;
  position_number?: string | null;
  description: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at?: string;
  updated_at?: string | null;
  projects?: { name: string } | null;
  categories?: { name: string } | null;
};

export type ItemWithMeta = DbProjectItem & {
  projects?: { name: string } | null;
  categories?: { name: string } | null;
};

export type ProjectSummary = {
  id: string;
  name: string;
  total: number;
};

export type CategorySummary = {
  id: string;
  name: string;
  count: number;
};

export type SearchResultItem = DbProjectItem & {
  projects?: { name: string } | null;
  categories?: { name: string } | null;
};

export type DbPriceHistory = {
  id: string;
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
  recorded_at: string;
};