-- Kategoritë standarde (ekzekuto një herë në Supabase SQL Editor)
-- Nuk fshin asgjë; shton vetëm nëse emri nuk ekziston.

INSERT INTO categories (name, description)
SELECT v.name, v.description
FROM (VALUES
  ('Pllaka', 'Shtrim pllakash, qeramikë, gips'),
  ('Ujë / Hidraulik', 'Instalime uji, tubacione'),
  ('Sanitari', 'WC, lavaman, dush'),
  ('Energji Elektrike', 'Instalime elektrike, kabllo'),
  ('Lyerje', 'Lyerje muresh, fasada'),
  ('Beton & Strukturë', 'Beton, hekur, armatura'),
  ('Çati & Mbulim', 'Çati, izolim çatie'),
  ('Dritare & Dyer', 'Montim dritaresh, dyerve'),
  ('Izolim Termik', 'Izolim, polistirol'),
  ('Punët e Tokës', 'Gërmim, mbushje'),
  ('Metalik & Weld', 'Konstruksione metalike'),
  ('Tjera', 'Pozicione të tjera')
) AS v(name, description)
WHERE NOT EXISTS (
  SELECT 1 FROM categories c WHERE lower(trim(c.name)) = lower(trim(v.name))
);
