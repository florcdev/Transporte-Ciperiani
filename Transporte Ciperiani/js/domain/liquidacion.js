/**
 * Reglas de liquidación del cliente. Es el ÚNICO lugar donde viven las cuentas.
 *
 *   bruto    = toneladas × tarifa
 *   comisión = bruto × comisión%          (lo que descuenta el transporte)
 *   subtotal = bruto − comisión
 *   chofer   = subtotal × gananciaChofer% (lo que gana el chofer)
 *   saldo    = chofer − adelanto (negativo si el adelanto supera su parte)
 */
export const GANANCIA_CHOFER_POR_DEFECTO = 15;

const redondear = n => Math.round((n + Number.EPSILON) * 100) / 100;

export function calcular({
  toneladas,
  tarifa,
  comisionPct,
  gananciaChoferPct = GANANCIA_CHOFER_POR_DEFECTO,
  adelanto = 0,
  gastosExtra = []
}) {
  const bruto = redondear((Number(toneladas) || 0) * (Number(tarifa) || 0));
  const comision = redondear(bruto * (Number(comisionPct) || 0) / 100);
  const subtotal = redondear(bruto - comision);
  const porcentajeChofer = Number(gananciaChoferPct);
  const chofer = redondear(subtotal * (Number.isFinite(porcentajeChofer) ? porcentajeChofer : GANANCIA_CHOFER_POR_DEFECTO) / 100);
  const adelantoAplicado = Math.max(0, Number(adelanto) || 0);
  const extras = Array.isArray(gastosExtra) ? gastosExtra : [];
  const gastosChofer = redondear(extras
    .filter(gasto => gasto.destino === 'chofer')
    .reduce((suma, gasto) => suma + (Number(gasto.monto) || 0), 0));
  const gastosCliente = redondear(extras
    .filter(gasto => gasto.destino === 'cliente')
    .reduce((suma, gasto) => suma + (Number(gasto.monto) || 0), 0));
  const saldoChofer = redondear(chofer - adelantoAplicado + gastosChofer);

  return {
    bruto, totalViaje: redondear(bruto + gastosCliente), comision, subtotal, chofer,
    adelanto: adelantoAplicado, gastosChofer, gastosCliente, saldoChofer
  };
}