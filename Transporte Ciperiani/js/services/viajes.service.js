import { supabase } from '../lib/supabase.js';

const SELECT = '*, camion:camiones(id, patente, marca, modelo), chofer:choferes(id, nombre, patente, camion_id, camion:camiones(id, patente, marca, modelo)), cliente:clientes(id, nombre)';

/** Fila de la base -> modelo que usa la aplicación. */
const aModelo = r => {
  const camion = r.camion || r.chofer?.camion || {
    id: null,
    patente: r.chofer?.patente || '',
    marca: '',
    modelo: ''
  };
  return {
    id: r.id,
    codigo: r.codigo,
    fecha: r.fecha,
    origen: r.origen,
    destino: r.destino,
    ctg: r.ctg ?? '',
    camionId: r.camion_id ?? r.camion?.id ?? r.chofer?.camion_id ?? r.chofer?.camion?.id ?? null,
    choferId: r.chofer_id,
    camion,
    chofer: r.chofer,
    clienteId: r.cliente_id ?? r.cliente?.id ?? null,
    cliente: r.cliente ?? null,
    toneladas: Number(r.toneladas),
    tarifa: Number(r.tarifa),
    comisionPct: Number(r.comision_porcentaje),
    gananciaChoferPct: Number(r.ganancia_chofer_porcentaje ?? 15),
    adelanto: Number(r.adelanto),
    gastosExtra: r.gastos_extra ?? [],
    estado: r.estado,
    pagado: r.estado_pago === 'PAGADO',
    fechaPago: r.fecha_pago
  };
};

/** Modelo -> columnas editables. fecha_pago la completa un trigger en la base. */
const aFila = v => ({
  fecha: v.fecha,
  origen: v.origen,
  destino: v.destino,
  ctg: v.ctg || null,
  camion_id: v.camionId,
  chofer_id: v.choferId,
  cliente_id: v.clienteId,
  toneladas: v.toneladas,
  tarifa: v.tarifa,
  comision_porcentaje: v.comisionPct,
  ganancia_chofer_porcentaje: v.gananciaChoferPct,
  adelanto: v.adelanto,
  gastos_extra: v.gastosExtra,
  estado: v.estado,
  estado_pago: v.pagado ? 'PAGADO' : 'PENDIENTE'
});

function resolver({ data, error }) {
  if (error) throw error;
  return data;
}

export async function listarViajes() {
  const data = resolver(await supabase
    .from('viajes')
    .select(SELECT)
    .order('fecha', { ascending: false })
    .order('id', { ascending: false }));
  return data.map(aModelo);
}

export async function crearViaje(viaje) {
  return aModelo(resolver(await supabase.from('viajes').insert(aFila(viaje)).select(SELECT).single()));
}

export async function actualizarViaje(id, viaje) {
  return aModelo(resolver(await supabase.from('viajes').update(aFila(viaje)).eq('id', id).select(SELECT).single()));
}

export async function marcarPagado(id, pagado) {
  return aModelo(resolver(await supabase
    .from('viajes')
    .update({ estado_pago: pagado ? 'PAGADO' : 'PENDIENTE' })
    .eq('id', id)
    .select(SELECT)
    .single()));
}