import { actualizarCliente, crearCliente, darDeBajaCliente } from '../services/catalogos.service.js';
import { crearOrdenPagoCliente } from '../services/clientes.service.js';
import { state } from '../state.js';
import { dineroConCentavos, esc, fecha, fechaHora, hoyISO } from '../lib/format.js';
import { mostrarError } from './componentes.js';
import { abrirDialogoImpresion } from './salida-orden.view.js';
import { obtenerPagina, renderizarPaginacion, textoRangoPagina } from './paginacion.js';
import { cuitDuplicado, esCuitValido, normalizarCuit } from '../domain/cuit.js';
import { limpiarErrorValidacion, mostrarErrorCamposObligatorios, mostrarErrorValidacion } from './validacion.js';

const $ = id => document.getElementById(id);
let modalCliente;
let modalPago;
let modalDetalleCliente;
let formularioCliente;
let formularioPago;
let siguienteIdDetalle = 0;
let clienteEditandoId = null;
let clienteDetalleId = null;
let paginaOrdenesPago = 1;

export function iniciarClientes() {
  modalCliente = $('customerModal');
  modalPago = $('customerPaymentModal');
  modalDetalleCliente = $('customerDetailModal');
  formularioCliente = $('customerForm');
  formularioPago = $('customerPaymentForm');

  $('btnNewCustomer').addEventListener('click', () => abrirCliente());
  $('btnNewCustomerPayment').addEventListener('click', abrirPago);
  formularioCliente.addEventListener('submit', guardarCliente);
  formularioCliente.elements.cuit.addEventListener('input', () =>
    limpiarErrorValidacion(formularioCliente, formularioCliente.elements.cuit));
  formularioPago.addEventListener('submit', guardarPago);
  $('customersBody').addEventListener('click', evento => {
    const fila = evento.target.closest('[data-customer-row]');
    if (fila) abrirDetalleCliente(Number(fila.dataset.customerRow));
  });
  $('btnEditCustomer').addEventListener('click', () => {
    const cliente = state.clientes.find(item => item.id === clienteDetalleId);
    if (!cliente) return;
    cerrarModal(modalDetalleCliente);
    abrirCliente(cliente);
  });
  $('btnDeleteCustomer').addEventListener('click', darDeBajaClienteSeleccionado);
  formularioPago.elements.clienteId.addEventListener('change', actualizarCuit);
  formularioPago.elements.clienteId.addEventListener('change', actualizarTotal);
  formularioPago.addEventListener('input', e => {
    if (e.target.matches('.payment-detail-amount')) actualizarTotal();
  });
  formularioPago.addEventListener('change', e => {
    if (e.target.matches('.payment-detail-method')) actualizarCamposMetodo(e.target.closest('.customer-payment-detail'));
  });
  $('btnAddPaymentDetail').addEventListener('click', () => agregarDetalle());
  $('customerPaymentDetails').addEventListener('click', e => {
    if (!e.target.closest('[data-remove-payment-detail]')) return;
    e.target.closest('.customer-payment-detail').remove();
    actualizarTotal();
  });
  document.querySelectorAll('[data-close-customer-modal]').forEach(el => el.addEventListener('click', () => cerrarModal(modalCliente)));
  document.querySelectorAll('[data-close-customer-payment-modal]').forEach(el => el.addEventListener('click', () => cerrarModal(modalPago)));
  document.querySelectorAll('[data-close-customer-detail]').forEach(el => el.addEventListener('click', () => cerrarModal(modalDetalleCliente)));
  $('customerPaymentsBody').addEventListener('click', e => {
    const boton = e.target.closest('[data-print-customer-order]');
    if (!boton) return;
    const orden = state.ordenesPagoCliente.find(item => String(item.id) === boton.dataset.printCustomerOrder);
    if (!orden) return;
    try {
      imprimirOrden(orden);
    } catch (cause) {
      mostrarError(`No se pudo abrir la impresión de la orden ${orden.numero}: ${cause.message}`);
    }
  });
  $('customerPaymentPagination').addEventListener('click', e => {
    const boton = e.target.closest('[data-customer-payment-page]');
    if (!boton || boton.disabled) return;
    paginaOrdenesPago = Number(boton.dataset.customerPaymentPage);
    renderClientes();
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!modalDetalleCliente.hidden) cerrarModal(modalDetalleCliente);
    if (!modalCliente.hidden) cerrarModal(modalCliente);
    if (!modalPago.hidden) cerrarModal(modalPago);
  });
  window.addEventListener('afterprint', () => {
    $('printCustomerOrder').hidden = true;
    document.body.classList.remove('printing-customer-order');
  });
}

