import { calcular } from '../domain/liquidacion.js';
import { actualizarChofer, crearChofer, darDeBajaChofer } from '../services/catalogos.service.js';
import { crearOrdenRetiro } from '../services/retiros.service.js';
import { state } from '../state.js';
import { dineroConCentavos, esc, fecha, fechaHora, hoyISO } from '../lib/format.js';
import { mostrarError } from './componentes.js';
import { abrirDialogoImpresion } from './salida-orden.view.js';
import { obtenerPagina, renderizarPaginacion, textoRangoPagina } from './paginacion.js';
import { cuitDuplicado, esCuitValido, normalizarCuit } from '../domain/cuit.js';
import { limpiarErrorValidacion, mostrarErrorCamposObligatorios, mostrarErrorValidacion } from './validacion.js';

const $ = id => document.getElementById(id);
let modalChofer;
let modalRetiro;
let modalDetalleChofer;
let formularioChofer;
let formularioRetiro;
let choferEditandoId = null;
let choferDetalleId = null;
let paginaOrdenesRetiro = 1;

export function iniciarChoferes() {
  modalChofer = $('driverModal');
  modalRetiro = $('withdrawalModal');
  modalDetalleChofer = $('driverDetailModal');
  formularioChofer = $('driverForm');
  formularioRetiro = $('withdrawalForm');
  $('btnNewDriver').addEventListener('click', () => abrirChofer());
  $('btnNewWithdrawal').addEventListener('click', abrirRetiro);
  document.querySelectorAll('[data-close-driver-modal]').forEach(el => el.addEventListener('click', () => cerrarModal(modalChofer)));
  document.querySelectorAll('[data-close-withdrawal-modal]').forEach(el => el.addEventListener('click', () => cerrarModal(modalRetiro)));
  document.querySelectorAll('[data-close-driver-detail]').forEach(el => el.addEventListener('click', () => cerrarModal(modalDetalleChofer)));
  formularioChofer.addEventListener('submit', guardarChofer);
  formularioChofer.elements.cuit.addEventListener('input', () =>
    limpiarErrorValidacion(formularioChofer, formularioChofer.elements.cuit));
  formularioChofer.elements.camionId.addEventListener('change', () =>
    limpiarErrorValidacion(formularioChofer, formularioChofer.elements.camionId));
  formularioRetiro.elements.cuitTransportista.addEventListener('input', () =>
    limpiarErrorValidacion(formularioRetiro, formularioRetiro.elements.cuitTransportista));
  formularioRetiro.elements.choferId.addEventListener('change', actualizarOpcionesConceptoRetiro);
  $('withdrawalPaymentDetails').addEventListener('change', evento => {
    if (evento.target.matches('.withdrawal-payment-observation')) {
      actualizarConceptoGastoRetiro(evento.target.closest('.withdrawal-payment-detail'));
    }
  });
  $('driversBody').addEventListener('click', evento => {
    const fila = evento.target.closest('[data-driver-row]');
    if (fila) abrirDetalleChofer(Number(fila.dataset.driverRow));
  });
  $('btnEditDriver').addEventListener('click', () => {
    const chofer = state.choferes.find(item => item.id === choferDetalleId);
    if (!chofer) return;
    cerrarModal(modalDetalleChofer);
    abrirChofer(chofer);
  });
  $('btnDeleteDriver').addEventListener('click', darDeBajaChoferSeleccionado);
  formularioRetiro.addEventListener('submit', guardarRetiro);
  formularioRetiro.addEventListener('input', e => {
    if (e.target.matches('.withdrawal-payment-amount')) actualizarTotalMediosRetiro();
  });
  formularioRetiro.addEventListener('change', e => {
    if (e.target.matches('.withdrawal-payment-method')) actualizarCamposMedioRetiro(e.target.closest('.withdrawal-payment-detail'));
  });
  $('btnAddWithdrawalPayment').addEventListener('click', () => agregarMedioRetiro());
  $('withdrawalPaymentDetails').addEventListener('click', e => {
    if (!e.target.closest('[data-remove-withdrawal-payment]')) return;
    e.target.closest('.withdrawal-payment-detail').remove();
    actualizarTotalMediosRetiro();
  });
  $('withdrawalsBody').addEventListener('click', e => {
    const boton = e.target.closest('[data-print-order]');
    if (!boton) return;
    const orden = state.ordenesRetiro.find(item => String(item.id) === boton.dataset.printOrder);
    if (orden) imprimirOrden(orden);
  });
  $('withdrawalPagination').addEventListener('click', e => {
    const boton = e.target.closest('[data-withdrawal-page]');
    if (!boton || boton.disabled) return;
    paginaOrdenesRetiro = Number(boton.dataset.withdrawalPage);
    renderChoferes();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!modalDetalleChofer.hidden) cerrarModal(modalDetalleChofer);
      if (!modalChofer.hidden) cerrarModal(modalChofer);
      if (!modalRetiro.hidden) cerrarModal(modalRetiro);
    }
  });
  window.addEventListener('afterprint', () => {
    $('printOrder').hidden = true;
    $('printWithdrawalPayments').hidden = true;
    document.body.classList.remove('printing-withdrawal-order');
  });
}

