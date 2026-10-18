import { supabase } from '../lib/supabase.js';

const aModelo = pago => ({
  id: pago.id,
  choferId: Number(pago.chofer_id),
  importe: Number(pago.importe),
  creado: pago.created_at
});

export async function listarPagosChofer() {
  const { data, error } = await supabase
    .from('pagos_choferes')
    .select('id, chofer_id, importe, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(aModelo);
}

export async function registrarPagoChofer(choferId, importe) {
  const { data, error } = await supabase.rpc('registrar_pago_chofer', {
    p_chofer_id: choferId,
    p_importe: importe
  });
  if (error) throw error;
  const pago = Array.isArray(data) ? data[0] : data;
  if (!pago?.id) throw new Error('La base de datos no devolvió el pago registrado.');
  return aModelo(pago);
}
