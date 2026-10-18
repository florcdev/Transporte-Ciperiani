/** Valores de la columna viajes.estado y su texto para mostrar. */
export const ESTADOS = {
  EN_ESPERA: 'En espera',
  EN_PROCESO: 'En proceso',
  FINALIZADO: 'Finalizado'
};

/** Estado que se muestra en el chip. El pago aplica una vez finalizado el viaje. */
export function estadoVisual(viaje) {
  if (viaje.estado !== 'FINALIZADO') return 'proceso';
  return viaje.pagado ? 'pagado' : 'espera';
}

/**
 * Grupo para filtros y reportes: 'pagado' | 'proceso' | 'espera'.
 * Un viaje finalizado y todavía no pagado cuenta como "en espera".
 */
export function grupoEstado(viaje) {
  if (viaje.estado !== 'FINALIZADO') return 'proceso';
  return viaje.pagado ? 'pagado' : 'espera';
}