function abrirChofer(chofer = null) {
  choferEditandoId = chofer?.id ?? null;
  formularioChofer.reset();
  const camionSeleccionadoId = chofer?.camionId ?? chofer?.camion?.id ?? null;
  const camionesAsignados = new Set(state.choferes
    .filter(item => Number(item.id) !== Number(choferEditandoId))
    .map(item => Number(item.camionId ?? item.camion?.id))
    .filter(Number.isFinite));
  const camionesDisponibles = state.camiones.filter(camion =>
    camion.activo !== false
    && (!camionesAsignados.has(Number(camion.id)) || Number(camion.id) === Number(camionSeleccionadoId))
  );
  const camionActual = chofer?.camion;
  if (camionActual && !camionesDisponibles.some(camion => Number(camion.id) === Number(camionActual.id))) {
    camionesDisponibles.push(camionActual);
  }
  formularioChofer.elements.camionId.innerHTML = '<option value="">Elegí una patente</option>'
    + camionesDisponibles
      .sort((a, b) => a.patente.localeCompare(b.patente, 'es'))
      .map(camion => `<option value="${camion.id}">${esc(camion.patente)}</option>`).join('');
  if (chofer) {
    formularioChofer.elements.nombre.value = chofer.nombre;
    formularioChofer.elements.cuit.value = chofer.cuit || '';
    formularioChofer.elements.telefono.value = chofer.telefono || '';
    formularioChofer.elements.camionId.value = camionSeleccionadoId || '';
  }
  $('driverFormError').hidden = true;
  $('driverModalTitle').textContent = chofer ? 'Editar chofer' : 'Agregar chofer';
  $('btnSaveDriver').textContent = chofer ? 'Guardar cambios' : 'Guardar chofer';
  modalChofer.hidden = false;
  document.body.classList.add('modal-open');
  formularioChofer.elements.nombre.focus();
}

function abrirRetiro() {
  const choferesActivos = state.choferes.filter(chofer => chofer.activo !== false);
  if (!choferesActivos.length) {
    mostrarError('Agregá al menos un chofer antes de generar una orden de retiro.');
    return;
  }
  formularioRetiro.reset();
  $('withdrawalFormError').hidden = true;
  const opciones = '<option value="">Elegí un chofer</option>'
    + choferesActivos.map(chofer => `<option value="${chofer.id}">${esc(chofer.nombre)}</option>`).join('');
  formularioRetiro.elements.choferId.innerHTML = opciones;
  formularioRetiro.elements.cuitTransportista.value = '';
  $('withdrawalPaymentDetails').replaceChildren();
  formularioRetiro.elements.choferId.value = '';
  agregarMedioRetiro();
  actualizarTotalMediosRetiro();
  modalRetiro.hidden = false;
  document.body.classList.add('modal-open');
  formularioRetiro.elements.recibidoDe.focus();
}

function cerrarModal(modal) {
  modal.hidden = true;
  if (!document.querySelector('.modal:not([hidden])')) document.body.classList.remove('modal-open');
}

