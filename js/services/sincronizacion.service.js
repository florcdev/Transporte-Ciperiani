import { supabase } from '../lib/supabase.js';

const TABLAS_COMPARTIDAS = [
  'viajes',
  'camiones',
  'choferes',
  'clientes',
  'ordenes_retiro',
  'ordenes_pago_clientes',
  'recibos_efectivo',
  'resumenes_cuenta'
];

let canal = null;
let usuarioActivo = null;
let alActualizar = null;
let alFallar = null;
let temporizador = null;
let recargaEnCurso = false;
let recargaPendiente = false;

export function iniciarSincronizacion(userId, actualizar, informarError) {
  if (canal && usuarioActivo === userId) return;
  detenerSincronizacion();
  usuarioActivo = userId;
  alActualizar = actualizar;
  alFallar = informarError;

  canal = supabase.channel(`datos-compartidos-${userId}`);
  TABLAS_COMPARTIDAS.forEach(tabla => {
    canal = canal.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: tabla
    }, programarRecarga);
  });
  canal.subscribe((estado, error) => {
    if (estado === 'SUBSCRIBED') {
      programarRecarga();
    } else if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT') {
      alFallar?.(new Error(`No se pudo mantener la sincronización en tiempo real${error?.message ? `: ${error.message}` : '.'}`));
    }
  });
}

export function detenerSincronizacion() {
  clearTimeout(temporizador);
  temporizador = null;
  recargaPendiente = false;
  usuarioActivo = null;
  alActualizar = null;
  alFallar = null;
  if (canal) {
    const canalAnterior = canal;
    canal = null;
    supabase.removeChannel(canalAnterior).then(estado => {
      if (estado !== 'ok') console.error(`No se pudo cerrar el canal de sincronización: ${estado}.`);
    }, error => {
      console.error('No se pudo cerrar el canal de sincronización.', error);
    });
  }
}

function programarRecarga() {
  clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    void recargarDatos();
  }, 250);
}

async function recargarDatos() {
  if (recargaEnCurso) {
    recargaPendiente = true;
    return;
  }

  recargaEnCurso = true;
  let reintentar = false;
  try {
    do {
      recargaPendiente = false;
      await alActualizar?.();
    } while (recargaPendiente);
  } catch (error) {
    reintentar = recargaPendiente;
    recargaPendiente = false;
    alFallar?.(error);
  } finally {
    recargaEnCurso = false;
    if (reintentar) programarRecarga();
  }
}
