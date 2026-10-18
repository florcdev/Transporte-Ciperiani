import { calcular } from './liquidacion.js';
import { grupoEstado } from './estados.js';

const CAMPOS = ['bruto', 'comision', 'subtotal', 'chofer', 'adelanto', 'gastosChofer', 'saldoChofer'];

const filaVacia = nombre => ({
  nombre, viajes: 0, toneladas: 0, bruto: 0, comision: 0, subtotal: 0,
  chofer: 0, adelanto: 0, gastosChofer: 0, saldoChofer: 0
});

function sumar(fila, viaje) {
  const c = calcular(viaje);
  fila.viajes += 1;
  fila.toneladas += viaje.toneladas;
  CAMPOS.forEach(k => { fila[k] += c[k]; });
  return fila;
}

/** Una sola fila con los totales de todos los viajes recibidos. */
export function totalizar(viajes, nombre = 'Total') {
  return viajes.reduce((fila, v) => sumar(fila, v), filaVacia(nombre));
}

const CLAVES = {
  camion: v => {
    const patente = v.camion?.patente || 'Sin patente';
    const modelo = [v.camion?.marca, v.camion?.modelo].filter(Boolean).join(' ');
    return [v.camionId ?? patente, modelo ? `${patente} · ${modelo}` : patente];
  },
  chofer: v => [v.choferId, v.chofer.nombre]
};

/** modo: 'general' | 'camion' | 'chofer'. Devuelve una fila por grupo. */
export function resumir(viajes, modo) {
  if (modo === 'general') return [totalizar(viajes, 'Todos los viajes')];

  const grupos = new Map();
  for (const v of viajes) {
    const [id, nombre] = CLAVES[modo](v);
    if (!grupos.has(id)) grupos.set(id, filaVacia(nombre));
    sumar(grupos.get(id), v);
  }
  return [...grupos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/** Deja solo los viajes de un camión o chofer (id vacío = todos). */
export function filtrarEntidad(viajes, modo, id) {
  if (modo === 'general' || !id) return viajes;
  const campo = modo === 'camion' ? 'camionId' : 'choferId';
  return viajes.filter(v => Number(v[campo]) === Number(id));
}

/** Suma de subtotales por estado: { pagado, proceso, espera }. */
export function totalesPorGrupo(viajes) {
  const t = { pagado: 0, proceso: 0, espera: 0 };
  viajes.forEach(v => { t[grupoEstado(v)] += calcular(v).saldoChofer; });
  return t;
}

const TRAMOS = [['1–7', 7], ['8–14', 14], ['15–21', 21], ['22–31', 31]];

/** Subtotales por tramo del mes y por estado, en pesos. */
export function porTramo(viajes) {
  const tramos = TRAMOS.map(([etiqueta]) => ({ etiqueta, pagado: 0, proceso: 0, espera: 0 }));
  for (const v of viajes) {
    const dia = Number(v.fecha.slice(8, 10));
    const i = TRAMOS.findIndex(([, hasta]) => dia <= hasta);
    tramos[i][grupoEstado(v)] += calcular(v).subtotal;
  }
  return tramos;
}