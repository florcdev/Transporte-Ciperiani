import { state } from '../state.js';
import { calcular } from '../domain/liquidacion.js';
import { grupoEstado } from '../domain/estados.js';
import { filtrarEntidad, porTramo } from '../domain/resumenes.js';
import { chipEstado } from './componentes.js';
import { dinero, dineroConCentavos, numero, fecha, hoyISO, esc } from '../lib/format.js';
import { onCambioSesion } from '../services/auth.service.js';
import { abrirDialogoImpresion } from './salida-orden.view.js';
import { obtenerPagina, renderizarPaginacion, textoRangoPagina } from './paginacion.js';
import { crearReciboEfectivo } from '../services/recibos.service.js';
import { crearResumenCuenta, listarResumenesCuenta } from '../services/reportes.service.js';
import { mostrarErrorCamposObligatorios } from './validacion.js';

const $ = id => document.getElementById(id);

const MODOS = {
  general: { titulo: 'Resumen general', subtitulo: 'Cuenta consolidada de los viajes del período.', columna: 'Concepto', todos: '' },
  camion: { titulo: 'Resumen por camión', subtitulo: 'Cuenta agrupada por camión.', columna: 'Camión', todos: 'Todos los camiones' },
  chofer: { titulo: 'Resumen por chofer', subtitulo: 'Cuenta agrupada por chofer.', columna: 'Chofer', todos: 'Todos los choferes' }
};

let modoGrafico = 'general';
let entidadGrafico = '';
let anioGrafico = null;
let mesGrafico = 'todos';
let modoCuenta = 'general';
let entidadCuenta = '';
let paginaHistorialReportes = 1;
let usuarioHistorialReportes = '';
let cargaHistorialReportes = null;
let revisionHistorialReportes = 0;
let recargaHistorialPendiente = false;
let historialCargado = false;

export function iniciarReportes() {
  const botonesSolapa = [...document.querySelectorAll('[data-report-tab]')];
  botonesSolapa.forEach((boton, indice) => {
    boton.addEventListener('click', () => seleccionarSolapaReporte(boton.dataset.reportTab, botonesSolapa));
    boton.addEventListener('keydown', evento => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(evento.key)) return;
      evento.preventDefault();
      const siguienteIndice = evento.key === 'Home' ? 0
        : evento.key === 'End' ? botonesSolapa.length - 1
          : (indice + (evento.key === 'ArrowRight' ? 1 : -1) + botonesSolapa.length) % botonesSolapa.length;
      const siguiente = botonesSolapa[siguienteIndice];
      seleccionarSolapaReporte(siguiente.dataset.reportTab, botonesSolapa);
      siguiente.focus();
    });
  });

  const botonesReporte = document.querySelectorAll('[data-report-group]');
  botonesReporte.forEach(boton => boton.addEventListener('click', () => {
    modoCuenta = boton.dataset.reportGroup;
    entidadCuenta = '';
    botonesReporte.forEach(b => b.setAttribute('aria-pressed', String(b === boton)));
    actualizarControlesCuenta();
    limpiarValidacionReporte();
  }));

  if ($('reportDateFrom')) {
    $('reportDateFrom').value = `${hoyISO().slice(0, 8)}01`;
    $('reportDateTo').value = hoyISO();
    $('reportDateFrom').addEventListener('change', () => {
      limpiarValidacionReporte();
      actualizarTarjetasReporte();
    });
    $('reportDateTo').addEventListener('change', () => {
      limpiarValidacionReporte();
      actualizarTarjetasReporte();
    });
    $('reportDriver').addEventListener('change', e => {
      entidadCuenta = e.target.value;
      limpiarValidacionReporte();
    });
    $('reportCustomer').addEventListener('change', e => {
      entidadCuenta = e.target.value;
      limpiarValidacionReporte();
    });
    $('btnGenerateReport').addEventListener('click', generarResumenCuenta);
    $('reportHistoryBody').addEventListener('click', imprimirResumenDesdeHistorial);
    $('reportHistoryPagination').addEventListener('click', evento => {
      const boton = evento.target.closest('[data-report-history-page]');
      if (!boton || boton.disabled) return;
      paginaHistorialReportes = Number(boton.dataset.reportHistoryPage);
      renderHistorialReportes();
    });
    $('cashReceiptForm').addEventListener('submit', guardarReciboEfectivo);
    $('cashReceiptMethod').addEventListener('change', actualizarCampoCheque);
    $('cashReceiptsBody').addEventListener('click', imprimirReciboDesdeHistorial);
    actualizarCampoCheque();
    actualizarControlesCuenta();
    actualizarTarjetasReporte();
    onCambioSesion(sesion => {
      const usuario = sesion?.user?.id || '';
      if (usuario === usuarioHistorialReportes) return;
      usuarioHistorialReportes = usuario;
      revisionHistorialReportes += 1;
      cargaHistorialReportes = null;
      recargaHistorialPendiente = false;
      historialCargado = false;
      state.resumenesCuenta = [];
      paginaHistorialReportes = 1;
      if (usuario) void cargarHistorialReportes();
      renderHistorialReportes();
    });
    window.addEventListener('afterprint', () => {
      document.body.classList.remove('printing-report');
      $('reportPrintPages').replaceChildren();
      $('printCashReceipt').hidden = true;
      document.body.classList.remove('printing-cash-receipt');
    });
  }

  const botones = document.querySelectorAll('[data-home-report-group]');
  botones.forEach(boton => boton.addEventListener('click', () => {
    modoGrafico = boton.dataset.homeReportGroup;
    entidadGrafico = '';
    botones.forEach(b => b.setAttribute('aria-pressed', String(b === boton)));
    renderGraficoInicio();
  }));

  $('homeReportYear')?.addEventListener('change', e => {
    anioGrafico = e.target.value;
    mesGrafico = 'todos';
    renderGraficoInicio();
  });
  $('homeReportMonth')?.addEventListener('change', e => {
    mesGrafico = e.target.value;
    renderGraficoInicio();
  });
  $('homeReportEntity')?.addEventListener('change', e => {
    entidadGrafico = e.target.value;
    renderGraficoInicio();
  });
}