function cerrarModal(modal) {
  modal.hidden = true;
  if (!document.querySelector('.modal:not([hidden])')) document.body.classList.remove('modal-open');
}

function abrirCliente(cliente = null) {
  clienteEditandoId = cliente?.id ?? null;
  formularioCliente.reset();
  if (cliente) {
    formularioCliente.elements.nombre.value = cliente.nombre;
    formularioCliente.elements.cuit.value = cliente.cuit || '';
  }
  $('customerFormError').hidden = true;
  $('customerModalTitle').textContent = cliente ? 'Editar cliente' : 'Agregar cliente';
  $('btnSaveCustomer').textContent = cliente ? 'Guardar cambios' : 'Guardar cliente';
  modalCliente.hidden = false;
  document.body.classList.add('modal-open');
  formularioCliente.elements.nombre.focus();
}

function saldoClientes() {
  const saldos = new Map(state.clientes.map(cliente => [cliente.id, { generado: 0, pagado: 0 }]));
  state.viajes.forEach(viaje => {
    (viaje.gastosExtra || []).forEach(gasto => {
      if (gasto.destino !== 'cliente') return;
      const saldo = saldos.get(Number(gasto.clienteId));
      if (saldo) saldo.generado += Number(gasto.monto) || 0;
    });
  });
  state.ordenesPagoCliente.forEach(orden => {
    const saldo = saldos.get(orden.clienteId);
    if (saldo) saldo.pagado += orden.total;
  });
  saldos.forEach(saldo => {
    saldo.generado = Math.round((saldo.generado + Number.EPSILON) * 100) / 100;
    saldo.pagado = Math.round((saldo.pagado + Number.EPSILON) * 100) / 100;
  });
  return saldos;
}

const pendienteDe = saldo => saldo
  ? Math.round((saldo.generado - saldo.pagado + Number.EPSILON) * 100) / 100
  : 0;

function abrirDetalleCliente(clienteId) {
  const cliente = state.clientes.find(item => item.id === clienteId && item.activo !== false);
  if (!cliente) return;
  clienteDetalleId = cliente.id;
  const saldo = saldoClientes().get(cliente.id);
  $('customerDetailName').textContent = cliente.nombre || '—';
  $('customerDetailCuit').textContent = cliente.cuit || '—';
  $('customerDetailGenerated').textContent = dineroConCentavos(saldo?.generado || 0);
  $('customerDetailPaid').textContent = dineroConCentavos(saldo?.pagado || 0);
  $('customerDetailPending').textContent = dineroConCentavos(pendienteDe(saldo));
  $('btnDeleteCustomer').disabled = false;
  modalDetalleCliente.hidden = false;
  document.body.classList.add('modal-open');
  $('btnEditCustomer').focus();
}

