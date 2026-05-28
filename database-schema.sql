-- Krijimi i tabelave bazë për sistemin e llogaritjes së paramasave / ofertave (Graniti)

-- 1. Kategoritë (p.sh. Punët e dheut, Punët e betonit)
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Projektet (Ofertat / Paramasat)
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  client TEXT,
  status TEXT DEFAULT 'draft',
  total_amount NUMERIC DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Pozicionet (Project Items)
CREATE TABLE IF NOT EXISTS project_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  position_number TEXT,
  description TEXT NOT NULL,
  unit TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Shpenzimet e detajuara (material, labor, machinery, food, transport, other)
CREATE TABLE IF NOT EXISTS item_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_item_id UUID NOT NULL REFERENCES project_items(id) ON DELETE CASCADE,
  expense_type TEXT NOT NULL,
  description TEXT,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  quantity NUMERIC NOT NULL DEFAULT 1,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Historiku i importeve
CREATE TABLE IF NOT EXISTS import_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  file_name TEXT,
  item_ids UUID[] DEFAULT ARRAY[]::UUID[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  undone BOOLEAN DEFAULT false
);

-- Row Level Security — vetëm përdorues të autentifikuar
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_history ENABLE ROW LEVEL SECURITY;

-- Hiq politikat e vjetra (nëse ekzistojnë) dhe krijo të reja
DROP POLICY IF EXISTS "Allow all actions on categories" ON categories;
DROP POLICY IF EXISTS "Allow all actions on projects" ON projects;
DROP POLICY IF EXISTS "Allow all actions on project_items" ON project_items;
DROP POLICY IF EXISTS "Allow all actions on item_expenses" ON item_expenses;
DROP POLICY IF EXISTS "Allow all actions on import_history" ON import_history;

DROP POLICY IF EXISTS "Authenticated users full access on categories" ON categories;
DROP POLICY IF EXISTS "Authenticated users full access on projects" ON projects;
DROP POLICY IF EXISTS "Authenticated users full access on project_items" ON project_items;
DROP POLICY IF EXISTS "Authenticated users full access on item_expenses" ON item_expenses;
DROP POLICY IF EXISTS "Authenticated users full access on import_history" ON import_history;

CREATE POLICY "Authenticated users full access on categories"
  ON categories FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users full access on projects"
  ON projects FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users full access on project_items"
  ON project_items FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users full access on item_expenses"
  ON item_expenses FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users full access on import_history"
  ON import_history FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
