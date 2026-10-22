import { state, guardarViaje } from '../state.js';
import { marcarPagado } from '../services/viajes.service.js';
import { calcular } from '../domain/liquidacion.js';
import { mostrarError } from './componentes.js';
import { dinero, importe, numero, fecha, fechaHora, esc } from '../lib/format.js';

const $ = id => document.getElementById(id);
let actual = null;

export function iniciarDetalle({ onEditar }) {
  $('btnEditTrip').addEventListener('click', () => actual && onEditar(actual));

  $('btnTogglePaid').addEventListener('click', async () => {
    if (!actual) return;
    const boton = $('btnTogglePaid');
    boton.disabled = true;
    try {
      const actualizado = await marcarPagado(actual.id, !actual.pagado);
      guardarViaje(actualizado);
      renderDetalle(actualizado.codigo);
    } catch (error) {
      mostrarError(error);
    } finally {
      boton.disabled = false;
    }
  });
}

/** Devuelve el viaje mostrado, o null si el código no existe. */
export function renderDetalle(codigo) {
  const v = state.viajes.find(x => x.codigo === codigo);
  if (!v) return null;

  actual = v;
  const c = calcular(v);

  const clasesEstado = {
    EN_ESPERA: 'wait',
    EN_PROCESO: 'warn',
    FINALIZADO: 'ok'
  };
  $('detailStatus').innerHTML = `<span class="chip ${clasesEstado[v.estado] || 'wait'} trip-detail-status">${esc({
    EN_ESPERA: 'En espera',
    EN_PROCESO: 'En proceso',
    FINALIZADO: 'Finalizado'
  }[v.estado] || v.estado)}</span>`;
  $('detailLoaded').textContent = v.pagado && v.fechaPago ? `Pagado el ${fechaHora(v.fechaPago)}` : '';

  const valores = {
    'd-fecha': fecha(v.fecha),
    'd-origen': v.origen || '—',
    'd-destino': v.destino || '—',
    'd-cliente': v.cliente?.nombre || state.clientes.find(cliente => Number(cliente.id) === Number(v.clienteId))?.nombre || '—',
    'd-modelo': [v.camion?.marca, v.camion?.modelo].filter(Boolean).join(' ') || '—',
    'd-patente': v.camion?.patente || '—',
    'd-chofer': v.chofer?.nombre || '—',
    'd-ctg': v.ctg || '—',
    'd-tn': v.toneladas == null ? '—' : numero(v.toneladas),
    'q-tarifa': v.tarifa == null ? '—' : importe(v.tarifa),
    'q-com': importe(c.comision),
    'q-sub': importe(c.subtotal),
    'q-driver': importe(c.chofer),
    'q-ade': importe(c.adelanto)
  };
  Object.entries(valores).forEach(([id, valor]) => { $(id).value = valor; });

  $('q-com-label').textContent = `Comisión del transporte (${v.comisionPct == null ? '—' : numero(v.comisionPct)}%)`;
  $('q-driver-label').textContent = `Parte del chofer (${numero(v.gananciaChoferPct ?? 15)}%)`;
  $('q-trip-total').textContent = dinero(c.totalViaje);
  $('q-total').textContent = dinero(c.saldoChofer);
  $('q-extra-client').value = importe(c.gastosCliente);
  $('q-extra-driver').value = importe(c.gastosChofer);
  $('detailExtraExpenses').innerHTML = v.gastosExtra?.length
    ? v.gastosExtra.map(gasto => {
      const cliente = gasto.destino === 'cliente'
        ? state.clientes.find(item => item.id === Number(gasto.clienteId))?.nombre
        : null;
      const responsable = gasto.destino === 'chofer' ? 'Chofer' : `Cliente${cliente ? ` · ${esc(cliente)}` : ''}`;
      return `<li><span>${esc(gasto.descripcion)} · ${responsable}</span><strong>${dinero(gasto.monto)}</strong></li>`;
    }).join('')
    : '<li>Sin gastos extra.</li>';

  const boton = $('btnTogglePaid');
  const viajeFinalizado = v.estado === 'FINALIZADO';
  boton.disabled = !viajeFinalizado;
  boton.title = viajeFinalizado ? '' : 'El viaje debe estar finalizado para registrar el pago.';
  boton.querySelector('span').textContent = !viajeFinalizado
    ? v.pagado ? 'Pagado' : 'Sin pagar'
    : v.pagado ? 'Quitar marca de pagado' : 'Marcar como pagado';
  boton.querySelector('use').setAttribute('href', v.pagado || viajeFinalizado ? '#i-check' : '#i-clock');
  boton.classList.toggle('trip-payment-paid', v.pagado);
  boton.classList.toggle('trip-payment-unpaid', !v.pagado);

  return v;
}