export function renderClientes() {
  const saldos = saldoClientes();
  const clientesActivos = state.clientes.filter(cliente => cliente.activo !== false);
  $('customersBody').innerHTML = clientesActivos.length
    ? clientesActivos.map(cliente => {
      const saldo = saldos.get(cliente.id);
      return `<tr data-customer-row="${cliente.id}">
        <td data-label="Cliente"><button class="catalog-row-link" type="button">${esc(cliente.nombre)}</button></td><td data-label="CUIT">${esc(cliente.cuit || '—')}</td>
        <td class="num" data-label="Importe generado">${dineroConCentavos(saldo.generado)}</td><td class="num" data-label="Pagado">${dineroConCentavos(saldo.pagado)}</td>
        <td class="num" data-label="Pendiente"><strong>${dineroConCentavos(pendienteDe(saldo))}</strong></td>
      </tr>`;
    }).join('')
    : '<tr><td class="empty-cell" colspan="5">Todavía no hay clientes. Agregá el primero para comenzar.</td></tr>';

  const ordenesPago = [...state.ordenesPagoCliente].sort((a, b) => Date.parse(b.creado) - Date.parse(a.creado));
  const pagina = obtenerPagina(ordenesPago, paginaOrdenesPago);
  paginaOrdenesPago = pagina.pagina;
  $('customerPaymentCount').textContent = textoRangoPagina(pagina, 'órdenes de pago');
  renderizarPaginacion($('customerPaymentPagination'), pagina.pagina, pagina.totalPaginas, 'customer-payment');
  $('customerPaymentsBody').innerHTML = pagina.total
    ? pagina.elementos.map(orden => `<tr>
      <td data-label="Número">${esc(orden.numero)}</td><td data-label="Fecha">${esc(fechaHora(orden.creado))}</td>
      <td data-label="Cliente">${esc(state.clientes.find(cliente => cliente.id === orden.clienteId)?.nombre || '—')}</td>
      <td class="num" data-label="Total">${dineroConCentavos(orden.total)}</td>
      <td class="table-actions" data-label="Imprimir"><button class="icon-btn" type="button" data-print-customer-order="${orden.id}" aria-label="Imprimir orden ${esc(orden.numero)}" title="Imprimir"><svg class="ic" aria-hidden="true" viewBox="0 0 24 24"><path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M7 14h10v7H7zM17 11h.01"/></svg></button></td>
    </tr>`).join('')
    : '<tr><td class="empty-cell" colspan="5">Todavía no hay órdenes de pago registradas.</td></tr>';
}

async function guardarCliente(e) {
  e.preventDefault();
  const datos = {
    nombre: formularioCliente.elements.nombre.value.trim(),
    cuit: normalizarCuit(formularioCliente.elements.cuit.value)
  };
  const campoCuit = formularioCliente.elements.cuit;
  const error = $('customerFormError');
  if (!datos.nombre || !datos.cuit) {
    mostrarErrorCamposObligatorios(formularioCliente, [
      ...(!datos.nombre ? [formularioCliente.elements.nombre] : []),
      ...(!datos.cuit ? [formularioCliente.elements.cuit] : [])
    ]);
    return;
  }
  if (!esCuitValido(datos.cuit)) {
    mostrarErrorValidacion(formularioCliente, campoCuit, 'Ingresá un CUIT válido de 11 dígitos.');
    return;
  }
  if (cuitDuplicado(datos.cuit, state.choferes, state.clientes, 'cliente', clienteEditandoId)) {
    mostrarErrorValidacion(formularioCliente, campoCuit, 'Ese CUIT ya está registrado en un cliente o chofer.');
    return;
  }

  const boton = $('btnSaveCustomer');
  boton.disabled = true;
  error.hidden = true;
  try {
    const cliente = clienteEditandoId
      ? await actualizarCliente(clienteEditandoId, datos)
      : await crearCliente(datos);
    const indice = state.clientes.findIndex(item => item.id === cliente.id);
    if (indice < 0) state.clientes.push(cliente);
    else state.clientes[indice] = cliente;
    state.clientes.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    clienteEditandoId = null;
    cerrarModal(modalCliente);
    renderClientes();
  } catch (cause) {
    error.textContent = `No se pudo guardar el cliente: ${cause.message}`;
    error.hidden = false;
  } finally {
    boton.disabled = false;
  }
}

async function darDeBajaClienteSeleccionado() {
  const cliente = state.clientes.find(item => item.id === clienteDetalleId);
  if (!cliente || !window.confirm(`¿Dar de baja a ${cliente.nombre}? Se conservará su historial de viajes y pagos.`)) return;

  const boton = $('btnDeleteCustomer');
  boton.disabled = true;
  try {
    const actualizado = await darDeBajaCliente(cliente.id);
    Object.assign(cliente, actualizado);
    cerrarModal(modalDetalleCliente);
    renderClientes();
  } catch (cause) {
    mostrarError(`No se pudo dar de baja al cliente: ${cause.message}`);
    boton.disabled = false;
  }
}

