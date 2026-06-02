-- ============================================================
-- DICREJART - Setup completo de base de datos
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- ─── CATEGORIES (tabla maestra de categorías) ───
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  short_title text,
  route text,
  view_id text,
  icon_name text DEFAULT 'Package',
  zone text DEFAULT 'arcade',
  table_name text NOT NULL,
  schema jsonb
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='categories' AND policyname='auth_select_categories') THEN
    CREATE POLICY "auth_select_categories" ON public.categories FOR SELECT TO authenticated USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='categories' AND policyname='auth_insert_categories') THEN
    CREATE POLICY "auth_insert_categories" ON public.categories FOR INSERT TO authenticated WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='categories' AND policyname='auth_update_categories') THEN
    CREATE POLICY "auth_update_categories" ON public.categories FOR UPDATE TO authenticated USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='categories' AND policyname='auth_delete_categories') THEN
    CREATE POLICY "auth_delete_categories" ON public.categories FOR DELETE TO authenticated USING (true); END IF;
END $$;

-- ─── MOVEMENTS ───
CREATE TABLE IF NOT EXISTS public.movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  action text,
  item text,
  "user" text,
  details text,
  category text,
  subcategory text,
  qty int4 DEFAULT 0,
  timestamp timestamptz DEFAULT now(),
  time text,
  annulled boolean DEFAULT false,
  "annulledBy" text,
  "annulledAt" timestamptz
);
ALTER TABLE public.movements ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='movements' AND policyname='auth_select_movements') THEN
    CREATE POLICY "auth_select_movements" ON public.movements FOR SELECT TO authenticated USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='movements' AND policyname='auth_insert_movements') THEN
    CREATE POLICY "auth_insert_movements" ON public.movements FOR INSERT TO authenticated WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='movements' AND policyname='auth_update_movements') THEN
    CREATE POLICY "auth_update_movements" ON public.movements FOR UPDATE TO authenticated USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='movements' AND policyname='auth_delete_movements') THEN
    CREATE POLICY "auth_delete_movements" ON public.movements FOR DELETE TO authenticated USING (true); END IF;
END $$;

-- ─── PERSONNEL ───
CREATE TABLE IF NOT EXISTS public.personnel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  role text,
  department text,
  phone text,
  email text,
  notes text
);
ALTER TABLE public.personnel ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='personnel' AND policyname='auth_select_personnel') THEN
    CREATE POLICY "auth_select_personnel" ON public.personnel FOR SELECT TO authenticated USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='personnel' AND policyname='auth_insert_personnel') THEN
    CREATE POLICY "auth_insert_personnel" ON public.personnel FOR INSERT TO authenticated WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='personnel' AND policyname='auth_update_personnel') THEN
    CREATE POLICY "auth_update_personnel" ON public.personnel FOR UPDATE TO authenticated USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='personnel' AND policyname='auth_delete_personnel') THEN
    CREATE POLICY "auth_delete_personnel" ON public.personnel FOR DELETE TO authenticated USING (true); END IF;
END $$;

-- ─── BRANDS ───
CREATE TABLE IF NOT EXISTS public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL UNIQUE
);
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='brands' AND policyname='auth_select_brands') THEN
    CREATE POLICY "auth_select_brands" ON public.brands FOR SELECT TO authenticated USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='brands' AND policyname='auth_insert_brands') THEN
    CREATE POLICY "auth_insert_brands" ON public.brands FOR INSERT TO authenticated WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='brands' AND policyname='auth_update_brands') THEN
    CREATE POLICY "auth_update_brands" ON public.brands FOR UPDATE TO authenticated USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='brands' AND policyname='auth_delete_brands') THEN
    CREATE POLICY "auth_delete_brands" ON public.brands FOR DELETE TO authenticated USING (true); END IF;
END $$;

