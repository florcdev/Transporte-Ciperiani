-- Relaciona los viajes nuevos con un cliente y conserva viajes existentes sin cliente.
alter table public.viajes
  add column if not exists cliente_id bigint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'viajes_cliente_id_fkey'
      and conrelid = 'public.viajes'::regclass
  ) then
    alter table public.viajes
      add constraint viajes_cliente_id_fkey
      foreign key (cliente_id) references public.clientes(id)
      on delete set null;
  end if;
end;
$$;

notify pgrst, 'reload schema';