function seleccionarSolapaReporte(solapa, botones) {
  botones.forEach(boton => {
    const activa = boton.dataset.reportTab === solapa;
    boton.setAttribute('aria-selected', String(activa));
    boton.tabIndex = activa ? 0 : -1;
    $(boton.getAttribute('aria-controls')).hidden = !activa;
  });
}

function cargarHistorialReportes(forzar = false) {
  if (cargaHistorialReportes) {
    if (forzar) recargaHistorialPendiente = true;
    return cargaHistorialReportes;
  }

  const revision = ++revisionHistorialReportes;
  const carga = listarResumenesCuenta()
    .then(reportes => {
      if (revision !== revisionHistorialReportes) return;
      state.resumenesCuenta = reportes;
      historialCargado = true;
      const error = $('reportValidation');
      if (error.textContent.startsWith('No se pudo cargar el historial de resúmenes:')) {
        error.hidden = true;
      }
      renderHistorialReportes();
    })
    .catch(error => {
      if (revision !== revisionHistorialReportes) return;
      historialCargado = false;
      mostrarErrorReporte(`No se pudo cargar el historial de resúmenes: ${error.message}`);
    })
    .finally(() => {
      if (cargaHistorialReportes !== carga) return;
      cargaHistorialReportes = null;
      if (recargaHistorialPendiente) {
        recargaHistorialPendiente = false;
        void cargarHistorialReportes();
      }
    });
  cargaHistorialReportes = carga;
  return carga;
}

function renderHistorialReportes() {
  const reportes = [...state.resumenesCuenta].sort((a, b) => Date.parse(b.creado) - Date.parse(a.creado));
  const pagina = obtenerPagina(reportes, paginaHistorialReportes);
  paginaHistorialReportes = pagina.pagina;
  $('reportHistoryCount').textContent = textoRangoPagina(pagina, 'resúmenes');
  renderizarPaginacion($('reportHistoryPagination'), pagina.pagina, pagina.totalPaginas, 'report-history');
  $('reportHistoryBody').innerHTML = pagina.total
    ? pagina.elementos.map(reporte => `<tr>
        <td>${textoModoCuenta(reporte.modo)}</td>
        <td>${reporte.modo === 'general' ? '' : esc(reporte.nombreCuenta)}</td>
        <td>${esc(fecha(reporte.desde))} al ${esc(fecha(reporte.hasta))}</td>
        <td>${fechaHoraLocal(reporte.creado)}</td>
        <td class="table-actions"><button class="icon-btn" type="button" data-print-report="${esc(reporte.id)}" aria-label="Imprimir resumen ${esc(reporte.nombreCuenta || 'general')}" title="Imprimir"><svg class="ic" aria-hidden="true" viewBox="0 0 24 24"><path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M7 14h10v7H7zM17 11h.01"/></svg></button></td>
      </tr>`).join('')
    : '<tr><td class="empty-cell" colspan="5">Todavía no generaste resúmenes de cuenta.</td></tr>';
}

