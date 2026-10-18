-- Genera códigos de viaje con el formato V <año relativo a 2025> <número anual>.
-- Los códigos existentes no se modifican.

create table if not exists public.contadores_viaje (
  anio integer primary key,
  ultimo_numero bigint not null check (ultimo_numero > 0)
);

revoke all on public.contadores_viaje from public, anon, authenticated;

insert into public.contadores_viaje (anio, ultimo_numero)
select
  2025 + split_part(codigo, ' ', 2)::integer,
  max(split_part(codigo, ' ', 3)::bigint)
from public.viajes
where codigo ~ '^V [0-9]+ [0-9]+$'
group by split_part(codigo, ' ', 2)::integer
on conflict (anio) do update
set ultimo_numero = greatest(
  public.contadores_viaje.ultimo_numero,
  excluded.ultimo_numero
);

create or replace function public.generar_codigo_viaje_anual()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anio integer := extract(
    year from (pg_catalog.clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')
  )::integer;
  v_anio_relativo integer := v_anio - 2025;
  v_numero_anual bigint;
begin
  if v_anio_relativo < 1 then
    raise exception 'No se puede generar un código de viaje anterior a 2026.';
  end if;

  insert into public.contadores_viaje (anio, ultimo_numero)
  values (v_anio, 1)
  on conflict (anio) do update
  set ultimo_numero = public.contadores_viaje.ultimo_numero + 1
  returning ultimo_numero into v_numero_anual;

  new.codigo := 'V ' || v_anio_relativo::text || ' ' || v_numero_anual::text;
  return new;
end;
$$;

revoke all on function public.generar_codigo_viaje_anual() from public, anon, authenticated;

drop trigger if exists zz_generar_codigo_viaje_anual on public.viajes;
create trigger zz_generar_codigo_viaje_anual
  before insert on public.viajes
  for each row
  execute function public.generar_codigo_viaje_anual();
