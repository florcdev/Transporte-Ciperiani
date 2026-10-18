import { supabase } from '../lib/supabase.js';

const CLAVE_HISTORIAL_REPORTES = 'transporte-ciperiani:resumenes-cuenta';
const usuariosHistorialImportado = new Set();

function aModelo(reporte) {
  return {
    id: reporte.id,
    modo: reporte.modo,
    nombreCuenta: reporte.nombre_cuenta,
    desde: reporte.desde,
    hasta: reporte.hasta,
    creado: reporte.creado,
    movimientos: reporte.movimientos,
    saldoAnterior: Number(reporte.saldo_anterior)
  };
}

function validarReporte(reporte) {
  if (!reporte || typeof reporte.id !== 'string'
    || !['general', 'chofer', 'cliente'].includes(reporte.modo)
    || typeof reporte.nombreCuenta !== 'string'
    || typeof reporte.desde !== 'string' || typeof reporte.hasta !== 'string'
    || !Number.isFinite(Date.parse(reporte.creado))
    || !Array.isArray(reporte.movimientos)
    || !Number.isFinite(Number(reporte.saldoAnterior))) {
    throw new Error('El historial guardado tiene un formato inválido.');
  }
}

async function importarHistorialLocal(userId) {
  if (usuariosHistorialImportado.has(userId)) return;
  const clave = `${CLAVE_HISTORIAL_REPORTES}:${userId}`;
  const guardados = localStorage.getItem(clave);
  const reportes = guardados ? JSON.parse(guardados) : [];
  if (!Array.isArray(reportes)) throw new Error('El historial guardado tiene un formato inválido.');

  reportes.forEach(validarReporte);
  if (reportes.length) {
    const { error } = await supabase.from('resumenes_cuenta').upsert(
      reportes.map(reporte => ({
        id: reporte.id,
        usuario_id: userId,
        modo: reporte.modo,
        nombre_cuenta: reporte.nombreCuenta,
        desde: reporte.desde,
        hasta: reporte.hasta,
        creado: reporte.creado,
        movimientos: reporte.movimientos,
        saldo_anterior: reporte.saldoAnterior
      })),
      { onConflict: 'id', ignoreDuplicates: true }
    );
    if (error) throw error;
  }
  usuariosHistorialImportado.add(userId);
}

export async function listarResumenesCuenta() {
  const { data: { session }, error: sesionError } = await supabase.auth.getSession();
  if (sesionError) throw sesionError;
  const userId = session?.user?.id;
  if (!userId) throw new Error('No se pudo identificar la cuenta activa.');

  await importarHistorialLocal(userId);
  const { data, error } = await supabase
    .from('resumenes_cuenta')
    .select('id, modo, nombre_cuenta, desde, hasta, creado, movimientos, saldo_anterior')
    .order('creado', { ascending: false });
  if (error) throw error;
  return data.map(aModelo);
}

export async function crearResumenCuenta(reporte) {
  const { data: { session }, error: sesionError } = await supabase.auth.getSession();
  if (sesionError) throw sesionError;
  const userId = session?.user?.id;
  if (!userId) throw new Error('No se pudo identificar la cuenta activa.');

  const { data, error } = await supabase
    .from('resumenes_cuenta')
    .insert({
      id: reporte.id,
      usuario_id: userId,
      modo: reporte.modo,
      nombre_cuenta: reporte.nombreCuenta,
      desde: reporte.desde,
      hasta: reporte.hasta,
      creado: reporte.creado,
      movimientos: reporte.movimientos,
      saldo_anterior: reporte.saldoAnterior
    })
    .select('id, modo, nombre_cuenta, desde, hasta, creado, movimientos, saldo_anterior')
    .single();
  if (error) throw error;
  return aModelo(data);
}
