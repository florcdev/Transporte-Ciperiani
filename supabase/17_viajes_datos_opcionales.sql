-- Permite crear viajes con los datos disponibles y completarlos más adelante.
alter table public.viajes
  alter column fecha drop not null,
  alter column origen drop not null,
  alter column destino drop not null,
  alter column camion_id drop not null,
  alter column chofer_id drop not null,
  alter column ctg drop not null,
  alter column toneladas drop not null,
  alter column tarifa drop not null,
  alter column comision_porcentaje drop not null,
  alter column ganancia_chofer_porcentaje drop not null,
  alter column adelanto drop not null;

notify pgrst, 'reload schema';
