-- ============================================================
-- SCRIPT DE OPTIMIZACIÓN: ÍNDICES DE BASE DE DATOS
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Índices para la tabla principal de Movimientos
-- Mejora la velocidad al filtrar por fecha, categoría y obtener el historial de un item
CREATE INDEX IF NOT EXISTS idx_movements_timestamp ON public.movements (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_movements_category ON public.movements (category);
CREATE INDEX IF NOT EXISTS idx_movements_item ON public.movements (item);
CREATE INDEX IF NOT EXISTS idx_movements_action ON public.movements (action);

-- 2. Índices para Tablas de Categorías (Inventario)
-- Mejora la velocidad de carga inicial y búsquedas por nombre

DO $$ 
DECLARE
  t text;
BEGIN
  -- Iterar sobre cada tabla de categoría para crear los índices estándar
  FOREACH t IN ARRAY ARRAY[
    'cat_insumos','cat_repuestos_arcades','cat_premios','cat_electronica',
    'cat_alimentos','cat_textiles','cat_souvenirs','cat_ti','cat_juegos','cat_publicidad'
  ] LOOP
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_name ON public.%I (name)', t, t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_status ON public.%I (status)', t, t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_location ON public.%I (location)', t, t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_updated_at ON public.%I (updated_at DESC)', t, t);
  END LOOP;
END $$;

-- 3. Índices para tablas de soporte (rápida resolución en selects)
CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories (slug);
CREATE INDEX IF NOT EXISTS idx_personnel_name ON public.personnel (name);
CREATE INDEX IF NOT EXISTS idx_brands_name ON public.brands (name);
CREATE INDEX IF NOT EXISTS idx_locations_name ON public.locations (name);
