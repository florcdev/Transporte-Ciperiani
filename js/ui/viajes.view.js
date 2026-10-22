import { state } from '../state.js';
import { grupoEstado } from '../domain/estados.js';
import { filaViaje } from './componentes.js';
import { esc, hoyISO, numero } from '../lib/format.js';

const $ = id => document.getElementById(id);
let filtro = 'todos';
let pagina = 1;
let animacionFilas;
let animacionPaginacion;
const VIAJES_POR_PAGINA = 4;

export function iniciarViajes({ onNuevo }) {
  $('btnNewTrip').addEventListener('click', onNuevo);
  $('tripSearch').addEventListener('input', () => {
    pagina = 1;
    renderViajes();
  });
  $('tripClientFilter').addEventListener('change', () => {
    pagina = 1;
    renderViajes();
  });

  const botones = document.querySelectorAll('[data-trip-filter]');
  botones.forEach(boton => boton.addEventListener('click', () => {
    filtro = boton.dataset.tripFilter;
    pagina = 1;
    botones.forEach(b => b.setAttribute('aria-pressed', String(b === boton)));
    renderViajes();
  }));

  $('tripPagination').addEventListener('click', e => {
    const boton = e.target.closest('[data-trip-page]');
    if (!boton || boton.disabled) return;
    pagina = Number(boton.dataset.tripPage);
    renderViajes();
  });
}

const textoBusqueda = v =>
  [v.codigo, v.origen, v.destino, v.cliente?.nombre, v.ctg, v.camion?.patente, v.chofer?.nombre,
    ...(v.gastosExtra || []).map(gasto => gasto.descripcion)].join(' ').toLowerCase();

export function renderViajes() {
  const selectorCliente = $('tripClientFilter');
  const clienteSeleccionado = selectorCliente.value;
  selectorCliente.innerHTML = '<option value="">Todos los clientes</option>'
    + state.clientes.filter(cliente => cliente.activo !== false)
      .map(cliente => `<option value="${cliente.id}">${esc(cliente.nombre)}</option>`).join('');
  selectorCliente.value = clienteSeleccionado;

  const q = $('tripSearch').value.trim().toLowerCase();
  const clienteId = Number(selectorCliente.value) || null;
  const lista = state.viajes.filter(v =>
    (filtro === 'todos' || grupoEstado(v) === filtro)
    && (!clienteId || Number(v.clienteId) === clienteId || (v.gastosExtra || []).some(gasto =>
      gasto.destino === 'cliente' && Number(gasto.clienteId) === clienteId))
    && (!q || textoBusqueda(v).includes(q)))
    .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || b.id - a.id);
  actualizarTarjetas();

  const totalPaginas = Math.ceil(lista.length / VIAJES_POR_PAGINA);
  pagina = Math.min(Math.max(pagina, 1), Math.max(totalPaginas, 1));
  const inicio = (pagina - 1) * VIAJES_POR_PAGINA;
  const viajesPagina = lista.slice(inicio, inicio + VIAJES_POR_PAGINA);

  const contenidoFilas = viajesPagina.length
    ? viajesPagina.map(filaViaje).join('')
    : '<tr class="vacio"><td colspan="14" class="empty-cell">No hay viajes que coincidan con la búsqueda.</td></tr>';
  actualizarFilas(document.querySelector('[data-rows="all"]'), contenidoFilas);

  $('tripCount').textContent = '';
  renderPaginacion(totalPaginas);
}

function actualizarFilas(tbody, contenido) {
  animacionFilas?.cancel();

  if (!tbody.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    tbody.innerHTML = contenido;
    return;
  }

  tbody.innerHTML = contenido;
  animacionFilas = tbody.animate([
    { opacity: 0.65, transform: 'translateY(4px)' },
    { opacity: 1, transform: 'translateY(0)' }
  ], {
    duration: 180,
    easing: 'ease-out'
  });
}

function renderPaginacion(totalPaginas) {
  const navegacion = $('tripPagination');
  animacionPaginacion?.cancel();
  navegacion.hidden = totalPaginas <= 1;
  if (navegacion.hidden) {
    navegacion.innerHTML = '';
    return;
  }

  const paginas = totalPaginas <= 5
    ? Array.from({ length: totalPaginas }, (_, i) => i + 1)
    : pagina <= 3
      ? [1, 2, 3, '…', totalPaginas]
      : pagina >= totalPaginas - 2
        ? [1, '…', totalPaginas - 2, totalPaginas - 1, totalPaginas]
        : [1, '…', pagina - 1, pagina, pagina + 1, '…', totalPaginas];

  navegacion.innerHTML = `<button class="page-button" type="button" data-trip-page="${pagina - 1}" aria-label="Página anterior"${pagina === 1 ? ' disabled' : ''}>&lt;</button>`
    + paginas.map(n => n === '…'
      ? '<span class="page-ellipsis" aria-hidden="true">…</span>'
      : `<button class="page-button${n === pagina ? ' active' : ''}" type="button" data-trip-page="${n}" aria-label="Página ${n}"${n === pagina ? ' aria-current="page"' : ''}>${n}</button>`).join('')
    + `<button class="page-button" type="button" data-trip-page="${pagina + 1}" aria-label="Página siguiente"${pagina === totalPaginas ? ' disabled' : ''}>&gt;</button>`;

  if (navegacion.animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    animacionPaginacion = navegacion.animate([{ opacity: 0.7 }, { opacity: 1 }], {
      duration: 160,
      easing: 'ease-out'
    });
  }
}

function actualizarTarjetas() {
  const mes = hoyISO().slice(0, 7);
  const delMes = state.viajes.filter(v => v.fecha.startsWith(mes));

  $('statTotal').textContent = numero(delMes.length);
  $('statProceso').textContent = numero(delMes.filter(v => grupoEstado(v) === 'proceso').length);
  $('statEspera').textContent = numero(delMes.filter(v => grupoEstado(v) === 'espera').length);
}