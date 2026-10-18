const SELECTOR_CARRUSEL = '[data-stat-carousel]';
const SELECTOR_VENTANA = '.stat-carousel-viewport';
const SELECTOR_PISTA = '[data-carousel-track]';
const ANCHO_MOVIL = window.matchMedia('(max-width: 720px)');

export function iniciarCarruselesEstadisticas() {
  document.querySelectorAll(SELECTOR_CARRUSEL).forEach(iniciarCarrusel);
}

function iniciarCarrusel(carrusel) {
  const ventana = carrusel.querySelector(SELECTOR_VENTANA);
  const pista = carrusel.querySelector(SELECTOR_PISTA);
  const anterior = carrusel.querySelector('[data-carousel-prev]');
  const siguiente = carrusel.querySelector('[data-carousel-next]');
  if (!ventana || !pista || !anterior || !siguiente) return;

  let indiceActual = 0;
  let actualizarProgramado = false;
  const tarjetas = () => [...pista.children];

  function actualizarFlechas() {
    const ultima = tarjetas().length - 1;
    const indice = Math.min(Math.max(indiceActual, 0), ultima);
    [
      [anterior, indice === 0],
      [siguiente, indice === ultima]
    ].forEach(([boton, ocultar]) => {
      boton.disabled = ocultar;
      boton.setAttribute('aria-hidden', String(ocultar));
      boton.tabIndex = ocultar ? -1 : 0;
    });
  }

  function actualizarIndice() {
    actualizarProgramado = false;
    if (!ANCHO_MOVIL.matches || !ventana.clientWidth) return;
    indiceActual = Math.round(ventana.scrollLeft / ventana.clientWidth);
    actualizarFlechas();
  }

  function programarActualizacion() {
    if (actualizarProgramado) return;
    actualizarProgramado = true;
    requestAnimationFrame(actualizarIndice);
  }

  function desplazar(delta) {
    const ultima = tarjetas().length - 1;
    indiceActual = Math.min(Math.max(indiceActual + delta, 0), ultima);
    ventana.scrollTo({
      left: indiceActual * ventana.clientWidth,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    });
    actualizarFlechas();
  }

  anterior.addEventListener('click', () => desplazar(-1));
  siguiente.addEventListener('click', () => desplazar(1));
  ventana.addEventListener('scroll', programarActualizacion, { passive: true });
  window.addEventListener('resize', programarActualizacion);
  ANCHO_MOVIL.addEventListener('change', () => {
    indiceActual = 0;
    if (ANCHO_MOVIL.matches) ventana.scrollLeft = 0;
    actualizarFlechas();
  });
  actualizarFlechas();
}