-- ─── LOCATIONS ───
CREATE TABLE IF NOT EXISTS public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  zone text
);
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='locations' AND policyname='auth_select_locations') THEN
    CREATE POLICY "auth_select_locations" ON public.locations FOR SELECT TO authenticated USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='locations' AND policyname='auth_insert_locations') THEN
    CREATE POLICY "auth_insert_locations" ON public.locations FOR INSERT TO authenticated WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='locations' AND policyname='auth_update_locations') THEN
    CREATE POLICY "auth_update_locations" ON public.locations FOR UPDATE TO authenticated USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='locations' AND policyname='auth_delete_locations') THEN
    CREATE POLICY "auth_delete_locations" ON public.locations FOR DELETE TO authenticated USING (true); END IF;
END $$;

-- ─── TABLAS DE ITEMS POR CATEGORÍA ───
-- Columnas base para todos los items:
-- id, created_at, updated_at, name, qty, threshold, marca, location,
-- status, subcategory, observaciones, prestados, borrowedBy, lentBy, loanDate

-- Helper macro para no repetir: se crea cada tabla individualmente

-- 1. Insumos y Papelería → cat_insumos
CREATE TABLE IF NOT EXISTS public.cat_insumos (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "name" text NOT NULL,
  "qty" int4 DEFAULT 0,
  "threshold" int4 DEFAULT 0,
  "marca" text,
  "location" text,
  "status" text,
  "subcategory" text,
  "observaciones" text,
  "prestados" int4 DEFAULT 0,
  "borrowedBy" text,
  "lentBy" text,
  "loanDate" timestamptz
);
ALTER TABLE public.cat_insumos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cat_insumos' AND policyname='auth_select_cat_insumos') THEN CREATE POLICY "auth_select_cat_insumos" ON public.cat_insumos FOR SELECT TO authenticated USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cat_insumos' AND policyname='auth_insert_cat_insumos') THEN CREATE POLICY "auth_insert_cat_insumos" ON public.cat_insumos FOR INSERT TO authenticated WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cat_insumos' AND policyname='auth_update_cat_insumos') THEN CREATE POLICY "auth_update_cat_insumos" ON public.cat_insumos FOR UPDATE TO authenticated USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cat_insumos' AND policyname='auth_delete_cat_insumos') THEN CREATE POLICY "auth_delete_cat_insumos" ON public.cat_insumos FOR DELETE TO authenticated USING (true); END IF;
END $$;

-- 2. Repuestos Arcades → cat_repuestos_arcades
CREATE TABLE IF NOT EXISTS public.cat_repuestos_arcades (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "name" text NOT NULL,
  "qty" int4 DEFAULT 0,
  "threshold" int4 DEFAULT 0,
  "marca" text,
  "location" text,
  "status" text,
  "subcategory" text,
  "observaciones" text,
  "prestados" int4 DEFAULT 0,
  "borrowedBy" text,
  "lentBy" text,
  "loanDate" timestamptz
);
ALTER TABLE public.cat_repuestos_arcades ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cat_repuestos_arcades' AND policyname='auth_select_cat_repuestos_arcades') THEN CREATE POLICY "auth_select_cat_repuestos_arcades" ON public.cat_repuestos_arcades FOR SELECT TO authenticated USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cat_repuestos_arcades' AND policyname='auth_insert_cat_repuestos_arcades') THEN CREATE POLICY "auth_insert_cat_repuestos_arcades" ON public.cat_repuestos_arcades FOR INSERT TO authenticated WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cat_repuestos_arcades' AND policyname='auth_update_cat_repuestos_arcades') THEN CREATE POLICY "auth_update_cat_repuestos_arcades" ON public.cat_repuestos_arcades FOR UPDATE TO authenticated USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cat_repuestos_arcades' AND policyname='auth_delete_cat_repuestos_arcades') THEN CREATE POLICY "auth_delete_cat_repuestos_arcades" ON public.cat_repuestos_arcades FOR DELETE TO authenticated USING (true); END IF;
END $$;

