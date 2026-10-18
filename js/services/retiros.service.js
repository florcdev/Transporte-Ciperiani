import { supabase } from '../lib/supabase.js';

const SELECT = '*, chofer:choferes!ordenes_retiro_chofer_id_fkey(id, nombre)';

const aModelo = orden => ({
  id: orden.id,
  numero: `R ${Number(orden.anio) - 2025} ${Number(orden.numero_anual)}`,
  anio: Number(orden.anio),
  numeroAnual: Number(orden.numero_anual),
  choferId: Number(orden.chofer_id),
  recibidoDe: orden.recibido_de,
  chofer: orden.chofer,
  cuitTransportista: orden.cuit_transportista,
  importeRecibido: Number(orden.importe_recibido),
  detallesPago: Array.isArray(orden.detalles_pago) ? orden.detalles_pago : [],
  total: Number(orden.total),
  creado: orden.created_at
});

export async function listarOrdenesRetiro() {
  const { data, error } = await supabase.from('ordenes_retiro').select(SELECT).order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(aModelo);
}

export async function crearOrdenRetiro(datos) {
  const { data, error } = await supabase.rpc('crear_orden_retiro', {
    p_chofer_id: datos.choferId,
    p_recibido_de: datos.recibidoDe,
    p_cuit_transportista: datos.cuitTransportista,
    p_detalles_pago: datos.detallesPago,
    p_total: datos.total
  });
  if (error) throw error;
  const resultado = typeof data === 'string' ? JSON.parse(data) : data;
  const orden = Array.isArray(resultado) ? resultado[0] : resultado;
  if (!orden?.id) throw new Error('La base de datos no devolvió la orden generada.');
  return aModelo(orden);
}
