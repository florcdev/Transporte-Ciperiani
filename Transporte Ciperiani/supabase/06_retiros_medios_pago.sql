-- Ejecutar en Supabase > SQL Editor después de las migraciones anteriores, incluida la 05.
-- Agrega el desglose de medios de pago a las órdenes de retiro existentes.

alter table public.ordenes_retiro
    add column if not exists detalles_pago jsonb not null default '[]'::jsonb;

alter table public.ordenes_retiro
    drop constraint if exists ordenes_retiro_detalles_pago_array;

alter table public.ordenes_retiro
    add constraint ordenes_retiro_detalles_pago_array
    check (jsonb_typeof(detalles_pago) = 'array');

alter table public.ordenes_retiro enable row level security;
revoke all on public.ordenes_retiro from public, anon, authenticated;
grant select on public.ordenes_retiro to authenticated;
revoke all on public.contadores_orden_retiro from public, anon, authenticated;

drop policy if exists "solo_aprobados_ordenes_retiro" on public.ordenes_retiro;
create policy "solo_aprobados_ordenes_retiro"
    on public.ordenes_retiro
    for select to authenticated
    using (
        exists (
            select 1 from public.perfiles_acceso p
            where p.user_id = (select auth.uid()) and p.aprobado
        )
    );

drop function if exists public.crear_orden_retiro(bigint, bigint, text, numeric, numeric, text);
drop function if exists public.crear_orden_retiro(bigint, text, text, numeric, numeric, text);
drop function if exists public.crear_orden_retiro(bigint, text, text, jsonb, numeric, text);

create or replace function public.crear_orden_retiro(
    p_chofer_id bigint,
    p_recibido_de text,
    p_cuit_transportista text,
    p_detalles_pago jsonb,
    p_total numeric
)
returns setof public.ordenes_retiro
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_anio integer := extract(year from (now() at time zone 'America/Argentina/Buenos_Aires'))::integer;
    v_numero_anual bigint;
    v_importe_recibido numeric(14, 2) := 0;
    v_importe_detalle numeric(14, 2);
    v_observacion text;
    v_detalle jsonb;
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
       or p_total is null or p_total = 'NaN'::numeric
       or p_total <= 0 or p_total > 999999999999.99 then
        raise exception 'Completá todos los datos de la orden e ingresá importes mayores a cero.';
    end if;

    if p_detalles_pago is null or jsonb_typeof(p_detalles_pago) <> 'array' then
        raise exception 'Los medios de pago deben enviarse como una lista.';
    end if;

    if jsonb_array_length(p_detalles_pago) = 0 then
        raise exception 'Ingresá al menos un medio de pago.';
    end if;

    for v_detalle in select value from jsonb_array_elements(p_detalles_pago)
    loop
        if nullif(trim(coalesce(v_detalle ->> 'observacion', v_detalle ->> 'concepto')), '') is null
           or v_detalle ->> 'medio' is null
           or v_detalle ->> 'medio' not in ('Cheque', 'Transferencia', 'Efectivo')
           or nullif(v_detalle ->> 'fecha', '') is null
           or nullif(v_detalle ->> 'monto', '') is null
           or (v_detalle ->> 'medio' = 'Cheque'
               and nullif(trim(v_detalle ->> 'numeroCheque'), '') is null)
           or (v_detalle ->> 'medio' = 'Transferencia'
               and nullif(trim(v_detalle ->> 'banco'), '') is null) then
            raise exception 'Cada medio de pago debe tener observación, medio, fecha e importe; los cheques requieren número y las transferencias banco.';
        end if;

        begin
            v_importe_detalle := (v_detalle ->> 'monto')::numeric;
            perform (v_detalle ->> 'fecha')::date;
        exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
            raise exception 'La fecha o el importe de un medio de pago no es válido.';
        end;

        if v_importe_detalle = 'NaN'::numeric
           or v_importe_detalle <= 0
           or v_importe_detalle > 999999999999.99
           or v_importe_detalle <> round(v_importe_detalle, 2) then
            raise exception 'El importe de cada medio de pago debe ser positivo, tener hasta dos decimales y no superar $999.999.999.999,99.';
        end if;

        v_importe_recibido := v_importe_recibido + v_importe_detalle;
    end loop;
    v_importe_recibido := round(v_importe_recibido, 2);
    if p_total <> v_importe_recibido then
        raise exception 'El total debe coincidir con la suma de los medios de pago.';
    end if;

    select string_agg(trim(coalesce(value ->> 'observacion', value ->> 'concepto')), '; ')
    into v_observacion
    from jsonb_array_elements(p_detalles_pago);

    insert into public.contadores_orden_retiro (anio, ultimo_numero)
    values (v_anio, 1)
    on conflict (anio) do update
    set ultimo_numero = contadores_orden_retiro.ultimo_numero + 1
    returning ultimo_numero into v_numero_anual;

    return query
    insert into public.ordenes_retiro (
        numero_orden, anio, numero_anual, chofer_id, recibido_de,
        cuit_transportista, importe_recibido, detalles_pago, total, observacion
    )
    values (
        'R ' || (v_anio - 2025)::text || ' ' || v_numero_anual::text,
        v_anio, v_numero_anual, p_chofer_id, trim(p_recibido_de),
        trim(p_cuit_transportista), v_importe_recibido, p_detalles_pago, p_total, v_observacion
    )
    returning *;
end;
$$;

revoke all on function public.crear_orden_retiro(bigint, text, text, jsonb, numeric) from public, anon, authenticated;
grant execute on function public.crear_orden_retiro(bigint, text, text, jsonb, numeric) to authenticated;

notify pgrst, 'reload schema';
