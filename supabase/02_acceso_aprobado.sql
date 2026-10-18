-- Ejecutar una sola vez en Supabase > SQL Editor.
-- Las cuentas nuevas se crean pendientes y no pueden consultar datos
-- hasta que un administrador las apruebe.

create table if not exists public.perfiles_acceso (
    user_id uuid primary key references auth.users(id) on delete cascade,
    aprobado boolean not null default false,
    created_at timestamptz not null default now()
);

alter table public.perfiles_acceso enable row level security;
revoke all on public.perfiles_acceso from anon, authenticated;
grant select on public.perfiles_acceso to authenticated;

drop policy if exists "perfil_propio" on public.perfiles_acceso;
create policy "perfil_propio"
    on public.perfiles_acceso
    for select to authenticated
    using (user_id = (select auth.uid()));

create or replace function public.crear_perfil_acceso_pendiente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.perfiles_acceso (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
    return new;
end;
$$;

revoke all on function public.crear_perfil_acceso_pendiente() from public;

drop trigger if exists trg_auth_crear_perfil_acceso on auth.users;
create trigger trg_auth_crear_perfil_acceso
    after insert on auth.users
    for each row execute function public.crear_perfil_acceso_pendiente();

insert into public.perfiles_acceso (user_id)
select id from auth.users
on conflict (user_id) do nothing;

drop policy if exists "autenticados_camiones" on public.camiones;
drop policy if exists "autenticados_choferes" on public.choferes;
drop policy if exists "autenticados_viajes" on public.viajes;
drop policy if exists "solo_aprobados_camiones" on public.camiones;
drop policy if exists "solo_aprobados_choferes" on public.choferes;
drop policy if exists "solo_aprobados_viajes" on public.viajes;

create policy "solo_aprobados_camiones"
    on public.camiones
    for all to authenticated
    using (
        exists (
            select 1 from public.perfiles_acceso p
            where p.user_id = (select auth.uid()) and p.aprobado
        )
    )
    with check (
        exists (
            select 1 from public.perfiles_acceso p
            where p.user_id = (select auth.uid()) and p.aprobado
        )
    );

create policy "solo_aprobados_choferes"
    on public.choferes
    for all to authenticated
    using (
        exists (
            select 1 from public.perfiles_acceso p
            where p.user_id = (select auth.uid()) and p.aprobado
        )
    )
    with check (
        exists (
            select 1 from public.perfiles_acceso p
            where p.user_id = (select auth.uid()) and p.aprobado
        )
    );

create policy "solo_aprobados_viajes"
    on public.viajes
    for all to authenticated
    using (
        exists (
            select 1 from public.perfiles_acceso p
            where p.user_id = (select auth.uid()) and p.aprobado
        )
    )
    with check (
        exists (
            select 1 from public.perfiles_acceso p
            where p.user_id = (select auth.uid()) and p.aprobado
        )
    );

-- Aprobar una cuenta desde el SQL Editor:
-- update public.perfiles_acceso p
-- set aprobado = true
-- from auth.users u
-- where u.id = p.user_id
--   and lower(u.email) = lower('correo@ejemplo.com');