function textoModoCuenta(modo) {
  return modo === 'chofer' ? 'Por chofer' : modo === 'cliente' ? 'Por cliente' : 'General';
}

function fechaHoraLocal(timestamp) {
  return timestamp ? new Date(timestamp).toLocaleString('es-AR') : '—';
}

function mostrarErrorReporte(mensaje) {
  const error = $('reportValidation');
  error.textContent = mensaje;
  error.hidden = false;
}

function limpiarValidacionReporte() {
  $('reportValidation').hidden = true;
  [$('reportDateFrom'), $('reportDateTo'), $('reportDriver'), $('reportCustomer')].forEach(campo => {
    campo.removeAttribute('aria-invalid');
  });
}

function actualizarControlesCuenta() {
  const wrapChofer = $('reportDriverWrap');
  const wrapCliente = $('reportCustomerWrap');
  wrapChofer.hidden = modoCuenta !== 'chofer';
  wrapCliente.hidden = modoCuenta !== 'cliente';

  if (modoCuenta === 'chofer') {
    actualizarOpcionesEntidad($('reportDriver'), state.choferes.filter(chofer => chofer.activo !== false), 'Elegí un chofer');
  } else if (modoCuenta === 'cliente') {
    actualizarOpcionesEntidad($('reportCustomer'), state.clientes.filter(cliente => cliente.activo !== false), 'Elegí un cliente');
  }
}

function actualizarOpcionesEntidad(select, entidades, placeholder) {
  select.innerHTML = `<option value="">${placeholder}</option>`
    + entidades.map(item => `<option value="${item.id}">${esc(item.nombre)}</option>`).join('');
  select.value = entidadCuenta;
}

function etiquetaMes(ym) {
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
    .replace(/^./, c => c.toUpperCase());
}

function aniosDisponibles() {
  return [...new Set([...state.viajes.map(v => v.fecha?.slice(0, 4)).filter(Boolean), hoyISO().slice(0, 4)])].sort().reverse();
}

function cargarPeriodosGrafico() {
  [anioGrafico, mesGrafico] = cargarPeriodos('homeReportYear', 'homeReportMonth', 'homeReportMonthWrap', anioGrafico, mesGrafico);
}

function cargarEntidadesGrafico() {
  entidadGrafico = cargarEntidades(modoGrafico, 'homeReportEntityWrap', 'homeReportEntity', entidadGrafico);
}

function cargarPeriodos(yearId, monthId, monthWrapId, year, month) {
  const anios = aniosDisponibles();
  if (year === null) year = hoyISO().slice(0, 4);
  const yearSelect = $(yearId);
  yearSelect.innerHTML = anios.map(a => `<option value="${a}">${a}</option>`).join('')
    + '<option value="todos">Todo el historial</option>';
  yearSelect.value = year;
  year = yearSelect.value;

  const monthWrap = $(monthWrapId);
  monthWrap.hidden = year === 'todos';
  if (year === 'todos') return [year, 'todos'];

  const monthSelect = $(monthId);
  monthSelect.innerHTML = '<option value="todos">Todo el año</option>'
    + Array.from({ length: 12 }, (_, i) => {
      const value = String(i + 1).padStart(2, '0');
      const label = new Date(Number(year), i, 1)
        .toLocaleDateString('es-AR', { month: 'long' })
        .replace(/^./, c => c.toUpperCase());
      return `<option value="${value}">${label}</option>`;
    }).join('');
  monthSelect.value = month;
  return [year, monthSelect.value];
}