function abrirPago(clienteId = null) {
  if (!state.clientes.some(cliente => cliente.activo !== false)) {
    mostrarError('Agregá al menos un cliente antes de generar una orden de pago.');
    return;
  }
  formularioPago.reset();
  $('customerPaymentError').hidden = true;
  formularioPago.elements.clienteId.innerHTML = '<option value="">Elegí un cliente</option>'
    + state.clientes.filter(cliente => cliente.activo !== false)
      .map(cliente => `<option value="${cliente.id}">${esc(cliente.nombre)}</option>`).join('');
  if (clienteId) formularioPago.elements.clienteId.value = String(clienteId);
  $('paymentCustomerCuit').value = '';
  $('customerPaymentDetails').replaceChildren();
  agregarDetalle();
  actualizarCuit();
  actualizarTotal();
  modalPago.hidden = false;
  document.body.classList.add('modal-open');
  formularioPago.elements.clienteId.focus();
}

function actualizarCuit() {
  const cliente = state.clientes.find(item => item.id === Number(formularioPago.elements.clienteId.value));
  $('paymentCustomerCuit').value = cliente?.cuit || '';
}

function agregarDetalle(detalle = {}) {
  const indice = siguienteIdDetalle++;
  const fila = document.createElement('div');
  fila.className = 'customer-payment-detail';
  fila.innerHTML = `
    <div class="field"><label for="paymentConcept${indice}">Detalle de pago</label><input class="input payment-detail-concept" id="paymentConcept${indice}" maxlength="160" value="${esc(detalle.concepto || '')}" placeholder="Motivo del pago" required></div>
    <div class="field"><label for="paymentMethod${indice}">Medio de pago</label><select class="input payment-detail-method" id="paymentMethod${indice}" required><option value="">Elegir</option><option value="Cheque">Cheque</option><option value="Transferencia">Transferencia</option><option value="Efectivo">Efectivo</option></select></div>
    <div class="field"><label for="paymentDate${indice}">Fecha</label><input class="input payment-detail-date" id="paymentDate${indice}" type="date" value="${esc(detalle.fecha || hoyISO())}" required></div>
    <div class="field"><label for="paymentAmount${indice}">Monto ($)</label><input class="input payment-detail-amount" id="paymentAmount${indice}" type="number" min="0.01" step="0.01" value="${detalle.monto ? Number(detalle.monto) : ''}" required></div>
    <div class="field"><label for="paymentBank${indice}">Banco</label><input class="input payment-detail-bank" id="paymentBank${indice}" maxlength="100" value="${esc(detalle.banco || '')}"></div>
    <button class="icon-btn payment-detail-remove" type="button" data-remove-payment-detail aria-label="Quitar medio de pago"><svg class="ic"><use href="#i-close"/></svg></button>`;
  fila.querySelector('.payment-detail-method').value = detalle.medio || '';
  fila.querySelector('.payment-detail-method').addEventListener('change', () => actualizarCamposMetodo(fila));
  actualizarCamposMetodo(fila);
  $('customerPaymentDetails').append(fila);
  $('customerPaymentDetails').classList.remove('has-required-error');
}

function actualizarCamposMetodo(fila) {
  const esTransferencia = fila.querySelector('.payment-detail-method').value === 'Transferencia';
  fila.querySelector('.payment-detail-bank').required = esTransferencia;
  fila.querySelector('.payment-detail-bank').placeholder = esTransferencia ? 'Banco requerido' : 'Opcional';
}

function leerDetalles() {
  return [...$('customerPaymentDetails').querySelectorAll('.customer-payment-detail')].map(fila => ({
    concepto: fila.querySelector('.payment-detail-concept').value.trim(),
    medio: fila.querySelector('.payment-detail-method').value,
    fecha: fila.querySelector('.payment-detail-date').value,
    monto: Number(fila.querySelector('.payment-detail-amount').value),
    banco: fila.querySelector('.payment-detail-bank').value.trim()
  }));
}

