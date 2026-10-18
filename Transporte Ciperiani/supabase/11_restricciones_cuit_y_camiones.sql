-- Ejecutar después de 10_camiones_y_asignacion_chofer.sql.
-- Rechaza CUIT vacíos, inválidos o duplicados y evita asignar un camión a más de un chofer.

create or replace function public.normalizar_cuit(p_cuit text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select regexp_replace(trim(p_cuit), '[[:space:].-]', '', 'g');
$$;

create or replace function public.cuit_es_valido(p_cuit text)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  v_cuit text := public.normalizar_cuit(p_cuit);
  v_pesos integer[] := array[5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  v_suma integer := 0;
  v_resto integer;
  v_verificador integer;
  i integer;
begin
  if v_cuit !~ '^[0-9]{11}$'
    or substring(v_cuit from 1 for 2) not in ('20', '23', '24', '27', '30', '33', '34') then
    return false;
  end if;

  for i in 1..10 loop
    v_suma := v_suma + substring(v_cuit from i for 1)::integer * v_pesos[i];
  end loop;

  v_resto := v_suma % 11;
  v_verificador := case
    when v_resto = 0 then 0
    when v_resto = 1 then 9
    else 11 - v_resto
  end;

  return substring(v_cuit from 11 for 1)::integer = v_verificador;
end;
$$;

do $$
begin
  if exists (
    select 1 from public.choferes
    where cuit is null or not public.cuit_es_valido(cuit)
  ) or exists (
    select 1 from public.clientes
    where cuit is null or not public.cuit_es_valido(cuit)
  ) then
    raise exception 'Hay clientes o choferes con CUIT vacío o inválido. Corregilos antes de ejecutar esta migración.';
  end if;

  if exists (
    select public.normalizar_cuit(cuit)
    from (
      select cuit from public.choferes
      union all
      select cuit from public.clientes
    ) registros
    group by public.normalizar_cuit(cuit)
    having count(*) > 1
  ) then
    raise exception 'Hay CUIT repetidos entre clientes y choferes. Resolvé los duplicados antes de ejecutar esta migración.';
  end if;

end;
$$;

update public.choferes
set cuit = public.normalizar_cuit(cuit)
where cuit <> public.normalizar_cuit(cuit);

update public.clientes
set cuit = public.normalizar_cuit(cuit)
where cuit <> public.normalizar_cuit(cuit);

update public.choferes
set camion_id = null
where activo is false and camion_id is not null;

do $$
begin
  if exists (
    select camion_id
    from public.choferes
    where camion_id is not null
    group by camion_id
    having count(*) > 1
  ) then
    raise exception 'Hay camiones asignados a más de un chofer. Resolvé las asignaciones duplicadas antes de ejecutar esta migración.';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'choferes_cuit_valido_check'
      and conrelid = 'public.choferes'::regclass
  ) then
    alter table public.choferes
      add constraint choferes_cuit_valido_check
      check (cuit is not null and public.cuit_es_valido(cuit));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'clientes_cuit_valido_check'
      and conrelid = 'public.clientes'::regclass
  ) then
    alter table public.clientes
      add constraint clientes_cuit_valido_check
      check (cuit is not null and public.cuit_es_valido(cuit));
  end if;
end;
$$;

drop index if exists public.choferes_camion_activo_unico;
create unique index if not exists choferes_camion_id_unico
  on public.choferes (camion_id)
  where camion_id is not null;

create or replace function public.verificar_cuit_unico()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cuit text;
begin
  if new.cuit is null then
    raise exception 'El CUIT es obligatorio.'
      using errcode = '23514';
  end if;

  v_cuit := public.normalizar_cuit(new.cuit);
  if not public.cuit_es_valido(v_cuit) then
    raise exception 'El CUIT debe ser válido y tener 11 dígitos.'
      using errcode = '23514';
  end if;

  new.cuit := v_cuit;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_cuit, 0));

  if tg_table_name = 'clientes' then
    if exists (
      select 1 from public.clientes c
      where public.normalizar_cuit(c.cuit) = v_cuit
        and c.id is distinct from new.id
    ) or exists (
      select 1 from public.choferes ch
      where public.normalizar_cuit(ch.cuit) = v_cuit
    ) then
      raise exception 'Ya existe un cliente o chofer con ese CUIT.'
        using errcode = '23505';
    end if;
  else
    if exists (
      select 1 from public.choferes ch
      where public.normalizar_cuit(ch.cuit) = v_cuit
        and ch.id is distinct from new.id
    ) or exists (
      select 1 from public.clientes c
      where public.normalizar_cuit(c.cuit) = v_cuit
    ) then
      raise exception 'Ya existe un cliente o chofer con ese CUIT.'
        using errcode = '23505';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.verificar_cuit_unico() from public, anon, authenticated;
drop trigger if exists trg_verificar_cuit_unico on public.clientes;
create trigger trg_verificar_cuit_unico
  before insert or update of cuit on public.clientes
  for each row execute function public.verificar_cuit_unico();

drop trigger if exists trg_verificar_cuit_unico on public.choferes;
create trigger trg_verificar_cuit_unico
  before insert or update of cuit on public.choferes
  for each row execute function public.verificar_cuit_unico();

notify pgrst, 'reload schema';