function cargarEntidades(modo, wrapId, selectId, entidad) {
  $(wrapId).hidden = modo === 'general';
  if (modo === 'general') return '';
  const lista = modo === 'camion'
    ? state.camiones
      .map(camion => [
        camion.id,
        `${[camion.patente, camion.marca, camion.modelo].filter(Boolean).join(' · ')}${camion.activo === false ? ' (inactivo)' : ''}`
      ])
    : state.choferes.filter(chofer => chofer.activo !== false).map(c => [c.id, c.nombre]);

  const select = $(selectId);
  select.innerHTML = `<option value="">${MODOS[modo].todos}</option>`
    + lista.map(([id, texto]) => `<option value="${id}">${esc(texto)}</option>`).join('');
  select.value = entidad;
  return select.value;
}

function crearMovimientosCuenta() {
  const movimientos = [];
  let orden = 0;
  const agregar = (movimiento, importe, lado) => {
    const monto = Math.round((Number(importe) + Number.EPSILON) * 100) / 100;
    if (!(monto > 0)) return;
    movimientos.push({
      ...movimiento,
      debe: lado === 'debe' ? monto : 0,
      haber: lado === 'haber' ? monto : 0,
      orden: orden++
    });
  };
  const nombreChofer = id => state.choferes.find(chofer => chofer.id === Number(id))?.nombre || 'Chofer';
  const nombreCliente = id => state.clientes.find(cliente => cliente.id === Number(id))?.nombre || 'Cliente';

  state.viajes.forEach(viaje => {
    if (!viaje.fecha) return;
    const codigo = viaje.codigo || String(viaje.id);
    const base = { fecha: viaje.fecha, viaje: codigo };
    const chofer = nombreChofer(viaje.choferId);
    const choferDetalle = modoCuenta === 'general' ? `${chofer} · ` : '';
    if (viaje.choferId) {
      agregar({
        ...base, tipo: 'chofer', entidadId: Number(viaje.choferId),
        detalle: `${choferDetalle}Saldo generado · viaje ${codigo}`
      }, calcular(viaje).chofer, 'debe');
    }

    (viaje.gastosExtra || []).forEach(gasto => {
      if (gasto.destino === 'chofer' && viaje.choferId) {
        agregar({
          ...base, tipo: 'chofer', entidadId: Number(viaje.choferId),
          detalle: `${choferDetalle}${gasto.descripcion} · viaje ${codigo}`
        }, gasto.monto, 'debe');
      } else if (gasto.destino === 'cliente' && gasto.clienteId) {
        const cliente = nombreCliente(gasto.clienteId);
        agregar({
          ...base, tipo: 'cliente', entidadId: Number(gasto.clienteId),
          detalle: `${modoCuenta === 'general' ? `${cliente} · ` : ''}${gasto.descripcion} · viaje ${codigo}`
        }, gasto.monto, 'debe');
      }
    });

    if (viaje.choferId) {
      agregar({
        ...base, tipo: 'chofer', entidadId: Number(viaje.choferId),
        detalle: `${choferDetalle}Adelanto · viaje ${codigo}`
      }, viaje.adelanto, 'haber');
    }
  });

  state.ordenesRetiro.forEach(ordenRetiro => {
    const chofer = nombreChofer(ordenRetiro.choferId);
    const detalles = Array.isArray(ordenRetiro.detallesPago) && ordenRetiro.detallesPago.length
      ? ordenRetiro.detallesPago
      : [{ observacion: `Orden de retiro ${ordenRetiro.numero}`, monto: ordenRetiro.total }];
    detalles.forEach(detalle => agregar({
      fecha: detalle.fecha || fechaISOdeTimestamp(ordenRetiro.creado),
      viaje: '',
      tipo: 'chofer',
      entidadId: Number(ordenRetiro.choferId),
      detalle: `${modoCuenta === 'general' ? `${chofer} · ` : ''}${detalle.observacion || `Orden de retiro ${ordenRetiro.numero}`}`
    }, detalle.monto, 'haber'));
  });

  state.ordenesPagoCliente.forEach(ordenPago => {
    const cliente = nombreCliente(ordenPago.clienteId);
    const detalles = Array.isArray(ordenPago.detalles) && ordenPago.detalles.length
      ? ordenPago.detalles
      : [{ fecha: fechaISOdeTimestamp(ordenPago.creado), monto: ordenPago.total, concepto: '' }];
    detalles.forEach(detalle => {
      const descripcion = detalle.concepto?.trim()
        || `Orden de pago ${ordenPago.numero}${detalle.medio ? ` · ${detalle.medio}` : ''}`;
      agregar({
        fecha: detalle.fecha || fechaISOdeTimestamp(ordenPago.creado),
        viaje: '',
        tipo: 'cliente',
        entidadId: Number(ordenPago.clienteId),
        detalle: `${modoCuenta === 'general' ? `${cliente} · ` : ''}${descripcion}`
      }, detalle.monto, 'haber');
    });
  });

  return movimientos;
}

