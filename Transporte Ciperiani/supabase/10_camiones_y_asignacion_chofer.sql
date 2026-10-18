alter table public.choferes
  add column if not exists camion_id bigint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'choferes_camion_id_fkey'
      and conrelid = 'public.choferes'::regclass
  ) then
    alter table public.choferes
      add constraint choferes_camion_id_fkey
      foreign key (camion_id) references public.camiones(id);
  end if;
end;
$$;

update public.choferes ch
set camion_id = coincidencia.camion_id
from (
  select ch.id as chofer_id, min(c.id) as camion_id
  from public.choferes ch
  join public.camiones c
    on regexp_replace(upper(trim(ch.patente)), '[^A-Z0-9]', '', 'g')
     = regexp_replace(upper(trim(c.patente)), '[^A-Z0-9]', '', 'g')
  group by ch.id
  having count(c.id) = 1
) coincidencia
where ch.id = coincidencia.chofer_id
  and ch.camion_id is null;

update public.viajes v
set camion_id = ch.camion_id
from public.choferes ch
where v.chofer_id = ch.id
  and v.camion_id is null
  and ch.camion_id is not null;

grant select, insert, update on public.camiones to authenticated;

do $$
declare
  v_secuencia text := pg_get_serial_sequence('public.camiones', 'id');
begin
  if v_secuencia is not null then
    execute format('grant usage, select on sequence %s to authenticated', v_secuencia);
  end if;
end;
$$;

notify pgrst, 'reload schema';
