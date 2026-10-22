import { state, guardarViaje } from '../state.js';
import { crearViaje, actualizarViaje } from '../services/viajes.service.js';
import { calcular, GANANCIA_CHOFER_POR_DEFECTO } from '../domain/liquidacion.js';
import { ESTADOS } from '../domain/estados.js';
import { dinero, esc } from '../lib/format.js';

const $ = id => document.getElementById(id);
const CAMPOS = ['fecha', 'origen', 'destino', 'clienteId', 'camionId', 'choferId', 'ctg', 'toneladas', 'tarifa', 'comisionPct', 'gananciaChoferPct', 'adelanto', 'estado'];

let modal, form, error, alGuardar;
let editandoId = null;
let siguienteIdGasto = 0;

export function iniciarFormulario({ onGuardado }) {
  modal = $('tripModal');
  form = $('tripForm');
  error = $('tripFormError');
  alGuardar = onGuardado;

  document.querySelectorAll('[data-close-modal]').forEach(el => el.addEventListener('click', cerrar));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) cerrar(); });
  form.addEventListener('input', actualizarCalculo);
  form.addEventListener('change', e => {
    if (e.target.name === 'estado') {
      actualizarIndicadoresPrioritarios();
      return;
    }
    if (e.target.name === 'pagado') {
      actualizarIndicadoresPrioritarios();
      return;
    }
    if (e.target.name === 'choferId') {
      asignarPatenteDelChofer();
      return;
    }
    if (!e.target.matches('.expense-destination')) return;
    const fila = e.target.closest('.trip-expense');
    const esCliente = e.target.value === 'cliente';
    fila.querySelector('.expense-customer-field').hidden = !esCliente;
    if (!esCliente) fila.querySelector('.expense-customer').value = '';
    actualizarCalculo();
  });
  $('btnAddExpense').addEventListener('click', () => {
    agregarGasto();
    actualizarCalculo();
  });
  $('tripExpenses').addEventListener('click', e => {
    if (!e.target.closest('[data-remove-expense]')) return;
    e.target.closest('.trip-expense').remove();
    actualizarCalculo();
  });
  form.addEventListener('submit', guardar);
}

const opciones = (lista, texto) => lista.map(x => `<option value="${x.id}">${esc(texto(x))}</option>`).join('');

/** Sin argumento abre un viaje nuevo; con un viaje, lo edita. */
export function abrirFormulario(viaje = null) {
  editandoId = viaje?.id ?? null;
  form.reset();
  error.hidden = true;
  $('tripModalTitle').textContent = viaje ? `Editar viaje ${viaje.codigo}` : 'Nuevo viaje';

  const camionesActivos = new Set(state.camiones
    .filter(camion => camion.activo !== false)
    .map(camion => Number(camion.id)));
  const choferesDisponibles = state.choferes.filter(chofer => {
    const camionId = Number(chofer.camionId ?? chofer.camion?.id);
    return (chofer.activo !== false && camionesActivos.has(camionId))
      || Number(chofer.id) === Number(viaje?.choferId);
  });
  form.elements.choferId.innerHTML = '<option value="">Elegí un chofer</option>'
    + opciones(choferesDisponibles, c => c.nombre);
  const clientesDisponibles = state.clientes.filter(cliente =>
    cliente.activo !== false || Number(cliente.id) === Number(viaje?.clienteId)
  );
  form.elements.clienteId.innerHTML = '<option value="">Elegí un cliente</option>'
    + opciones(clientesDisponibles, cliente => cliente.nombre);
  form.elements.estado.innerHTML = Object.entries(ESTADOS)
    .map(([valor, texto]) => `<option value="${valor}">${texto}</option>`).join('');

  const v = viaje ?? {
    fecha: '', origen: '', destino: '', clienteId: '', camionId: '', choferId: '', ctg: '',
    toneladas: '', tarifa: '', comisionPct: '',
    gananciaChoferPct: GANANCIA_CHOFER_POR_DEFECTO, adelanto: '',
    estado: 'EN_PROCESO', pagado: false
  };
  CAMPOS.forEach(nombre => {
    form.elements[nombre].value = nombre === 'gananciaChoferPct'
      ? v[nombre] ?? (viaje ? '' : GANANCIA_CHOFER_POR_DEFECTO)
      : v[nombre] ?? '';
  });
  const chofer = state.choferes.find(item => Number(item.id) === Number(v.choferId));
  const camionId = v.camionId ?? v.camion?.id ?? chofer?.camionId ?? chofer?.camion?.id ?? '';
  form.elements.camionId.value = camionId;
  form.elements.camionPatente.value = v.camion?.patente || chofer?.camion?.patente || chofer?.patente || '';
  $('f-camion-help').textContent = form.elements.camionPatente.value
    ? `Patente asignada al chofer${chofer ? ` ${chofer.nombre}` : ''}.`
    : 'La asignación de camión es opcional.';
  form.elements.pagado.checked = v.pagado;
  actualizarAyudaCamion(chofer);
  actualizarIndicadoresPrioritarios();
  $('tripExpenses').innerHTML = '';
  (v.gastosExtra || []).forEach(agregarGasto);

  modal.hidden = false;
  document.body.classList.add('modal-open');
  actualizarCalculo();
  form.elements.origen.focus();
}

