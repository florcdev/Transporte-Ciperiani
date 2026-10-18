-- Ejecutar en Supabase > SQL Editor después de 03_choferes_y_retiros.sql.
-- Conserva el nombre de quien entrega el dinero como texto libre.

drop function if exists public.crear_orden_retiro(bigint, bigint, text, numeric, numeric, text);
drop function if exists public.crear_orden_retiro(bigint, text, text, numeric, numeric, text);

alter table public.ordenes_retiro
    add column if not exists recibido_de text;

do $$
begin
    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'ordenes_retiro'
          and column_name = 'recibido_de_chofer_id'
    ) then
        update public.ordenes_retiro orden
        set recibido_de = chofer.nombre
        from public.choferes chofer
        where orden.recibido_de is null
          and chofer.id = orden.recibido_de_chofer_id;

        alter table public.ordenes_retiro
            drop column recibido_de_chofer_id;
    end if;
end;
$$;

alter table public.ordenes_retiro
    alter column recibido_de set not null;

create function public.crear_orden_retiro(
    p_chofer_id bigint,
    p_recibido_de text,
    p_cuit_transportista text,
    p_importe_recibido numeric,
    p_total numeric,
    p_observacion text
)
returns setof public.ordenes_retiro
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_anio integer := extract(year from (now() at time zone 'America/Argentina/Buenos_Aires'))::integer;
    v_numero_anual bigint;
begin
    if not exists (
        select 1 from public.perfiles_acceso p
        where p.user_id = (select auth.uid()) and p.aprobado
    ) then
        raise exception 'La cuenta no está aprobada para generar órdenes de retiro.';
    end if;

    if p_chofer_id is null
       or nullif(trim(p_recibido_de), '') is null
       or nullif(trim(p_cuit_transportista), '') is null
       or p_importe_recibido is null or p_importe_recibido <= 0
       or p_total is null or p_total <= 0
       or nullif(trim(p_observacion), '') is null then
        raise exception 'Completá todos los datos de la orden e ingresá importes mayores a cero.';
    end if;

    insert into public.contadores_orden_retiro (anio, ultimo_numero)
    values (v_anio, 1)
    on conflict (anio) do update
    set ultimo_numero = contadores_orden_retiro.ultimo_numero + 1
    returning ultimo_numero into v_numero_anual;

    return query
    insert into public.ordenes_retiro (
        numero_orden, anio, numero_anual, chofer_id, recibido_de,
        cuit_transportista, importe_recibido, total, observacion
    )
    values (
        'R ' || (v_anio - 2025)::text || ' ' || v_numero_anual::text,
        v_anio, v_numero_anual, p_chofer_id, trim(p_recibido_de),
        trim(p_cuit_transportista), p_importe_recibido, p_total, trim(p_observacion)
    )
    returning *;
end;
$$;

revoke all on function public.crear_orden_retiro(bigint, text, text, numeric, numeric, text) from public, anon;
grant execute on function public.crear_orden_retiro(bigint, text, text, numeric, numeric, text) to authenticated;

notify pgrst, 'reload schema';
