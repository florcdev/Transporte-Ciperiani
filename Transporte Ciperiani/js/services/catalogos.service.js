import { supabase } from '../lib/supabase.js';

async function listar(tabla, columnas, orden, soloActivos = false) {
  let consulta = supabase.from(tabla).select(columnas);
  if (soloActivos) consulta = consulta.eq('activo', true);
  const { data, error } = await consulta.order(orden);
  if (error) throw error;
  return data.map(registro => ({ ...registro, activo: registro.activo !== false }));
}

export const listarCamiones = () => listar('camiones', 'id, patente, marca, modelo, activo', 'patente');
export async function listarChoferes() {
  const { data, error } = await supabase
    .from('choferes')
    .select('id, nombre, cuit, telefono, patente, camion_id, activo, camion:camiones(id, patente, marca, modelo)')
    .order('nombre');
  if (error) throw error;
  return data.map(chofer => ({
    ...chofer,
    activo: chofer.activo !== false,
    camionId: chofer.camion_id ?? chofer.camion?.id ?? null,
    camion: chofer.camion || null,
    patente: chofer.camion?.patente || chofer.patente || ''
  }));
}
export const listarClientes = () => listar('clientes', 'id, nombre, cuit, activo', 'nombre');

export async function crearCamion(camion) {
  const { data, error } = await supabase
    .from('camiones')
    .insert({ patente: camion.patente, marca: camion.marca || null, modelo: camion.modelo || null, activo: true })
    .select('id, patente, marca, modelo, activo')
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarCamion(id, camion) {
  const { data, error } = await supabase
    .from('camiones')
    .update({ patente: camion.patente, marca: camion.marca || null, modelo: camion.modelo || null })
    .eq('id', id)
    .select('id, patente, marca, modelo, activo')
    .single();
  if (error) throw error;
  return data;
}

export async function darDeBajaCamion(id) {
  const { data, error } = await supabase
    .from('camiones')
    .update({ activo: false })
    .eq('id', id)
    .select('id, patente, marca, modelo, activo')
    .single();
  if (error) throw error;
  return data;
}

export async function crearChofer(chofer) {
  const { data, error } = await supabase
    .from('choferes')
    .insert({ nombre: chofer.nombre, cuit: chofer.cuit, telefono: chofer.telefono || null, patente: chofer.camion.patente, camion_id: chofer.camionId, activo: true })
    .select('id, nombre, cuit, telefono, patente, camion_id, activo, camion:camiones(id, patente, marca, modelo)')
    .single();
  if (error) throw error;
  return { ...data, camionId: data.camion_id ?? data.camion?.id ?? null, patente: data.camion?.patente || data.patente };
}

export async function crearCliente(cliente) {
  const { data, error } = await supabase
    .from('clientes')
    .insert({ nombre: cliente.nombre, cuit: cliente.cuit, activo: true })
    .select('id, nombre, cuit, activo')
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarChofer(id, chofer) {
  const { data, error } = await supabase
    .from('choferes')
    .update({ nombre: chofer.nombre, cuit: chofer.cuit, telefono: chofer.telefono || null, patente: chofer.camion.patente, camion_id: chofer.camionId })
    .eq('id', id)
    .select('id, nombre, cuit, telefono, patente, camion_id, activo, camion:camiones(id, patente, marca, modelo)')
    .single();
  if (error) throw error;
  return { ...data, camionId: data.camion_id ?? data.camion?.id ?? null, patente: data.camion?.patente || data.patente };
}

export async function actualizarCliente(id, cliente) {
  const { data, error } = await supabase
    .from('clientes')
    .update({ nombre: cliente.nombre, cuit: cliente.cuit })
    .eq('id', id)
    .select('id, nombre, cuit, activo')
    .single();
  if (error) throw error;
  return data;
}

export async function darDeBajaChofer(id) {
  const { data, error } = await supabase
    .from('choferes')
    .update({ activo: false, camion_id: null })
    .eq('id', id)
    .select('id, nombre, cuit, telefono, patente, camion_id, activo, camion:camiones(id, patente, marca, modelo)')
    .single();
  if (error) throw error;
  return { ...data, camionId: data.camion_id ?? null, camion: data.camion || null };
}

export async function darDeBajaCliente(id) {
  const { data, error } = await supabase
    .from('clientes')
    .update({ activo: false })
    .eq('id', id)
    .select('id, nombre, cuit, activo')
    .single();
  if (error) throw error;
  return data;
}