function fechaISOdeTimestamp(timestamp) {
  if (!timestamp) return hoyISO();
  const fechaLocal = new Date(timestamp);
  const parte = numero => String(numero).padStart(2, '0');
  return `${fechaLocal.getFullYear()}-${parte(fechaLocal.getMonth() + 1)}-${parte(fechaLocal.getDate())}`;
}

const aCentavos = importe => Math.round((Number(importe) + Number.EPSILON) * 100);

function renderPaginasCuenta({ movimientos, saldoAnterior, desde, hasta, fechaImpresion, nombreCuenta }) {
  let saldoEnCentavos = aCentavos(saldoAnterior);
  const filas = [];
  if (saldoEnCentavos !== 0) {
    filas.push({
      fecha: desde, viaje: '', detalle: 'Saldo anterior',
      debe: 0, haber: 0, saldo: saldoEnCentavos / 100, anterior: true
    });
  }
  movimientos.forEach(movimiento => {
    saldoEnCentavos += aCentavos(movimiento.debe) - aCentavos(movimiento.haber);
    filas.push({ ...movimiento, saldo: saldoEnCentavos / 100 });
  });
  if (!filas.length) {
    filas.push({
      fecha: '', viaje: '', detalle: 'Sin movimientos para el período seleccionado.',
      debe: 0, haber: 0, saldo: saldoEnCentavos / 100
    });
  }

  const periodo = esc(`${fecha(desde)} al ${fecha(hasta)}`);
  const tituloEntidad = nombreCuenta === 'General' ? 'General' : nombreCuenta;
  const textoFilas = filas.map(fila => `<tr${fila.anterior ? ' class="statement-opening"' : ''}>
    <td>${esc(fila.viaje || '—')}</td>
    <td>${fila.fecha ? esc(fecha(fila.fecha)) : '—'}</td>
    <td>${esc(fila.detalle)}</td>
    <td class="num">${fila.debe ? dineroConCentavos(fila.debe) : '—'}</td>
    <td class="num">${fila.haber ? dineroConCentavos(fila.haber) : '—'}</td>
    <td class="num">${dineroConCentavos(fila.saldo)}</td>
  </tr>`).join('');

  return `<article class="statement-page">
    <header class="statement-header">
      <strong class="statement-brand">Transporte Ciperiani</strong>
      <div class="statement-heading">
        <h2>Resumen de Cuenta</h2>
        <strong>${esc(tituloEntidad)}</strong>
        <span>Período: ${periodo}</span>
        <span>Fecha de Impresión: ${fechaImpresion}</span>
      </div>
    </header>
    <div class="table-scroll">
      <table class="statement-table">
        <thead><tr><th>ID del viaje</th><th>Fecha</th><th>Detalle</th><th class="num">Debe</th><th class="num">Haber</th><th class="num">Saldo</th></tr></thead>
        <tbody>${textoFilas}<tr class="statement-final-balance"><th colspan="5">Saldo final</th><td class="num">${dineroConCentavos(saldoEnCentavos / 100)}</td></tr></tbody>
      </table>
    </div>
  </article>`;
}

export function renderReportes(forzarActualizacion = false) {
  if (forzarActualizacion || !historialCargado) void cargarHistorialReportes(forzarActualizacion);
  actualizarClientesRecibo();
  actualizarControlesCuenta();
  actualizarTarjetasReporte();
  renderHistorialReportes();
  renderHistorialRecibos();
}

function actualizarClientesRecibo() {
  const select = $('cashReceiptCustomer');
  const clienteSeleccionado = select.value;
  select.innerHTML = '<option value="">Elegí un cliente</option>'
    + state.clientes.filter(cliente => cliente.activo !== false)
      .map(cliente => `<option value="${cliente.id}">${esc(cliente.nombre)}</option>`).join('');
  if (state.clientes.some(cliente => cliente.activo !== false && String(cliente.id) === clienteSeleccionado)) {
    select.value = clienteSeleccionado;
  }
}

