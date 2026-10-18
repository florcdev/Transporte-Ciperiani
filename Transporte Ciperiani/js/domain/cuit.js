export function normalizarCuit(valor) {
  return String(valor ?? '').replace(/[\s.-]/g, '');
}

export function esCuitValido(valor) {
  const cuit = normalizarCuit(valor);
  if (!/^\d{11}$/.test(cuit) || !['20', '23', '24', '27', '30', '33', '34'].includes(cuit.slice(0, 2))) {
    return false;
  }

  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((total, peso, indice) => total + Number(cuit[indice]) * peso, 0);
  const resto = suma % 11;
  const verificador = resto === 0 ? 0 : resto === 1 ? 9 : 11 - resto;
  return Number(cuit[10]) === verificador;
}

export function cuitDuplicado(cuit, choferes, clientes, tipoActual, idActual) {
  const normalizado = normalizarCuit(cuit);
  const existeEn = (registros, tipo) => registros.some(registro =>
    !(idActual != null && tipo === tipoActual && Number(registro.id) === Number(idActual))
    && normalizarCuit(registro.cuit) === normalizado
  );
  return existeEn(choferes, 'chofer') || existeEn(clientes, 'cliente');
}
