const $ = id => document.getElementById(id);
let opcionesActuales = null;

export function iniciarSalidaOrden() {
  $('btnPrintOrderOutput').addEventListener('click', () => ejecutar('imprimir'));
  $('btnPdfOrderOutput').addEventListener('click', () => ejecutar('pdf'));
  document.querySelectorAll('[data-close-order-output]').forEach(elemento => {
    elemento.addEventListener('click', cerrar);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('orderOutputModal').hidden) cerrar();
  });
}

export function elegirSalidaOrden(titulo, opciones) {
  opcionesActuales = opciones;
  $('orderOutputTitle').textContent = titulo;
  $('btnPdfOrderOutput').hidden = typeof opciones.pdf !== 'function';
  $('orderOutputDescription').textContent = opciones.pdf
    ? 'Elegí imprimir la orden o guardarla como PDF desde el diálogo de impresión.'
    : 'Elegí imprimir la orden.';
  $('orderOutputModal').hidden = false;
  document.body.classList.add('modal-open');
}

export function abrirDialogoImpresion(nombreArchivo) {
  const tituloOriginal = document.title;
  document.title = nombreArchivo;
  window.addEventListener('afterprint', () => { document.title = tituloOriginal; }, { once: true });
  window.print();
}

function ejecutar(tipo) {
  const accion = opcionesActuales?.[tipo];
  cerrar();
  accion?.();
}

function cerrar() {
  $('orderOutputModal').hidden = true;
  if (!document.querySelector('.modal:not([hidden])')) document.body.classList.remove('modal-open');
  opcionesActuales = null;
}
