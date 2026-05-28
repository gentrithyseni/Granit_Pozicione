-- Vetëm RLS + politikat (për bazë ekzistuese me të dhëna)
-- Ekzekuto këtë në Supabase SQL Editor NËSE tabelat ekzistojnë tashmë.

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_history ENABLE ROW LEVEL SECURITY;

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
