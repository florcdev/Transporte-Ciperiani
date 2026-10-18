import { supabase } from '../lib/supabase.js';

const aModelo = recibo => ({
  id: recibo.id,
  numero: `E ${Number(recibo.anio) - 2025} ${Number(recibo.numero_anual)}`,
  anio: Number(recibo.anio),
  numeroAnual: Number(recibo.numero_anual),
  clienteId: Number(recibo.cliente_id),
  para: recibo.para,
  metodoPago: recibo.metodo_pago,
  numeroCheque: recibo.numero_cheque,
  importe: Number(recibo.importe),
  creado: recibo.created_at
});

export async function listarRecibosEfectivo() {
  const { data, error } = await supabase
    .from('recibos_efectivo')
    .select('id, anio, numero_anual, cliente_id, para, metodo_pago, numero_cheque, importe, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(aModelo);
}

export async function crearReciboEfectivo(datos) {
  const { data, error } = await supabase.rpc('crear_recibo_efectivo', {
    p_cliente_id: datos.clienteId,
    p_para: datos.para,
    p_metodo_pago: datos.metodoPago,
    p_numero_cheque: datos.numeroCheque,
    p_importe: datos.importe
  });
  if (error) throw error;
  const resultado = typeof data === 'string' ? JSON.parse(data) : data;
  const recibo = Array.isArray(resultado) ? resultado[0] : resultado;
  if (!recibo?.id) throw new Error('La base de datos no devolvió el recibo de efectivo generado.');
  return aModelo(recibo);
}