async function guardarChofer(e) {
  e.preventDefault();
  const f = formularioChofer.elements;
  const camionId = Number(f.camionId.value);
  const camion = state.camiones.find(item => Number(item.id) === camionId)
    || state.choferes.find(item => Number(item.camionId ?? item.camion?.id) === camionId)?.camion
    || null;
  const datos = {
    nombre: f.nombre.value.trim(),
    cuit: normalizarCuit(f.cuit.value),
    telefono: f.telefono.value.trim(),
    camionId,
    camion
  };
  const error = $('driverFormError');
  if (!datos.nombre || !datos.cuit || !camion) {
    mostrarErrorCamposObligatorios(formularioChofer, [
      ...(!datos.nombre ? [f.nombre] : []),
      ...(!datos.cuit ? [f.cuit] : []),
      ...(!camion ? [f.camionId] : [])
    ]);
    return;
  }
  if (!esCuitValido(datos.cuit)) {
    mostrarErrorValidacion(formularioChofer, f.cuit, 'Ingresá un CUIT válido de 11 dígitos.');
    return;
  }
  if (cuitDuplicado(datos.cuit, state.choferes, state.clientes, 'chofer', choferEditandoId)) {
    mostrarErrorValidacion(formularioChofer, f.cuit, 'Ese CUIT ya está registrado en un cliente o chofer.');
    return;
  }
  const camionEnUso = state.choferes.some(item =>
    Number(item.id) !== Number(choferEditandoId)
    && Number(item.camionId ?? item.camion?.id) === camionId
  );
  if (camionEnUso) {
    mostrarErrorValidacion(formularioChofer, f.camionId, 'Ese camión ya está asignado a otro chofer.');
    return;
  }

  const boton = $('btnSaveDriver');
  boton.disabled = true;
  error.hidden = true;
  try {
    const chofer = choferEditandoId
      ? await actualizarChofer(choferEditandoId, datos)
      : await crearChofer(datos);
    const indice = state.choferes.findIndex(item => item.id === chofer.id);
    if (indice < 0) state.choferes.push(chofer);
    else state.choferes[indice] = chofer;
    state.viajes.filter(viaje => Number(viaje.choferId) === Number(chofer.id))
      .forEach(viaje => { viaje.chofer = { id: chofer.id, nombre: chofer.nombre, patente: chofer.patente, camion: chofer.camion }; });
    state.ordenesRetiro.filter(orden => orden.choferId === chofer.id)
      .forEach(orden => { orden.chofer = { id: chofer.id, nombre: chofer.nombre }; });
    state.choferes.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    choferEditandoId = null;
    cerrarModal(modalChofer);
    renderChoferes();
  } catch (cause) {
    const detalle = /column.*(cuit|telefono)|(?:cuit|telefono).*column|schema cache/i.test(cause.message)
      ? ' La base todavía no reconoce una columna del chofer. Ejecutá las migraciones pendientes de Supabase y actualizá el caché de API.'
      : '';
    error.textContent = `No se pudo guardar el chofer: ${cause.message}${detalle}`;
    error.hidden = false;
  } finally {
    boton.disabled = false;
  }
}

async function darDeBajaChoferSeleccionado() {
  const chofer = state.choferes.find(item => item.id === choferDetalleId);
  if (!chofer || !window.confirm(`¿Dar de baja a ${chofer.nombre}? Se conservará su historial de viajes y retiros.`)) return;

  const boton = $('btnDeleteDriver');
  boton.disabled = true;
  try {
    const actualizado = await darDeBajaChofer(chofer.id);
    Object.assign(chofer, actualizado);
    cerrarModal(modalDetalleChofer);
    renderChoferes();
  } catch (cause) {
    mostrarError(`No se pudo dar de baja al chofer: ${cause.message}`);
    boton.disabled = false;
  }
}