function actualizarCampoCheque() {
  const esCheque = $('cashReceiptMethod').value === 'Cheque';
  $('cashReceiptCheckWrap').hidden = !esCheque;
  $('cashReceiptCheckNumber').required = esCheque;
}

function renderHistorialRecibos() {
  $('cashReceiptsBody').innerHTML = state.recibosEfectivo.length
    ? state.recibosEfectivo.map(recibo => `<tr>
        <td>${esc(recibo.numero)}</td>
        <td>${esc(fechaHoraLocal(recibo.creado))}</td>
        <td>${esc(state.clientes.find(cliente => cliente.id === recibo.clienteId)?.nombre || '—')}</td>
        <td class="num">${dinero(recibo.importe)}</td>
        <td class="table-actions"><button class="icon-btn" type="button" data-print-cash-receipt="${esc(recibo.id)}" aria-label="Imprimir recibo ${esc(recibo.numero)}" title="Imprimir"><svg class="ic" aria-hidden="true" viewBox="0 0 24 24"><path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5h-2"/><path d="M7 14h10v7H7zM17 11h.01"/></svg></button></td>
      </tr>`).join('')
    : '<tr><td class="empty-cell" colspan="5">Todavía no hay recibos de efectivo generados.</td></tr>';
}

async function guardarReciboEfectivo(evento) {
  evento.preventDefault();
  const formulario = $('cashReceiptForm');
  const campos = formulario.elements;
  const datos = {
    clienteId: Number(campos.clienteId.value),
    para: campos.para.value.trim(),
    metodoPago: campos.metodoPago.value,
    numeroCheque: campos.metodoPago.value === 'Cheque' ? campos.numeroCheque.value.trim() : null,
    importe: Number(campos.importe.value)
  };
  const error = $('cashReceiptError');
  if (!datos.clienteId || !datos.para || !(datos.importe > 0)
    || (datos.metodoPago === 'Cheque' && !datos.numeroCheque)) {
    const faltantes = [
      ...(!datos.clienteId ? [campos.clienteId] : []),
      ...(!datos.para ? [campos.para] : []),
      ...(!(datos.importe > 0) ? [campos.importe] : []),
      ...(datos.metodoPago === 'Cheque' && !datos.numeroCheque ? [campos.numeroCheque] : [])
    ];
    mostrarErrorCamposObligatorios(formulario, faltantes);
    return;
  }

  const boton = $('btnSaveCashReceipt');
  boton.disabled = true;
  error.hidden = true;
  let recibo;
  try {
    recibo = await crearReciboEfectivo(datos);
  } catch (cause) {
    error.textContent = `No se pudo generar el recibo de efectivo: ${cause.message}`;
    error.hidden = false;
    boton.disabled = false;
    return;
  }

  state.recibosEfectivo.unshift(recibo);
  renderHistorialRecibos();
  formulario.reset();
  actualizarCampoCheque();
  try {
    imprimirRecibo(recibo);
  } catch (cause) {
    error.textContent = `El recibo ${recibo.numero} se guardó, pero no se pudo abrir la impresión: ${cause.message}`;
    error.hidden = false;
  } finally {
    boton.disabled = false;
  }
}

function imprimirReciboDesdeHistorial(evento) {
  const boton = evento.target.closest('[data-print-cash-receipt]');
  if (!boton) return;
  const recibo = state.recibosEfectivo.find(item => String(item.id) === boton.dataset.printCashReceipt);
  if (recibo) imprimirRecibo(recibo);
}

function imprimirRecibo(recibo) {
  $('printCashReceiptCustomer').textContent =
    state.clientes.find(cliente => cliente.id === recibo.clienteId)?.nombre || '';
  $('printCashReceiptFor').textContent = recibo.para;
  $('printCashReceiptNumber').textContent = recibo.numero;
  $('printCashReceiptDate').textContent = fechaHoraLocal(recibo.creado);
  $('printCashReceiptMethod').textContent = recibo.metodoPago;
  $('printCashReceiptCheckNumber').textContent = recibo.numeroCheque ? ` · N° ${recibo.numeroCheque}` : '';
  $('printCashReceiptAmount').textContent = dinero(recibo.importe);
  $('printCashReceipt').hidden = false;
  document.body.classList.add('printing-report', 'printing-cash-receipt');
  try {
    abrirDialogoImpresion(`Recibo de efectivo ${recibo.numero}`);
  } catch (cause) {
    $('printCashReceipt').hidden = true;
    document.body.classList.remove('printing-report', 'printing-cash-receipt');
    throw cause;
  }
}

