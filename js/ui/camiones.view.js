import { actualizarCamion, crearCamion, darDeBajaCamion } from '../services/catalogos.service.js';
import { state } from '../state.js';
import { esc } from '../lib/format.js';
import { mostrarError } from './componentes.js';
import { mostrarErrorCamposObligatorios } from './validacion.js';

const $ = id => document.getElementById(id);
let modalCamion;
let modalDetalleCamion;
let formularioCamion;
let camionEditandoId = null;
let camionDetalleId = null;

export function iniciarCamiones() {
  modalCamion = $('truckModal');
  modalDetalleCamion = $('truckDetailModal');
  formularioCamion = $('truckForm');
  $('btnNewTruck').addEventListener('click', () => abrirCamion());
  formularioCamion.addEventListener('submit', guardarCamion);
  $('trucksBody').addEventListener('click', evento => {
    const fila = evento.target.closest('[data-truck-row]');
    if (fila) abrirDetalleCamion(Number(fila.dataset.truckRow));
  });
  $('btnEditTruck').addEventListener('click', () => {
    const camion = state.camiones.find(item => item.id === camionDetalleId);
    if (!camion) return;
    cerrarModal(modalDetalleCamion);
    abrirCamion(camion);
  });
  $('btnDeleteTruck').addEventListener('click', darDeBajaCamionSeleccionado);
  document.querySelectorAll('[data-close-truck-modal]').forEach(el =>
    el.addEventListener('click', () => cerrarModal(modalCamion)));
  document.querySelectorAll('[data-close-truck-detail]').forEach(el =>
    el.addEventListener('click', () => cerrarModal(modalDetalleCamion)));
  document.addEventListener('keydown', evento => {
    if (evento.key !== 'Escape') return;
    if (!modalDetalleCamion.hidden) cerrarModal(modalDetalleCamion);
    if (!modalCamion.hidden) cerrarModal(modalCamion);
  });
}

function abrirCamion(camion = null) {
  camionEditandoId = camion?.id ?? null;
  formularioCamion.reset();
  if (camion) {
    formularioCamion.elements.patente.value = camion.patente || '';
    formularioCamion.elements.marca.value = camion.marca || '';
    formularioCamion.elements.modelo.value = camion.modelo || '';
  }
  $('truckFormError').hidden = true;
  $('truckModalTitle').textContent = camion ? 'Editar camión' : 'Agregar camión';
  $('btnSaveTruck').textContent = camion ? 'Guardar cambios' : 'Guardar camión';
  modalCamion.hidden = false;
  document.body.classList.add('modal-open');
  formularioCamion.elements.patente.focus();
}

function abrirDetalleCamion(camionId) {
  const camion = state.camiones.find(item => item.id === camionId && item.activo !== false);
  if (!camion) return;
  camionDetalleId = camion.id;
  $('truckDetailPlate').textContent = camion.patente || '—';
  $('truckDetailMake').textContent = camion.marca || '—';
  $('truckDetailModel').textContent = camion.modelo || '—';
  $('btnDeleteTruck').disabled = false;
  modalDetalleCamion.hidden = false;
  document.body.classList.add('modal-open');
  $('btnEditTruck').focus();
}

function cerrarModal(modal) {
  modal.hidden = true;
  if (!document.querySelector('.modal:not([hidden])')) document.body.classList.remove('modal-open');
}

function actualizarReferenciasCamion(camion) {
  state.choferes.forEach(chofer => {
    if (Number(chofer.camionId ?? chofer.camion?.id) !== Number(camion.id)) return;
    chofer.camionId = camion.id;
    chofer.camion = { id: camion.id, patente: camion.patente, marca: camion.marca, modelo: camion.modelo };
    chofer.patente = camion.patente;
  });
  state.viajes.forEach(viaje => {
    if (Number(viaje.camionId ?? viaje.camion?.id) !== Number(camion.id)) return;
    viaje.camionId = camion.id;
    viaje.camion = { id: camion.id, patente: camion.patente, marca: camion.marca, modelo: camion.modelo };
  });
}

async function guardarCamion(evento) {
  evento.preventDefault();
  const f = formularioCamion.elements;
  const datos = {
    patente: f.patente.value.trim().toUpperCase(),
    marca: f.marca.value.trim(),
    modelo: f.modelo.value.trim()
  };
  const normalizarPatente = patente => patente.replace(/[^A-Z0-9]/g, '');
  if (!datos.patente) {
    mostrarErrorCamposObligatorios(formularioCamion, [f.patente]);
    return;
  }
  if (state.camiones.some(camion =>
    Number(camion.id) !== Number(camionEditandoId)
    && normalizarPatente(String(camion.patente || '').toLocaleUpperCase('es-AR')) === normalizarPatente(datos.patente)
  )) {
    f.patente.setAttribute('aria-invalid', 'true');
    f.patente.closest('.field').classList.add('has-required-error');
    $('truckFormError').textContent = 'Ya existe un camión con esa patente.';
    $('truckFormError').hidden = false;
    return;
  }

  const boton = $('btnSaveTruck');
  boton.disabled = true;
  $('truckFormError').hidden = true;
  try {
    const camion = camionEditandoId
      ? await actualizarCamion(camionEditandoId, datos)
      : await crearCamion(datos);
    const indice = state.camiones.findIndex(item => Number(item.id) === Number(camion.id));
    if (indice < 0) state.camiones.push(camion);
    else state.camiones[indice] = camion;
    state.camiones.sort((a, b) => a.patente.localeCompare(b.patente, 'es'));
    actualizarReferenciasCamion(camion);
    camionEditandoId = null;
    cerrarModal(modalCamion);
    renderCamiones();
  } catch (cause) {
    $('truckFormError').textContent = `No se pudo guardar el camión: ${cause.message}`;
    $('truckFormError').hidden = false;
  } finally {
    boton.disabled = false;
  }
}

async function darDeBajaCamionSeleccionado() {
  const camion = state.camiones.find(item => Number(item.id) === Number(camionDetalleId));
  if (!camion || !window.confirm(`¿Dar de baja el camión ${camion.patente}? Se conservará en el historial.`)) return;

  const boton = $('btnDeleteTruck');
  boton.disabled = true;
  try {
    const actualizado = await darDeBajaCamion(camion.id);
    Object.assign(camion, actualizado);
    cerrarModal(modalDetalleCamion);
    renderCamiones();
  } catch (cause) {
    mostrarError(`No se pudo dar de baja el camión: ${cause.message}`);
    boton.disabled = false;
  }
}

export function renderCamiones() {
  const camiones = state.camiones.filter(camion => camion.activo !== false);
  $('trucksBody').innerHTML = camiones.length
    ? camiones.map(camion => `<tr data-truck-row="${camion.id}">
        <td data-label="Patente"><button class="catalog-row-link" type="button">${esc(camion.patente)}</button></td>
        <td data-label="Marca">${esc(camion.marca || '—')}</td>
        <td data-label="Modelo">${esc(camion.modelo || '—')}</td>
      </tr>`).join('')
    : '<tr><td class="empty-cell" colspan="3">Todavía no hay camiones. Agregá el primero para comenzar.</td></tr>';
}