async function guardarRetiro(e) {
  e.preventDefault();
  const f = formularioRetiro.elements;
  const detallesPago = leerMediosRetiro();
  const importeRecibido = Math.round((detallesPago.reduce((suma, detalle) => suma + detalle.monto, 0) + Number.EPSILON) * 100) / 100;
  const datos = {
    recibidoDe: f.recibidoDe.value.trim(),
    choferId: Number(f.choferId.value),
    cuitTransportista: f.cuitTransportista.value.trim(),
    importeRecibido,
    detallesPago,
    total: importeRecibido
  };
  const error = $('withdrawalFormError');
  const detalleInvalido = !detallesPago.length || detallesPago.some(detalle =>
    !['Sueldo', 'Adelanto'].includes(detalle.observacion)
      && !/^Gasto Extra: .+$/.test(detalle.observacion)
    || !['Cheque', 'Transferencia', 'Efectivo'].includes(detalle.medio)
    || !detalle.fecha || !(detalle.monto > 0)
    || (detalle.medio === 'Cheque' && !detalle.numeroCheque)
    || (detalle.medio === 'Transferencia' && !detalle.banco));
  if (!datos.recibidoDe || !datos.choferId || !datos.cuitTransportista
    || detalleInvalido || !(datos.importeRecibido > 0)) {
    const camposInvalidos = [
      ...(!datos.recibidoDe ? [f.recibidoDe] : []),
      ...(!datos.choferId ? [f.choferId] : []),
      ...(!datos.cuitTransportista ? [f.cuitTransportista] : []),
      ...[...$('withdrawalPaymentDetails').querySelectorAll('.withdrawal-payment-detail')].flatMap(fila => [
        fila.querySelector('.withdrawal-payment-observation'),
        ...(fila.querySelector('.withdrawal-payment-observation').value === 'Gasto Extra'
          ? [fila.querySelector('.withdrawal-expense')]
          : []),
        fila.querySelector('.withdrawal-payment-method'),
        fila.querySelector('.withdrawal-payment-date'),
        fila.querySelector('.withdrawal-payment-amount'),
        ...(fila.querySelector('.withdrawal-payment-method').value === 'Cheque'
          ? [fila.querySelector('.withdrawal-payment-check-number')]
          : []),
        ...(fila.querySelector('.withdrawal-payment-method').value === 'Transferencia'
          ? [fila.querySelector('.withdrawal-payment-bank')]
          : [])
      ]).filter(campo => !campo.value.trim()
        || (campo.type === 'number' && !(Number(campo.value) > 0)))
    ];
    if (!detallesPago.length) $('withdrawalPaymentDetails').classList.add('has-required-error');
    mostrarErrorCamposObligatorios(formularioRetiro, camposInvalidos);
    return;
  }
  if (!esCuitValido(datos.cuitTransportista)) {
    mostrarErrorValidacion(formularioRetiro, f.cuitTransportista, 'Ingresá un CUIT válido de 11 dígitos.');
    return;
  }
  datos.cuitTransportista = normalizarCuit(datos.cuitTransportista);

  const boton = $('btnSaveWithdrawal');
  boton.disabled = true;
  error.hidden = true;
  let orden;
  try {
    orden = await crearOrdenRetiro(datos);
  } catch (cause) {
    error.textContent = `No se pudo generar la orden de retiro: ${cause.message}`;
    error.hidden = false;
    return;
  } finally {
    boton.disabled = false;
  }

  orden.chofer = state.choferes.find(chofer => chofer.id === orden.choferId);
  state.ordenesRetiro.unshift(orden);
  paginaOrdenesRetiro = 1;
  cerrarModal(modalRetiro);
  renderChoferes();
  try {
    imprimirOrden(orden);
  } catch (cause) {
    mostrarError(`La orden de retiro ${orden.numero} se guardó, pero no se pudo abrir la impresión: ${cause.message}`);
  }
}

let siguienteIdMedioRetiro = 0;

