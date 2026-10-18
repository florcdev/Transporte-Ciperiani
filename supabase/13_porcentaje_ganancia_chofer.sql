-- Agrega a cada viaje el porcentaje de ganancia del chofer.
-- Los viajes existentes conservan el comportamiento anterior del 15%.

alter table public.viajes
  add column if not exists ganancia_chofer_porcentaje numeric(5, 2) not null default 15;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'viajes_ganancia_chofer_porcentaje_rango'
      and conrelid = 'public.viajes'::regclass
  ) then
    alter table public.viajes
      add constraint viajes_ganancia_chofer_porcentaje_rango
      check (ganancia_chofer_porcentaje between 0 and 100);
  end if;
end;
$$;

notify pgrst, 'reload schema';