function cerrar() {
  modal.hidden = true;
  document.body.classList.remove('modal-open');
  editandoId = null;
}

function leer() {
  const f = form.elements;
  const gastosExtra = [...$('tripExpenses').querySelectorAll('.trip-expense')].map(fila => ({
    descripcion: fila.querySelector('.expense-description').value.trim(),
    monto: Number(fila.querySelector('.expense-amount').value),
    destino: fila.querySelector('.expense-destination').value,
    clienteId: Number(fila.querySelector('.expense-customer').value) || null
  })).filter(gasto => gasto.descripcion || gasto.monto || gasto.destino);
  return {
    fecha: f.fecha.value || null,
    origen: f.origen.value.trim(),
    destino: f.destino.value.trim(),
    clienteId: Number(f.clienteId.value) || null,
    camionId: Number(f.camionId.value) || null,
    choferId: Number(f.choferId.value) || null,
    ctg: f.ctg.value.trim() || null,
    toneladas: numeroOpcional(f.toneladas.value),
    tarifa: numeroOpcional(f.tarifa.value),
    comisionPct: numeroOpcional(f.comisionPct.value),
    gananciaChoferPct: numeroOpcional(f.gananciaChoferPct.value),
    adelanto: numeroOpcional(f.adelanto.value),
    estado: f.estado.value,
    pagado: f.pagado.checked,
    gastosExtra
  };
}

const numeroOpcional = valor => valor === '' ? null : Number(valor);

function asignarPatenteDelChofer() {
  const idChofer = Number(form.elements.choferId.value);
  const chofer = state.choferes.find(item => Number(item.id) === idChofer);
  const camionId = chofer?.camionId ?? chofer?.camion?.id ?? '';
  form.elements.camionId.value = camionId;
  form.elements.camionPatente.value = chofer?.camion?.patente || chofer?.patente || '';
  actualizarAyudaCamion(chofer);
  actualizarCalculo();
}

function actualizarAyudaCamion(chofer = null) {
  const patente = form.elements.camionPatente.value.trim();
  const ayuda = $('f-camion-help');
  ayuda.textContent = patente
    ? `Patente asignada al chofer${chofer ? ` ${chofer.nombre}` : ''}: ${patente}.`
    : 'Elegí un chofer para ver su patente asignada.';
}

function actualizarIndicadoresPrioritarios() {
  const estado = form.elements.estado.value;
  const controlEstado = $('tripStatusControl');
  controlEstado.classList.remove('status-wait', 'status-process', 'status-finished');
  controlEstado.classList.add({
    EN_ESPERA: 'status-wait',
    EN_PROCESO: 'status-process',
    FINALIZADO: 'status-finished'
  }[estado] || 'status-wait');

  const controlPago = $('tripPaidControl');
  controlPago.classList.toggle('is-paid', form.elements.pagado.checked);
  controlPago.classList.toggle('is-unpaid', !form.elements.pagado.checked);
  $('tripPaidLabel').textContent = form.elements.pagado.checked ? 'Pagado' : 'Sin pagar';
}

function esInvalido(v) {
  const f = form.elements;
  const gastoIncompleto = [...$('tripExpenses').querySelectorAll('.trip-expense')].some(fila => {
    const descripcion = fila.querySelector('.expense-description').value.trim();
    const monto = fila.querySelector('.expense-amount').value;
    const destino = fila.querySelector('.expense-destination').value;
    const cliente = fila.querySelector('.expense-customer').value;
    if (!descripcion && !monto && !destino && !cliente) return false;
    return !descripcion || !(Number(monto) > 0) || !['chofer', 'cliente'].includes(destino)
      || (destino === 'cliente' && !state.clientes.some(item => Number(item.id) === Number(cliente)));
  });
  return (v.clienteId && !state.clientes.some(cliente => Number(cliente.id) === v.clienteId))
    || (f.toneladas.value !== '' && !(v.toneladas > 0))
    || (f.tarifa.value !== '' && !(v.tarifa >= 0))
    || (f.comisionPct.value !== '' && !(v.comisionPct >= 0 && v.comisionPct <= 100))
    || (f.gananciaChoferPct.value !== '' && !(v.gananciaChoferPct >= 0 && v.gananciaChoferPct <= 100))
    || (f.adelanto.value !== '' && !(v.adelanto >= 0))
    || gastoIncompleto;
}