function agregarMedioRetiro(detalle = {}) {
  const indice = siguienteIdMedioRetiro++;
  const fila = document.createElement('div');
  fila.className = 'withdrawal-payment-detail';
  fila.innerHTML = `
    <div class="field"><label for="withdrawalPaymentObservation${indice}">Observación</label><select class="input withdrawal-payment-observation" id="withdrawalPaymentObservation${indice}" required><option value="">Elegí un concepto</option><option value="Sueldo">Sueldo</option><option value="Adelanto">Adelanto</option><option value="Gasto Extra">Gasto Extra</option></select></div>
    <div class="field withdrawal-expense-field" hidden><label for="withdrawalExpense${indice}">Gasto extra</label><select class="input withdrawal-expense" id="withdrawalExpense${indice}"></select></div>
    <div class="field"><label for="withdrawalPaymentMethod${indice}">Medio de pago</label><select class="input withdrawal-payment-method" id="withdrawalPaymentMethod${indice}" required><option value="">Elegir</option><option value="Cheque">Cheque</option><option value="Transferencia">Transferencia</option><option value="Efectivo">Efectivo</option></select></div>
    <div class="field withdrawal-payment-check-number-field" hidden><label for="withdrawalPaymentCheckNumber${indice}">N° cheque</label><input class="input withdrawal-payment-check-number" id="withdrawalPaymentCheckNumber${indice}" maxlength="50" value="${esc(detalle.numeroCheque || '')}" placeholder="Número de cheque"></div>
    <div class="field"><label for="withdrawalPaymentDate${indice}">Fecha</label><input class="input withdrawal-payment-date" id="withdrawalPaymentDate${indice}" type="date" value="${esc(detalle.fecha || hoyISO())}" required></div>
    <div class="field"><label for="withdrawalPaymentAmount${indice}">Monto ($)</label><input class="input withdrawal-payment-amount" id="withdrawalPaymentAmount${indice}" type="number" min="0.01" step="0.01" value="${detalle.monto ? Number(detalle.monto) : ''}" required></div>
    <div class="field"><label for="withdrawalPaymentBank${indice}">Banco</label><input class="input withdrawal-payment-bank" id="withdrawalPaymentBank${indice}" maxlength="100" value="${esc(detalle.banco || '')}"></div>
    <button class="icon-btn withdrawal-payment-remove" type="button" data-remove-withdrawal-payment aria-label="Quitar medio de pago"><svg class="ic"><use href="#i-close"/></svg></button>`;
  const observacion = fila.querySelector('.withdrawal-payment-observation');
  const observacionGuardada = detalle.observacion || detalle.concepto || '';
  if (/^Gasto Extra:\s*/i.test(observacionGuardada)) {
    observacion.value = 'Gasto Extra';
  } else {
    observacion.value = observacionGuardada;
  }
  actualizarSelectorGastoRetiro(fila);
  if (observacion.value === 'Gasto Extra') {
    fila.querySelector('.withdrawal-expense').value = observacionGuardada.replace(/^Gasto Extra:\s*/, '');
  }
  actualizarConceptoGastoRetiro(fila);
  fila.querySelector('.withdrawal-payment-method').value = detalle.medio || '';
  actualizarCamposMedioRetiro(fila);
  $('withdrawalPaymentDetails').append(fila);
  $('withdrawalPaymentDetails').classList.remove('has-required-error');
}

function actualizarSelectorGastoRetiro(fila) {
  const choferId = formularioRetiro.elements.choferId.value;
  const gastos = new Set(state.viajes
    .filter(viaje => Number(viaje.choferId) === Number(choferId))
    .flatMap(viaje => (viaje.gastosExtra || [])
      .filter(gasto => gasto.destino === 'chofer' && gasto.descripcion?.trim())
      .map(gasto => gasto.descripcion.trim())));
  const selector = fila.querySelector('.withdrawal-expense');
  const valor = selector.value;
  selector.innerHTML = '<option value="">Elegí un gasto extra</option>'
    + [...gastos].map(descripcion => `<option value="${esc(descripcion)}">${esc(descripcion)}</option>`).join('');
  selector.value = valor;
}

function actualizarOpcionesConceptoRetiro() {
  $('withdrawalPaymentDetails').querySelectorAll('.withdrawal-payment-detail').forEach(fila => {
    actualizarSelectorGastoRetiro(fila);
    actualizarConceptoGastoRetiro(fila);
  });
}

function actualizarConceptoGastoRetiro(fila) {
  const esGastoExtra = fila.querySelector('.withdrawal-payment-observation').value === 'Gasto Extra';
  const campoGasto = fila.querySelector('.withdrawal-expense-field');
  const selectorGasto = fila.querySelector('.withdrawal-expense');
  fila.classList.toggle('has-expense', esGastoExtra);
  campoGasto.hidden = !esGastoExtra;
  selectorGasto.required = esGastoExtra;
  if (!esGastoExtra) selectorGasto.value = '';
}