-- 3. Premios y Juguetes → cat_premios
CREATE TABLE IF NOT EXISTS public.cat_premios (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "name" text NOT NULL,
  "qty" int4 DEFAULT 0,
  "threshold" int4 DEFAULT 0,
  "marca" text,
  "location" text,
  "status" text,
  "subcategory" text,
  "observaciones" text,
  "prestados" int4 DEFAULT 0,
  "borrowedBy" text,
  "lentBy" text,
  "loanDate" timestamptz
);
ALTER TABLE public.cat_premios ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cat_premios' AND policyname='auth_select_cat_premios') THEN CREATE POLICY "auth_select_cat_premios" ON public.cat_premios FOR SELECT TO authenticated USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cat_premios' AND policyname='auth_insert_cat_premios') THEN CREATE POLICY "auth_insert_cat_premios" ON public.cat_premios FOR INSERT TO authenticated WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cat_premios' AND policyname='auth_update_cat_premios') THEN CREATE POLICY "auth_update_cat_premios" ON public.cat_premios FOR UPDATE TO authenticated USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cat_premios' AND policyname='auth_delete_cat_premios') THEN CREATE POLICY "auth_delete_cat_premios" ON public.cat_premios FOR DELETE TO authenticated USING (true); END IF;
END $$;

-- 4. Electrónica y Gadgets → cat_electronica
CREATE TABLE IF NOT EXISTS public.cat_electronica (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "name" text NOT NULL,
  "qty" int4 DEFAULT 0,
  "threshold" int4 DEFAULT 0,
  "marca" text,
  "location" text,
  "status" text,
  "subcategory" text,
  "observaciones" text,
  "prestados" int4 DEFAULT 0,
  "borrowedBy" text,
  "lentBy" text,
  "loanDate" timestamptz
);
ALTER TABLE public.cat_electronica ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cat_electronica' AND policyname='auth_select_cat_electronica') THEN CREATE POLICY "auth_select_cat_electronica" ON public.cat_electronica FOR SELECT TO authenticated USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cat_electronica' AND policyname='auth_insert_cat_electronica') THEN CREATE POLICY "auth_insert_cat_electronica" ON public.cat_electronica FOR INSERT TO authenticated WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cat_electronica' AND policyname='auth_update_cat_electronica') THEN CREATE POLICY "auth_update_cat_electronica" ON public.cat_electronica FOR UPDATE TO authenticated USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cat_electronica' AND policyname='auth_delete_cat_electronica') THEN CREATE POLICY "auth_delete_cat_electronica" ON public.cat_electronica FOR DELETE TO authenticated USING (true); END IF;
END $$;

-- 5. Alimentos y Dulcería → cat_alimentos
CREATE TABLE IF NOT EXISTS public.cat_alimentos (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "name" text NOT NULL,
  "qty" int4 DEFAULT 0,
  "threshold" int4 DEFAULT 0,
  "marca" text,
  "location" text,
  "status" text,
  "subcategory" text,
  "observaciones" text,
  "prestados" int4 DEFAULT 0,
  "borrowedBy" text,
  "lentBy" text,
  "loanDate" timestamptz
);
ALTER TABLE public.cat_alimentos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cat_alimentos' AND policyname='auth_select_cat_alimentos') THEN CREATE POLICY "auth_select_cat_alimentos" ON public.cat_alimentos FOR SELECT TO authenticated USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cat_alimentos' AND policyname='auth_insert_cat_alimentos') THEN CREATE POLICY "auth_insert_cat_alimentos" ON public.cat_alimentos FOR INSERT TO authenticated WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cat_alimentos' AND policyname='auth_update_cat_alimentos') THEN CREATE POLICY "auth_update_cat_alimentos" ON public.cat_alimentos FOR UPDATE TO authenticated USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cat_alimentos' AND policyname='auth_delete_cat_alimentos') THEN CREATE POLICY "auth_delete_cat_alimentos" ON public.cat_alimentos FOR DELETE TO authenticated USING (true); END IF;
END $$;