function actualizarTarjetasReporte() {
  const desde = $('reportDateFrom').value;
  const hasta = $('reportDateTo').value;
  const totales = {
    pagado: { cantidad: 0, importe: 0 },
    proceso: { cantidad: 0, importe: 0 },
    espera: { cantidad: 0, importe: 0 }
  };

  if (desde && hasta && desde <= hasta) {
    state.viajes
      .filter(viaje => viaje.fecha >= desde && viaje.fecha <= hasta)
      .forEach(viaje => {
        const grupo = grupoEstado(viaje);
        const total = totales[grupo];
        total.cantidad += 1;
        total.importe += calcular(viaje).totalViaje;
      });
  }

  $('reportPaidTotal').textContent = dinero(totales.pagado.importe);
  $('reportPaidCount').textContent = numero(totales.pagado.cantidad);
  $('reportProcessTotal').textContent = dinero(totales.proceso.importe);
  $('reportProcessCount').textContent = numero(totales.proceso.cantidad);
  $('reportPendingTotal').textContent = dinero(totales.espera.importe);
  $('reportPendingCount').textContent = numero(totales.espera.cantidad);
}

async function generarResumenCuenta() {
  const desde = $('reportDateFrom').value;
  const hasta = $('reportDateTo').value;
  if (!desde || !hasta || desde > hasta) {
    if (!desde || !hasta) {
      mostrarErrorReporte('Completá los campos obligatorios');
      if (!desde) $('reportDateFrom').setAttribute('aria-invalid', 'true');
      if (!hasta) $('reportDateTo').setAttribute('aria-invalid', 'true');
    } else {
      mostrarErrorReporte('Elegí un período válido: la fecha inicial debe ser anterior o igual a la fecha final.');
      $('reportDateFrom').setAttribute('aria-invalid', 'true');
      $('reportDateTo').setAttribute('aria-invalid', 'true');
    }
    return;
  }
  if (modoCuenta !== 'general' && !entidadCuenta) {
    mostrarErrorReporte('Completá los campos obligatorios');
    (modoCuenta === 'chofer' ? $('reportDriver') : $('reportCustomer')).setAttribute('aria-invalid', 'true');
    return;
  }

  const entidad = modoCuenta === 'chofer'
    ? state.choferes.find(chofer => chofer.id === Number(entidadCuenta) && chofer.activo !== false)
    : modoCuenta === 'cliente'
      ? state.clientes.find(cliente => cliente.id === Number(entidadCuenta) && cliente.activo !== false)
      : null;
  if (modoCuenta !== 'general' && !entidad) {
    mostrarErrorReporte(`No se encontró el ${modoCuenta === 'chofer' ? 'chofer' : 'cliente'} seleccionado.`);
    return;
  }

  const todos = crearMovimientosCuenta();
  const movimientos = todos.filter(movimiento => {
    if (modoCuenta === 'chofer' && (movimiento.tipo !== 'chofer' || movimiento.entidadId !== Number(entidadCuenta))) return false;
    if (modoCuenta === 'cliente' && (movimiento.tipo !== 'cliente' || movimiento.entidadId !== Number(entidadCuenta))) return false;
    return true;
  });
  const saldoAnterior = movimientos
    .filter(movimiento => movimiento.fecha < desde)
    .reduce((saldo, movimiento) => saldo + aCentavos(movimiento.debe) - aCentavos(movimiento.haber), 0) / 100;
  const delPeriodo = movimientos
    .filter(movimiento => movimiento.fecha >= desde && movimiento.fecha <= hasta)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.orden - b.orden);
  const reporte = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    modo: modoCuenta,
    nombreCuenta: modoCuenta === 'general' ? 'General' : entidad.nombre,
    desde,
    hasta,
    creado: new Date().toISOString(),
    movimientos: delPeriodo,
    saldoAnterior
  };

  try {
    const guardado = await crearResumenCuenta(reporte);
    state.resumenesCuenta.unshift(guardado);
  } catch (error) {
    mostrarErrorReporte(`No se pudo guardar el resumen generado: ${error.message}`);
    return;
  }
  paginaHistorialReportes = 1;
  limpiarValidacionReporte();
  renderHistorialReportes();
  imprimirResumen(reporte);
}