function agregarGasto(gasto = {}) {
  const indice = siguienteIdGasto++;
  const fila = document.createElement('div');
  fila.className = 'trip-expense';
  fila.innerHTML = `
    <div class="field"><label for="expenseDescription${indice}">Descripción</label><input class="input expense-description" id="expenseDescription${indice}" value="${esc(gasto.descripcion || '')}" maxlength="160"></div>
    <div class="field"><label for="expenseAmount${indice}">Monto ($)</label><input class="input expense-amount" id="expenseAmount${indice}" type="number" min="0.01" step="0.01" inputmode="decimal" value="${gasto.monto ? Number(gasto.monto) : ''}"></div>
    <div class="field"><label for="expenseDestination${indice}">Corresponde a</label><select class="input expense-destination" id="expenseDestination${indice}"><option value="">Elegir</option><option value="chofer">Chofer</option><option value="cliente">Cliente</option></select></div>
    <div class="field expense-customer-field" hidden><label for="expenseCustomer${indice}">Cliente</label><select class="input expense-customer" id="expenseCustomer${indice}"></select></div>
    <button class="icon-btn expense-remove" type="button" data-remove-expense aria-label="Quitar gasto"><svg class="ic"><use href="#i-close"/></svg></button>`;
  const selectorCliente = fila.querySelector('.expense-customer');
  const clientesDisponibles = state.clientes.filter(cliente =>
    cliente.activo !== false || Number(cliente.id) === Number(gasto.clienteId)
  );
  selectorCliente.innerHTML = '<option value="">Elegí un cliente</option>'
    + clientesDisponibles.map(cliente => `<option value="${cliente.id}">${esc(cliente.nombre)}</option>`).join('');
  fila.querySelector('.expense-destination').value = gasto.destino || '';
  selectorCliente.value = gasto.clienteId || '';
  fila.querySelector('.expense-customer-field').hidden = gasto.destino !== 'cliente';
  $('tripExpenses').append(fila);
}

function actualizarCalculo() {
  const datos = leer();
  const c = calcular(datos);
  $('formBruto').textContent = dinero(c.bruto);
  $('formComision').textContent = dinero(c.comision);
  $('formSubtotal').textContent = dinero(c.subtotal);
  $('formChofer').textContent = dinero(c.chofer);
  $('formAdvance').textContent = dinero(c.adelanto);
  $('formDriverExpenses').textContent = dinero(c.gastosChofer);
  $('formClientExpenses').textContent = dinero(c.gastosCliente);
  $('formTripTotal').textContent = dinero(c.totalViaje);
  $('formTotal').textContent = dinero(c.saldoChofer);
  const porcentajeChofer = form.elements.gananciaChoferPct.value;
  $('formDriverShareLabel').textContent = `Parte del chofer (${porcentajeChofer === '' ? GANANCIA_CHOFER_POR_DEFECTO : porcentajeChofer}%)`;
}

async function guardar(e) {
  e.preventDefault();
  const datos = leer();

  if (esInvalido(datos)) {
    const camposInvalidos = [];
    const f = form.elements;
    if (datos.clienteId && !state.clientes.some(cliente => Number(cliente.id) === datos.clienteId)) camposInvalidos.push(f.clienteId);
    if (f.toneladas.value !== '' && !(datos.toneladas > 0)) camposInvalidos.push(f.toneladas);
    if (f.tarifa.value !== '' && !(datos.tarifa >= 0)) camposInvalidos.push(f.tarifa);
    if (f.comisionPct.value !== '' && !(datos.comisionPct >= 0 && datos.comisionPct <= 100)) camposInvalidos.push(f.comisionPct);
    if (f.gananciaChoferPct.value !== '' && !(datos.gananciaChoferPct >= 0 && datos.gananciaChoferPct <= 100)) camposInvalidos.push(f.gananciaChoferPct);
    if (f.adelanto.value !== '' && !(datos.adelanto >= 0)) camposInvalidos.push(f.adelanto);
    [...$('tripExpenses').querySelectorAll('.trip-expense')].forEach(fila => {
      const descripcion = fila.querySelector('.expense-description');
      const monto = fila.querySelector('.expense-amount');
      const destino = fila.querySelector('.expense-destination');
      const cliente = fila.querySelector('.expense-customer');
      if (!descripcion.value.trim() && !monto.value && !destino.value && !cliente.value) return;
      if (!descripcion.value.trim() || !(Number(monto.value) > 0) || !['chofer', 'cliente'].includes(destino.value)) {
        camposInvalidos.push(descripcion, monto, destino);
      }
      if (destino.value === 'cliente' && (!cliente.value || !state.clientes.some(item => item.id === Number(cliente.value)))) {
        camposInvalidos.push(cliente);
      }
    });
    form.querySelectorAll('[aria-invalid="true"]').forEach(campo => {
      campo.removeAttribute('aria-invalid');
      campo.closest('.field')?.classList.remove('has-required-error');
    });
    camposInvalidos.forEach(campo => {
      campo.setAttribute('aria-invalid', 'true');
      campo.closest('.field')?.classList.add('has-required-error');
    });
    error.textContent = 'Revisá los valores ingresados. Los campos numéricos deben respetar los rangos indicados y cada gasto extra debe estar completo.';
    error.hidden = false;
    return;
  }

  const boton = $('btnSaveTrip');
  boton.disabled = true;
  try {
    const guardado = editandoId ? await actualizarViaje(editandoId, datos) : await crearViaje(datos);
    guardarViaje(guardado);
    cerrar();
    alGuardar(guardado);
  } catch (err) {
    error.textContent = `No se pudo guardar el viaje: ${err.message}`;
    error.hidden = false;
  } finally {
    boton.disabled = false;
  }
}