function actualizarCamposMedioRetiro(fila) {
  const medio = fila.querySelector('.withdrawal-payment-method').value;
  const esTransferencia = medio === 'Transferencia';
  const esCheque = medio === 'Cheque';
  const banco = fila.querySelector('.withdrawal-payment-bank');
  const numeroCheque = fila.querySelector('.withdrawal-payment-check-number');
  const campoNumeroCheque = fila.querySelector('.withdrawal-payment-check-number-field');
  banco.required = esTransferencia;
  banco.placeholder = esTransferencia ? 'Banco requerido' : 'Opcional';
  numeroCheque.required = esCheque;
  campoNumeroCheque.hidden = !esCheque;
  if (!esCheque) numeroCheque.value = '';
}

function leerMediosRetiro() {
  return [...$('withdrawalPaymentDetails').querySelectorAll('.withdrawal-payment-detail')].map(fila => {
    const categoria = fila.querySelector('.withdrawal-payment-observation').value;
    const gasto = fila.querySelector('.withdrawal-expense').value.trim();
    return {
      observacion: categoria === 'Gasto Extra' && gasto ? `Gasto Extra: ${gasto}` : categoria,
      medio: fila.querySelector('.withdrawal-payment-method').value,
      numeroCheque: fila.querySelector('.withdrawal-payment-check-number').value.trim(),
      fecha: fila.querySelector('.withdrawal-payment-date').value,
      monto: Number(fila.querySelector('.withdrawal-payment-amount').value),
      banco: fila.querySelector('.withdrawal-payment-bank').value.trim()
    };
  });
}

function actualizarTotalMediosRetiro() {
  const total = Math.round((leerMediosRetiro().reduce((suma, detalle) => suma + (Number(detalle.monto) || 0), 0) + Number.EPSILON) * 100) / 100;
  formularioRetiro.elements.total.value = total.toFixed(2);
}

function saldosPorChofer() {
  const saldos = new Map(state.choferes.map(chofer => [chofer.id, { generado: 0, viajes: 0, ajusteOrdenes: 0 }]));
  state.viajes.forEach(viaje => {
    const saldo = saldos.get(viaje.choferId);
    if (saldo) {
      saldo.generado += calcular(viaje).saldoChofer;
      saldo.viajes += 1;
    }
  });
  state.ordenesRetiro.forEach(orden => {
    const saldo = saldos.get(orden.choferId);
    if (!saldo) return;
    const detalles = Array.isArray(orden.detallesPago) && orden.detallesPago.length
      ? orden.detallesPago
      : [{ observacion: '', monto: orden.total }];
    detalles.forEach(detalle => {
      const monto = Number(detalle.monto) || 0;
      saldo.ajusteOrdenes -= monto;
    });
  });
  saldos.forEach(saldo => {
    saldo.generado = Math.round((saldo.generado + Number.EPSILON) * 100) / 100;
    saldo.ajusteOrdenes = Math.round((saldo.ajusteOrdenes + Number.EPSILON) * 100) / 100;
  });
  return saldos;
}

const disponibleDe = saldo => saldo
  ? Math.round((saldo.generado + saldo.ajusteOrdenes + Number.EPSILON) * 100) / 100
  : 0;

function abrirDetalleChofer(choferId) {
  const chofer = state.choferes.find(item => item.id === choferId && item.activo !== false);
  if (!chofer) return;
  choferDetalleId = chofer.id;
  const saldo = saldosPorChofer().get(chofer.id);
  $('driverDetailName').textContent = chofer.nombre || '—';
  $('driverDetailCuit').textContent = chofer.cuit || '—';
  $('driverDetailPhone').textContent = chofer.telefono || '—';
  $('driverDetailPlate').textContent = chofer.camion?.patente || chofer.patente || '—';
  $('driverDetailTrips').textContent = String(saldo?.viajes || 0);
  $('driverDetailAvailable').textContent = dineroConCentavos(disponibleDe(saldo));
  $('btnDeleteDriver').disabled = false;
  modalDetalleChofer.hidden = false;
  document.body.classList.add('modal-open');
  $('btnEditDriver').focus();
}