-- 6. Textiles y Uniformes → cat_textiles
CREATE TABLE IF NOT EXISTS public.cat_textiles (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "name" text NOT NULL,
  "qty" int4 DEFAULT 0,
  "threshold" int4 DEFAULT 0,
  "marca" text,
  "location" text,
  "status" text,
  "subcategory" text,
  "observaciones" text,
  "prestados" int4 DEFAULT 0,
  "borrowedBy" text,
  "lentBy" text,
  "loanDate" timestamptz
);
ALTER TABLE public.cat_textiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cat_textiles' AND policyname='auth_select_cat_textiles') THEN CREATE POLICY "auth_select_cat_textiles" ON public.cat_textiles FOR SELECT TO authenticated USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cat_textiles' AND policyname='auth_insert_cat_textiles') THEN CREATE POLICY "auth_insert_cat_textiles" ON public.cat_textiles FOR INSERT TO authenticated WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cat_textiles' AND policyname='auth_update_cat_textiles') THEN CREATE POLICY "auth_update_cat_textiles" ON public.cat_textiles FOR UPDATE TO authenticated USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cat_textiles' AND policyname='auth_delete_cat_textiles') THEN CREATE POLICY "auth_delete_cat_textiles" ON public.cat_textiles FOR DELETE TO authenticated USING (true); END IF;
END $$;

-- 7. Cristalería y Souvenirs → cat_souvenirs
CREATE TABLE IF NOT EXISTS public.cat_souvenirs (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "name" text NOT NULL,
  "qty" int4 DEFAULT 0,
  "threshold" int4 DEFAULT 0,
  "marca" text,
  "location" text,
  "status" text,
  "subcategory" text,
  "observaciones" text,
  "prestados" int4 DEFAULT 0,
  "borrowedBy" text,
  "lentBy" text,
  "loanDate" timestamptz
);
ALTER TABLE public.cat_souvenirs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cat_souvenirs' AND policyname='auth_select_cat_souvenirs') THEN CREATE POLICY "auth_select_cat_souvenirs" ON public.cat_souvenirs FOR SELECT TO authenticated USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cat_souvenirs' AND policyname='auth_insert_cat_souvenirs') THEN CREATE POLICY "auth_insert_cat_souvenirs" ON public.cat_souvenirs FOR INSERT TO authenticated WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cat_souvenirs' AND policyname='auth_update_cat_souvenirs') THEN CREATE POLICY "auth_update_cat_souvenirs" ON public.cat_souvenirs FOR UPDATE TO authenticated USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cat_souvenirs' AND policyname='auth_delete_cat_souvenirs') THEN CREATE POLICY "auth_delete_cat_souvenirs" ON public.cat_souvenirs FOR DELETE TO authenticated USING (true); END IF;
END $$;

-- 8. Infraestructura y TI → cat_ti
CREATE TABLE IF NOT EXISTS public.cat_ti (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "name" text NOT NULL,
  "qty" int4 DEFAULT 0,
  "threshold" int4 DEFAULT 0,
  "marca" text,
  "location" text,
  "status" text,
  "subcategory" text,
  "observaciones" text,
  "prestados" int4 DEFAULT 0,
  "borrowedBy" text,
  "lentBy" text,
  "loanDate" timestamptz
);
ALTER TABLE public.cat_ti ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cat_ti' AND policyname='auth_select_cat_ti') THEN CREATE POLICY "auth_select_cat_ti" ON public.cat_ti FOR SELECT TO authenticated USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cat_ti' AND policyname='auth_insert_cat_ti') THEN CREATE POLICY "auth_insert_cat_ti" ON public.cat_ti FOR INSERT TO authenticated WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cat_ti' AND policyname='auth_update_cat_ti') THEN CREATE POLICY "auth_update_cat_ti" ON public.cat_ti FOR UPDATE TO authenticated USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cat_ti' AND policyname='auth_delete_cat_ti') THEN CREATE POLICY "auth_delete_cat_ti" ON public.cat_ti FOR DELETE TO authenticated USING (true); END IF;
END $$;