function imprimirResumenDesdeHistorial(evento) {
  const boton = evento.target.closest('[data-print-report]');
  if (!boton) return;
  const reporte = state.resumenesCuenta.find(item => item.id === boton.dataset.printReport);
  if (!reporte) {
    mostrarErrorReporte('No se encontró el resumen seleccionado en el historial.');
    return;
  }
  imprimirResumen(reporte);
}

function imprimirResumen(reporte) {
  const pages = renderPaginasCuenta({
    movimientos: reporte.movimientos,
    saldoAnterior: reporte.saldoAnterior,
    desde: reporte.desde,
    hasta: reporte.hasta,
    fechaImpresion: fecha(fechaISOdeTimestamp(reporte.creado)),
    nombreCuenta: reporte.nombreCuenta
  });
  $('reportPrintPages').innerHTML = pages;
  $('printReport').hidden = false;
  document.body.classList.add('printing-report');
  const nombreArchivo = `Resumen ${textoModoCuenta(reporte.modo)} ${reporte.nombreCuenta || ''} ${reporte.desde} ${reporte.hasta}`
    .replace(/[<>:"/\\|?*]+/g, '-').trim();
  abrirDialogoImpresion(nombreArchivo);
}

export function renderGraficoInicio() {
  cargarPeriodosGrafico();
  cargarEntidadesGrafico();

  const periodo = filtrarPeriodo(anioGrafico, mesGrafico);
  const viajes = filtrarEntidad(periodo, modoGrafico, entidadGrafico);
  renderGrafico(viajes);
  renderViajesRecientes(viajes);
}

function filtrarPeriodo(anio, mes) {
  if (anio === 'todos') return state.viajes;
  const periodo = mes === 'todos' ? anio : `${anio}-${mes}`;
  return state.viajes.filter(v => v.fecha?.startsWith(periodo));
}

function etiquetaPeriodo(anio, mes) {
  if (anio === 'todos') return 'Todo el historial';
  if (mes === 'todos') return `Todo ${anio}`;
  return etiquetaMes(`${anio}-${mes}`);
}

function renderViajesRecientes(viajes) {
  const recientes = viajes.slice(0, 5);
  $('homeRecentTrips').innerHTML = recientes.length
    ? recientes.map(v => `<li>
        <a class="recent-trip" href="#viaje/${encodeURIComponent(v.codigo)}">
          <div class="recent-trip-meta">${chipEstado(v)}<time datetime="${esc(v.fecha)}">${fecha(v.fecha)}</time></div>
          <div class="recent-route"><span>${esc(v.origen || '—')}</span><span class="recent-route-arrow" aria-hidden="true">→</span><span>${esc(v.destino || '—')}</span></div>
        </a>
      </li>`).join('')
    : '<li class="recent-empty">No hay viajes para los filtros seleccionados.</li>';
}

function renderGrafico(viajes) {
  const MILLON = 1e6;
  const tramos = porTramo(viajes).map(t => ({
    etiqueta: t.etiqueta,
    pagado: t.pagado / MILLON,
    proceso: t.proceso / MILLON,
    espera: t.espera / MILLON
  }));

  const suma = t => t.pagado + t.proceso + t.espera;
  const tope = Math.max(1, ...tramos.map(suma)) * 1.15; // aire arriba para la etiqueta del total

  const eje = [0, 1, 2, 3, 4, 5, 6]
    .map(i => `<span style="bottom:${i / 6 * 100}%">${(tope * i / 6).toFixed(1).replace('.', ',')}</span>`).join('');

  const columnas = tramos.map(t => {
    const total = suma(t);
    const pct = k => (total ? t[k] / total * 100 : 0);
    return `<div class="col"><span class="tot">${total.toFixed(1).replace('.', ',')}</span>
      <div class="stack" style="height:${total / tope * 100}%">
        <i class="p" style="height:${pct('pagado')}%"></i>
        <i class="e" style="height:${pct('proceso')}%"></i>
        <i class="w" style="height:${pct('espera')}%"></i>
      </div></div>`;
  }).join('');

  $('homeChart').innerHTML = `<div class="y-axis">${eje}</div><div class="plot">${columnas}</div>`
    + `<div class="x-axis">${tramos.map(t => `<span>${t.etiqueta}</span>`).join('')}</div>`;
}