export function renderChoferes() {
  const saldos = saldosPorChofer();
  const choferesActivos = state.choferes.filter(chofer => chofer.activo !== false);
  $('driversBody').innerHTML = choferesActivos.length
    ? choferesActivos.map(chofer => {
      const saldo = saldos.get(chofer.id);
      const disponible = disponibleDe(saldo);
      return `<tr data-driver-row="${chofer.id}">
        <td data-label="Chofer"><button class="catalog-row-link" type="button">${esc(chofer.nombre)}</button></td><td data-label="CUIT">${esc(chofer.cuit || '—')}</td><td data-label="Teléfono">${esc(chofer.telefono || '—')}</td><td data-label="Patente del camión">${esc(chofer.camion?.patente || chofer.patente || '—')}</td>
        <td class="num" data-label="Viajes realizados">${saldo.viajes}</td>
        <td class="num" data-label="Saldo disponible"><strong>${dineroConCentavos(disponible)}</strong></td>
      </tr>`;
    }).join('')
    : '<tr><td class="empty-cell" colspan="6">Todavía no hay choferes. Agregá el primero para comenzar.</td></tr>';

  const ordenes = [...state.ordenesRetiro].sort((a, b) => Date.parse(b.creado) - Date.parse(a.creado));
  const paginaOrdenes = obtenerPagina(ordenes, paginaOrdenesRetiro);
  paginaOrdenesRetiro = paginaOrdenes.pagina;
  $('withdrawalCount').textContent = textoRangoPagina(paginaOrdenes, 'órdenes de retiro');
  renderizarPaginacion($('withdrawalPagination'), paginaOrdenes.pagina, paginaOrdenes.totalPaginas, 'withdrawal');
  $('withdrawalsBody').innerHTML = paginaOrdenes.total
    ? paginaOrdenes.elementos.map(orden => `<tr>
      <td data-label="Número">${esc(orden.numero)}</td><td data-label="Fecha">${esc(fechaHora(orden.creado))}</td>
      <td data-label="Chofer">${esc(orden.chofer?.nombre || '—')}</td><td class="num" data-label="Total">${dineroConCentavos(orden.total)}</td>
      <td class="table-actions" data-label="Imprimir"><div class="driver-actions">
        <button class="icon-btn" type="button" data-print-order="${orden.id}" aria-label="Imprimir orden ${esc(orden.numero)}" title="Imprimir"><svg class="ic" aria-hidden="true" viewBox="0 0 24 24"><path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M7 14h10v7H7zM17 11h.01"/></svg></button>
      </div></td>
    </tr>`).join('')
    : '<tr><td class="empty-cell" colspan="5">Todavía no hay órdenes de retiro registradas.</td></tr>';
}

function imprimirOrden(orden) {
  $('printOrderNumber').textContent = `Orden N° ${orden.numero}`;
  $('printReceivedFrom').textContent = orden.recibidoDe || '';
  $('printReceivedAmount').textContent = dineroConCentavos(orden.importeRecibido);
  $('printTransporterCuit').textContent = orden.cuitTransportista;
  $('printDriver').textContent = orden.chofer?.nombre || '';
  $('printTotal').textContent = dineroConCentavos(orden.total);
  const detallesPago = Array.isArray(orden.detallesPago) ? orden.detallesPago : [];
  $('printWithdrawalPayments').hidden = !detallesPago.length;
  $('printWithdrawalPaymentDetails').innerHTML = detallesPago.map(detalle => `<tr>
    <td>${esc(detalle.observacion || detalle.concepto || '—')}</td>
    <td>${esc(detalle.medio || '—')}</td>
    <td>${esc(detalle.numeroCheque || '—')}</td>
    <td>${esc(fecha(detalle.fecha))}</td>
    <td class="payment-amount">${dineroConCentavos(detalle.monto)}</td>
    <td>${esc(detalle.banco || '—')}</td>
  </tr>`).join('');
  $('printWithdrawalPaymentTotal').textContent = dineroConCentavos(orden.importeRecibido);
  $('printOrder').hidden = false;
  document.body.classList.add('printing-withdrawal-order');
  abrirDialogoImpresion(`Orden de retiro ${orden.numero}`);
}