-- 9. Juegos y Entretenimiento → cat_juegos
CREATE TABLE IF NOT EXISTS public.cat_juegos (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "name" text NOT NULL,
  "qty" int4 DEFAULT 0,
  "threshold" int4 DEFAULT 0,
  "marca" text,
  "location" text,
  "status" text,
  "subcategory" text,
  "observaciones" text,
  "prestados" int4 DEFAULT 0,
  "borrowedBy" text,
  "lentBy" text,
  "loanDate" timestamptz
);
ALTER TABLE public.cat_juegos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cat_juegos' AND policyname='auth_select_cat_juegos') THEN CREATE POLICY "auth_select_cat_juegos" ON public.cat_juegos FOR SELECT TO authenticated USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cat_juegos' AND policyname='auth_insert_cat_juegos') THEN CREATE POLICY "auth_insert_cat_juegos" ON public.cat_juegos FOR INSERT TO authenticated WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cat_juegos' AND policyname='auth_update_cat_juegos') THEN CREATE POLICY "auth_update_cat_juegos" ON public.cat_juegos FOR UPDATE TO authenticated USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cat_juegos' AND policyname='auth_delete_cat_juegos') THEN CREATE POLICY "auth_delete_cat_juegos" ON public.cat_juegos FOR DELETE TO authenticated USING (true); END IF;
END $$;

-- 10. Promocionales → cat_publicidad
CREATE TABLE IF NOT EXISTS public.cat_publicidad (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "name" text NOT NULL,
  "qty" int4 DEFAULT 0,
  "threshold" int4 DEFAULT 0,
  "marca" text,
  "location" text,
  "status" text,
  "subcategory" text,
  "observaciones" text,
  "prestados" int4 DEFAULT 0,
  "borrowedBy" text,
  "lentBy" text,
  "loanDate" timestamptz
);
ALTER TABLE public.cat_publicidad ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cat_publicidad' AND policyname='auth_select_cat_publicidad') THEN CREATE POLICY "auth_select_cat_publicidad" ON public.cat_publicidad FOR SELECT TO authenticated USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cat_publicidad' AND policyname='auth_insert_cat_publicidad') THEN CREATE POLICY "auth_insert_cat_publicidad" ON public.cat_publicidad FOR INSERT TO authenticated WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cat_publicidad' AND policyname='auth_update_cat_publicidad') THEN CREATE POLICY "auth_update_cat_publicidad" ON public.cat_publicidad FOR UPDATE TO authenticated USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='cat_publicidad' AND policyname='auth_delete_cat_publicidad') THEN CREATE POLICY "auth_delete_cat_publicidad" ON public.cat_publicidad FOR DELETE TO authenticated USING (true); END IF;
END $$;

