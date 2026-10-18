-- Ejecutar en Supabase > SQL Editor para agregar el teléfono opcional del chofer.
-- Conserva el control de acceso/RLS ya configurado en public.choferes.

alter table public.choferes
    add column if not exists telefono text;

notify pgrst, 'reload schema';
