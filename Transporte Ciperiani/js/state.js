import { listarViajes } from './services/viajes.service.js';
import { listarCamiones, listarChoferes, listarClientes } from './services/catalogos.service.js';
import { listarOrdenesRetiro } from './services/retiros.service.js';
import { listarOrdenesPagoCliente } from './services/clientes.service.js';
import { listarRecibosEfectivo } from './services/recibos.service.js';

export const state = {
  viajes: [], camiones: [], choferes: [], clientes: [], recibosEfectivo: [],
  ordenesRetiro: [], ordenesPagoCliente: [], resumenesCuenta: []
};

const masReciente = (a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id;

export async function cargarDatos() {
  const [viajes, camiones, choferes, clientes, ordenesRetiro, ordenesPagoCliente, recibosEfectivo] = await Promise.all([
    listarViajes(), listarCamiones(), listarChoferes(), listarClientes(),
    listarOrdenesRetiro(), listarOrdenesPagoCliente(), listarRecibosEfectivo()
  ]);
  Object.assign(state, { viajes, camiones, choferes, clientes, ordenesRetiro, ordenesPagoCliente, recibosEfectivo });
}

export function vaciarDatos() {
  Object.assign(state, {
    viajes: [], camiones: [], choferes: [], clientes: [], recibosEfectivo: [],
    ordenesRetiro: [], ordenesPagoCliente: [], resumenesCuenta: []
  });
}

/** Inserta o reemplaza un viaje ya guardado en la base. */
export function guardarViaje(viaje) {
  const i = state.viajes.findIndex(v => v.id === viaje.id);
  if (i >= 0) state.viajes[i] = viaje;
  else state.viajes.push(viaje);
  state.viajes.sort(masReciente);
}