import { supabase } from '../lib/supabase.js';

const aModelo = orden => ({
  id: orden.id,
  numero: orden.numero_orden,
  anio: Number(orden.anio),
  numeroAnual: Number(orden.numero_anual),
  clienteId: Number(orden.cliente_id),
  total: Number(orden.total),
  detalles: orden.detalles,
  creado: orden.created_at
});

export async function listarOrdenesPagoCliente() {
  const { data, error } = await supabase
    .from('ordenes_pago_clientes')
    .select('id, numero_orden, anio, numero_anual, cliente_id, total, detalles, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(aModelo);
}

export async function crearOrdenPagoCliente(clienteId, detalles) {
  const { data, error } = await supabase.rpc('crear_orden_pago_cliente', {
    p_cliente_id: clienteId,
    p_detalles: detalles
  });
  if (error) throw error;
  const resultado = typeof data === 'string' ? JSON.parse(data) : data;
  const orden = Array.isArray(resultado) ? resultado[0] : resultado;
  if (!orden?.id) throw new Error('La base de datos no devolvió la orden de pago generada.');
  return aModelo(orden);
}
