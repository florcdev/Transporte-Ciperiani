-- Ejecutar después de 06_retiros_medios_pago.sql.
-- Limita las observaciones de las órdenes a sueldo, adelantos o gastos extra del chofer.

create or replace function public.validar_concepto_orden_retiro()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_detalle jsonb;
  v_observacion text;
  v_descripcion text;
begin
  if new.detalles_pago is null or jsonb_typeof(new.detalles_pago) <> 'array' then
    raise exception 'Los detalles de la orden deben ser una lista.';
  end if;

  for v_detalle in select value from jsonb_array_elements(new.detalles_pago)
  loop
    v_observacion := trim(coalesce(v_detalle ->> 'observacion', ''));

    if v_observacion in ('Sueldo', 'Adelanto') then
      continue;
    end if;

    if left(v_observacion, length('Gasto Extra: ')) <> 'Gasto Extra: ' then
      raise exception 'El concepto debe ser Sueldo, Adelanto o un Gasto extra del chofer.';
    end if;

    v_descripcion := trim(substr(v_observacion, length('Gasto Extra: ') + 1));
    if v_descripcion = '' or not exists (
      select 1
      from public.viajes v
      cross join lateral jsonb_array_elements(v.gastos_extra) gasto
      where v.chofer_id = new.chofer_id
        and gasto.value ->> 'destino' = 'chofer'
        and trim(gasto.value ->> 'descripcion') = v_descripcion
    ) then
      raise exception 'El gasto extra seleccionado no existe en un viaje de este chofer.';
    end if;
  end loop;

  return new;
end;
$$;

revoke all on function public.validar_concepto_orden_retiro() from public, anon, authenticated;
drop trigger if exists trg_validar_concepto_orden_retiro on public.ordenes_retiro;
create trigger trg_validar_concepto_orden_retiro
  before insert or update of detalles_pago, chofer_id on public.ordenes_retiro
  for each row execute function public.validar_concepto_orden_retiro();
