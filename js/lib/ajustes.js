const CLAVE = 'ciperiani.ajustes.v1';
const POR_DEFECTO = { comisionPct: 10 };

export function leerAjustes() {
  try {
    return { ...POR_DEFECTO, ...JSON.parse(localStorage.getItem(CLAVE)) };
  } catch {
    return { ...POR_DEFECTO };
  }
}

export function guardarAjustes(ajustes) {
  localStorage.setItem(CLAVE, JSON.stringify(ajustes));
}