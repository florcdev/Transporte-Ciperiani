-- Ejecutar una sola vez en Supabase > SQL Editor.
-- Habilita actualizaciones en tiempo real sin modificar las políticas de acceso existentes.

create table if not exists public.resumenes_cuenta (
    id text primary key,
    usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    modo text not null check (modo in ('general', 'chofer', 'cliente')),
    nombre_cuenta text not null,
    desde date not null,
    hasta date not null check (hasta >= desde),
    creado timestamptz not null,
    movimientos jsonb not null default '[]'::jsonb,
    saldo_anterior numeric(14, 2) not null default 0
);

alter table public.resumenes_cuenta enable row level security;
revoke all on public.resumenes_cuenta from public, anon, authenticated;
grant select, insert on public.resumenes_cuenta to authenticated;

drop policy if exists "leer_resumenes_cuenta_propios" on public.resumenes_cuenta;
create policy "leer_resumenes_cuenta_propios"
    on public.resumenes_cuenta
    for select to authenticated
    using (
        usuario_id = (select auth.uid())
        and exists (
            select 1 from public.perfiles_acceso p
            where p.user_id = (select auth.uid()) and p.aprobado
        )
    );

drop policy if exists "crear_resumenes_cuenta_propios" on public.resumenes_cuenta;
create policy "crear_resumenes_cuenta_propios"
    on public.resumenes_cuenta
    for insert to authenticated
    with check (
        usuario_id = (select auth.uid())
        and exists (
            select 1 from public.perfiles_acceso p
            where p.user_id = (select auth.uid()) and p.aprobado
        )
    );

do $$
declare
    v_tabla text;
    v_tablas text[] := array[
        'viajes',
        'camiones',
        'choferes',
        'clientes',
        'ordenes_retiro',
        'ordenes_pago_clientes',
        'recibos_efectivo',
        'resumenes_cuenta'
    ];
begin
    if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        raise exception 'No existe la publicación supabase_realtime.';
    end if;

    foreach v_tabla in array v_tablas loop
        if to_regclass(format('public.%I', v_tabla)) is null then
            raise exception 'No existe la tabla public.%. Ejecutá primero las migraciones anteriores.', v_tabla;
        end if;
        if not exists (
            select 1
            from pg_publication_tables
            where pubname = 'supabase_realtime'
              and schemaname = 'public'
              and tablename = v_tabla
        ) then
            execute format('alter publication supabase_realtime add table public.%I', v_tabla);
        end if;
    end loop;
end;
$$;

notify pgrst, 'reload schema';
