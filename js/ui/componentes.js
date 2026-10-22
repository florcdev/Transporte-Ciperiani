import { calcular } from '../domain/liquidacion.js';
import { ESTADOS, estadoVisual } from '../domain/estados.js';
import { dinero, numero, fecha, esc } from '../lib/format.js';

const CHIPS = {
  pagado: ['ok', 'Pagado'],
  proceso: ['warn', 'En proceso'],
  espera: ['wait', 'En espera'],
  finalizado: ['warn', 'Finalizado']
};

/** Chip de estado. Los viajes pagados llevan el tilde. */
export function chipEstado(viaje) {
  const [claseEstado, texto] = CHIPS[estadoVisual(viaje)];
  const clase = viaje.estado === ESTADOS.FINALIZADO ? 'ok' : claseEstado;
  const tilde = viaje.pagado ? '<svg class="ic chip-tick" aria-hidden="true"><use href="#i-check"/></svg>' : '';
  return `<span class="chip ${clase}${viaje.pagado ? ' has-tick' : ''}">${tilde}${texto}</span>`;
}

/** Fila de la tabla de viajes. */
export function filaViaje(v) {
  const c = calcular(v);
  const localidadBreve = localidad => String(localidad || '').split(',')[0].trim();
  return `<tr data-go="viaje" data-codigo="${esc(v.codigo)}">
    <td class="c-estado" data-label="Estado">${chipEstado(v)}</td>
    <td class="c-id" data-label="Viaje"><a class="link-id" href="#viaje/${encodeURIComponent(v.codigo)}">${esc(v.codigo)}</a></td>
    <td class="c-fecha" data-label="Fecha">${fecha(v.fecha)}</td>
    <td class="c-origen" data-label="Origen" title="${esc(v.origen)}">${esc(localidadBreve(v.origen) || '—')}</td>
    <td class="c-destino" data-label="Destino" title="${esc(v.destino)}">${esc(localidadBreve(v.destino) || '—')}</td>
    <td class="c-cliente" data-label="Cliente">${esc(v.cliente?.nombre || '—')}</td>
    <td class="c-ctg" data-label="ctg">${esc(v.ctg) || '—'}</td>
    <td class="c-tn num" data-label="Toneladas">${v.toneladas == null ? '—' : numero(v.toneladas)}</td>
    <td class="c-tarifa num" data-label="Tarifa">${v.tarifa == null ? '—' : dinero(v.tarifa)}</td>
    <td class="c-com num" data-label="Comisión">${dinero(c.comision)}</td>
    <td class="c-ade num" data-label="Adelanto">${dinero(c.adelanto)}</td>
    <td class="c-extra num" data-label="Gastos chofer">${dinero(c.gastosChofer)}</td>
    <td class="c-sub num" data-label="Subtotal">${dinero(c.subtotal)}</td>
    <td class="c-total num" data-label="Total del viaje">${dinero(c.totalViaje)}</td>
  </tr>`;
}

let temporizador;

export function mostrarError(error) {
  const caja = document.getElementById('appError');
  caja.textContent = typeof error === 'string' ? error : (error?.message ?? 'Ocurrió un error inesperado.');
  caja.hidden = false;
  clearTimeout(temporizador);
  temporizador = setTimeout(ocultarError, 8000);
}

export function ocultarError() {
  document.getElementById('appError').hidden = true;
}