function actualizarTotal() {
  const total = leerDetalles().reduce((suma, detalle) => suma + (Number(detalle.monto) || 0), 0);
  $('customerPaymentTotal').textContent = dineroConCentavos(total);
}

async function guardarPago(e) {
  e.preventDefault();
  const clienteId = Number(formularioPago.elements.clienteId.value);
  const detalles = leerDetalles();
  const total = Math.round((detalles.reduce((suma, detalle) => suma + detalle.monto, 0) + Number.EPSILON) * 100) / 100;
  const saldo = saldoClientes().get(clienteId);
  const pendiente = pendienteDe(saldo);
  const error = $('customerPaymentError');
  const invalidDetail = detalles.some(detalle =>
    !detalle.concepto || !['Cheque', 'Transferencia', 'Efectivo'].includes(detalle.medio)
    || !detalle.fecha || !(detalle.monto > 0)
    || (detalle.medio === 'Transferencia' && !detalle.banco));
  if (!clienteId || !state.clientes.some(cliente => cliente.id === clienteId && cliente.activo !== false)
    || !detalles.length || invalidDetail || !(total > 0) || total > pendiente) {
    if (total > pendiente) {
      error.textContent = `El total supera el importe pendiente del cliente (${dineroConCentavos(pendiente)}).`;
      error.hidden = false;
    } else {
      const camposInvalidos = [...$('customerPaymentDetails').querySelectorAll('.customer-payment-detail')].flatMap(fila => [
        fila.querySelector('.payment-detail-concept'),
        fila.querySelector('.payment-detail-method'),
        fila.querySelector('.payment-detail-date'),
        fila.querySelector('.payment-detail-amount'),
        ...(fila.querySelector('.payment-detail-method').value === 'Transferencia'
          ? [fila.querySelector('.payment-detail-bank')]
          : [])
      ]).filter(campo => !campo.value.trim() || (campo.type === 'number' && !(Number(campo.value) > 0)));
      if (!clienteId || !state.clientes.some(cliente => cliente.id === clienteId && cliente.activo !== false)) {
        camposInvalidos.unshift(formularioPago.elements.clienteId);
      }
      if (!detalles.length) $('customerPaymentDetails').classList.add('has-required-error');
      mostrarErrorCamposObligatorios(formularioPago, camposInvalidos);
    }
    return;
  }

  const boton = $('btnSaveCustomerPayment');
  boton.disabled = true;
  error.hidden = true;
  let orden;
  try {
    orden = await crearOrdenPagoCliente(clienteId, detalles);
    state.ordenesPagoCliente.unshift(orden);
    paginaOrdenesPago = 1;
    cerrarModal(modalPago);
    renderClientes();
  } catch (cause) {
    error.textContent = `No se pudo generar la orden de pago: ${cause.message}`;
    error.hidden = false;
    return;
  } finally {
    boton.disabled = false;
  }
  try {
    imprimirOrden(orden);
  } catch (cause) {
    mostrarError(`La orden ${orden.numero} se guardó, pero no se pudo abrir la impresión: ${cause.message}`);
  }
}

function imprimirOrden(orden) {
  const cliente = state.clientes.find(item => item.id === orden.clienteId);
  $('printCustomerOrderDate').textContent = `Fecha: ${fechaHora(orden.creado)}`;
  $('printCustomerOrderNumber').textContent = `N° ${orden.numero}`;
  $('printCustomerName').textContent = cliente?.nombre || '';
  $('printCustomerCuit').textContent = cliente?.cuit || '';
  $('printCustomerDetails').innerHTML = orden.detalles.map(detalle => `<tr>
    <td>${esc(detalle.concepto || '—')}</td><td>${esc(detalle.medio)}</td>
    <td>${esc(fecha(detalle.fecha))}</td><td class="payment-amount">${dineroConCentavos(detalle.monto)}</td>
    <td>${esc(detalle.banco || '—')}</td>
  </tr>`).join('');
  $('printCustomerTotal').textContent = dineroConCentavos(orden.total);
  $('printCustomerOrder').hidden = false;
  document.body.classList.add('printing-customer-order');
  abrirDialogoImpresion(`Orden de pago ${orden.numero}`);
}
