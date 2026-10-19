export const ELEMENTOS_POR_PAGINA = 3;

export function obtenerPagina(elementos, paginaSolicitada, tamano = ELEMENTOS_POR_PAGINA) {
  const totalPaginas = Math.ceil(elementos.length / tamano);
  const pagina = Math.min(Math.max(paginaSolicitada, 1), Math.max(totalPaginas, 1));
  const inicio = (pagina - 1) * tamano;

  return {
    elementos: elementos.slice(inicio, inicio + tamano),
    pagina,
    totalPaginas,
    inicio,
    total: elementos.length
  };
}

export function renderizarPaginacion(navegacion, pagina, totalPaginas, atributo) {
  navegacion.hidden = totalPaginas <= 1;
  if (navegacion.hidden) {
    navegacion.replaceChildren();
    return;
  }

  const paginas = totalPaginas <= 5
    ? Array.from({ length: totalPaginas }, (_, indice) => indice + 1)
    : pagina <= 3
      ? [1, 2, 3, '…', totalPaginas]
      : pagina >= totalPaginas - 2
        ? [1, '…', totalPaginas - 2, totalPaginas - 1, totalPaginas]
        : [1, '…', pagina - 1, pagina, pagina + 1, '…', totalPaginas];
  const atributoPagina = `data-${atributo}-page`;

  navegacion.innerHTML = `<button class="page-button" type="button" ${atributoPagina}="${pagina - 1}" aria-label="Página anterior"${pagina === 1 ? ' disabled' : ''}>&lt;</button>`
    + paginas.map(numero => numero === '…'
      ? '<span class="page-ellipsis" aria-hidden="true">…</span>'
      : `<button class="page-button${numero === pagina ? ' active' : ''}" type="button" ${atributoPagina}="${numero}" aria-label="Página ${numero}"${numero === pagina ? ' aria-current="page"' : ''}>${numero}</button>`).join('')
    + `<button class="page-button" type="button" ${atributoPagina}="${pagina + 1}" aria-label="Página siguiente"${pagina === totalPaginas ? ' disabled' : ''}>&gt;</button>`;
}

export function textoRangoPagina() {
  return '';
}