-- ─── INSERTAR CATEGORÍAS ───
INSERT INTO public.categories (slug, title, short_title, route, view_id, icon_name, zone, table_name, schema)
VALUES
  ('insumos',          'Insumos y Papelería',       'Insumos',      '/insumos',         'insumos',          'PenTool',  'arcade',  'cat_insumos',          '[{"name":"name","label":"Name","type":"text"},{"name":"qty","label":"Qty","type":"int4"},{"name":"threshold","label":"Threshold","type":"int4"},{"name":"marca","label":"Marca","type":"text"},{"name":"location","label":"Location","type":"text"}]'),
  ('repuestos-arcades','Repuestos Arcades',          'Repuestos',    '/repuestos-arcades','repuestos-arcades','Settings', 'arcade',  'cat_repuestos_arcades','[{"name":"name","label":"Name","type":"text"},{"name":"qty","label":"Qty","type":"int4"},{"name":"threshold","label":"Threshold","type":"int4"},{"name":"marca","label":"Marca","type":"text"},{"name":"location","label":"Location","type":"text"}]'),
  ('premios',          'Premios y Juguetes',         'Premios',      '/premios',          'premios',          'Gift',     'yellow',  'cat_premios',          '[{"name":"name","label":"Name","type":"text"},{"name":"qty","label":"Qty","type":"int4"},{"name":"threshold","label":"Threshold","type":"int4"},{"name":"marca","label":"Marca","type":"text"},{"name":"location","label":"Location","type":"text"}]'),
  ('electronica',      'Electrónica y Gadgets',      'Electrónica',  '/electronica',      'electronica',      'Cpu',      'laser',   'cat_electronica',      '[{"name":"name","label":"Name","type":"text"},{"name":"qty","label":"Qty","type":"int4"},{"name":"threshold","label":"Threshold","type":"int4"},{"name":"marca","label":"Marca","type":"text"},{"name":"location","label":"Location","type":"text"}]'),
  ('alimentos',        'Alimentos y Dulcería',       'Alimentos',    '/alimentos',        'alimentos',        'Cookie',   'hachas',  'cat_alimentos',        '[{"name":"name","label":"Name","type":"text"},{"name":"qty","label":"Qty","type":"int4"},{"name":"threshold","label":"Threshold","type":"int4"},{"name":"marca","label":"Marca","type":"text"},{"name":"location","label":"Location","type":"text"}]'),
  ('textiles',         'Textiles y Uniformes',       'Textiles',     '/textiles',         'textiles',         'Shirt',    'boliche', 'cat_textiles',         '[{"name":"name","label":"Name","type":"text"},{"name":"qty","label":"Qty","type":"int4"},{"name":"threshold","label":"Threshold","type":"int4"},{"name":"marca","label":"Marca","type":"text"},{"name":"location","label":"Location","type":"text"}]'),
  ('souvenirs',        'Cristalería y Souvenirs',    'Souvenirs',    '/souvenirs',        'souvenirs',        'Trophy',   'yellow',  'cat_souvenirs',        '[{"name":"name","label":"Name","type":"text"},{"name":"qty","label":"Qty","type":"int4"},{"name":"threshold","label":"Threshold","type":"int4"},{"name":"marca","label":"Marca","type":"text"},{"name":"location","label":"Location","type":"text"}]'),
  ('ti',               'Infraestructura y TI',       'Infra & TI',   '/ti',               'ti',               'Server',   'boliche', 'cat_ti',               '[{"name":"name","label":"Name","type":"text"},{"name":"qty","label":"Qty","type":"int4"},{"name":"threshold","label":"Threshold","type":"int4"},{"name":"marca","label":"Marca","type":"text"},{"name":"location","label":"Location","type":"text"}]'),
  ('juegos',           'Juegos y Entretenimiento',   'Juegos',       '/juegos',           'juegos',           'Gamepad2', 'laser',   'cat_juegos',           '[{"name":"name","label":"Name","type":"text"},{"name":"qty","label":"Qty","type":"int4"},{"name":"threshold","label":"Threshold","type":"int4"},{"name":"marca","label":"Marca","type":"text"},{"name":"location","label":"Location","type":"text"}]'),
  ('publicidad',       'Promocionales',              'Promocionales','/promocionales',    'promocionales',    'Megaphone','arcade',  'cat_publicidad',       '[{"name":"name","label":"Name","type":"text"},{"name":"qty","label":"Qty","type":"int4"},{"name":"threshold","label":"Threshold","type":"int4"},{"name":"marca","label":"Marca","type":"text"},{"name":"location","label":"Location","type":"text"}]')
ON CONFLICT (slug) DO NOTHING;

-- ─── ENABLE REALTIME ───
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'movements','personnel','brands','locations',
    'cat_insumos','cat_repuestos_arcades','cat_premios','cat_electronica',
    'cat_alimentos','cat_textiles','cat_souvenirs','cat_ti','cat_juegos','cat_publicidad'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
 
