-- Habilita la edición y baja lógica de clientes y choferes desde la aplicación.
-- Las bajas usan activo=false para conservar las referencias históricas.
grant update on public.clientes to authenticated;
grant update on public.choferes to authenticated;
