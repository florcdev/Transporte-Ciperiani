import { sesionActual, onCambioSesion } from './services/auth.service.js';
import { cargarDatos, vaciarDatos } from './state.js';
import { mostrarError, ocultarError } from './ui/componentes.js';
import { iniciarAuth } from './ui/auth.view.js';
import { iniciarViajes, renderViajes } from './ui/viajes.view.js';
import { iniciarDetalle, renderDetalle } from './ui/detalle.view.js';
import { iniciarFormulario, abrirFormulario } from './ui/formulario.view.js';
import { iniciarReportes, renderReportes, renderGraficoInicio } from './ui/reportes.view.js';
import { iniciarChoferes, renderChoferes } from './ui/choferes.view.js';
import { iniciarClientes, renderClientes } from './ui/clientes.view.js';
import { iniciarCamiones, renderCamiones } from './ui/camiones.view.js';
import { iniciarSalidaOrden } from './ui/salida-orden.view.js';
import { iniciarValidacionObligatorios } from './ui/validacion.js';
import { detenerSincronizacion, iniciarSincronizacion } from './services/sincronizacion.service.js';
import { iniciarCarruselesEstadisticas } from './ui/carrusel-estadisticas.js';

const $ = id => document.getElementById(id);

const TITULOS = { inicio: 'Inicio', viajes: 'Viajes', reportes: 'Reportes', choferes: 'Choferes', clientes: 'Clientes', camiones: 'Camiones' };
const VISTAS = ['login', 'viaje', ...Object.keys(TITULOS)];
const PADRE_NAV = { viaje: 'viajes' }; // el detalle resalta "Viajes" en el menú

let datosCargados = false;
let versionEnrutado = 0;
let animacionVista;

function leerHash() {
  const [nombre, parametro] = (location.hash || `#${document.body.dataset.page || 'inicio'}`).slice(1).split('/');
  return {
    vista: VISTAS.includes(nombre) ? nombre : 'inicio',
    parametro: parametro ? decodeURIComponent(parametro) : null
  };
}

/** Cambia el hash; si ya es el mismo, vuelve a dibujar la vista. */
function irA(hash) {
  const vista = hash.slice(1).split('/')[0];
  const ruta = {
    inicio: 'index.html',
    viajes: 'viajes.html',
    viaje: 'viajes.html',
    reportes: 'reportes.html',
    choferes: 'choferes.html',
    clientes: 'clientes.html',
    camiones: 'camiones.html'
  }[vista];
  if (ruta && !document.querySelector(`[data-view="${vista}"]`)) {
    location.href = `./${ruta}${hash}`;
    return;
  }
  if (location.hash === hash) enrutar();
  else location.hash = hash;
}

async function enrutar() {
    const version = ++versionEnrutado;
  const { vista, parametro } = leerHash();
  const sesion = await sesionActual();
  if (version !== versionEnrutado) return;

  if (!sesion) {
    $('app').hidden = true;
    $('v-login').hidden = false;
    return;
  }

  $('v-login').hidden = true;

  // Con sesión activa no tiene sentido quedarse en el login.
  if (vista === 'login') return irA('#inicio');
  if (!document.querySelector(`[data-view="${vista}"]`)) return irA(`#${vista}`);

  document.body.classList.remove('drawer');
  ocultarError();
  $('v-login').hidden = true;
  $('app').hidden = false;
  $('content').classList.toggle('page-viajes', vista === 'viajes');

  if (!datosCargados) {
    try {
      await cargarDatos();
      if (version !== versionEnrutado) return;
      datosCargados = true;
      iniciarSincronizacion(sesion.user.id, async () => {
        await cargarDatos();
        actualizarVistaActual();
      }, mostrarError);
    } catch (error) {
      if (version !== versionEnrutado) return;
      mostrarError(error);
    }
  }

  const paginaActual = [...document.querySelectorAll('[data-view]')].find(s => !s.hidden);
  const paginaNueva = [...document.querySelectorAll('[data-view]')].find(s => s.dataset.view === vista);
  if (paginaActual && paginaActual !== paginaNueva && !await salirPagina(paginaActual, version)) return;

  document.querySelectorAll('[data-view]').forEach(s => { s.hidden = s.dataset.view !== vista; });

  const activo = PADRE_NAV[vista] ?? vista;
  document.querySelectorAll('[data-nav]').forEach(a => {
    if (a.dataset.nav === activo) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  const esDetalle = vista === 'viaje';
  $('pageTitle').hidden = esDetalle;
  $('pageCrumbs').hidden = !esDetalle;

  if (esDetalle) {
    const viaje = renderDetalle(parametro);
    if (!viaje) return irA('#viajes');
    $('pageCrumbs').querySelector('span').textContent = viaje.codigo;
    document.title = `Viaje ${viaje.codigo} · Transporte Ciperiani`;
  } else {
    $('pageTitle').textContent = TITULOS[vista];
    document.title = `${TITULOS[vista]} · Transporte Ciperiani`;
  }

  if (vista === 'inicio') {
    renderGraficoInicio();
  }
  if (vista === 'viajes') renderViajes();
  if (vista === 'reportes') renderReportes();
  if (vista === 'choferes') renderChoferes();
  if (vista === 'clientes') renderClientes();
  if (vista === 'camiones') renderCamiones();

  $('content').scrollTop = 0;
  if (paginaNueva && paginaActual !== paginaNueva) entrarPagina(paginaNueva);
}

async function salirPagina(pagina, version) {
  animacionVista?.cancel();
  if (!pagina.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return version === versionEnrutado;
  }

  const animacion = pagina.animate([
    { opacity: 1, transform: 'translateY(0)' },
    { opacity: 0, transform: 'translateY(-3px)' }
  ], { duration: 130, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'forwards' });
  animacionVista = animacion;
  await new Promise(resolve => {
    animacion.onfinish = resolve;
    animacion.oncancel = resolve;
  });
  return version === versionEnrutado;
}

function entrarPagina(pagina) {
  animacionVista?.cancel();
  if (!pagina.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  animacionVista = pagina.animate([
    { opacity: 0, transform: 'translateY(3px)' },
    { opacity: 1, transform: 'translateY(0)' }
  ], { duration: 190, easing: 'cubic-bezier(.2, .7, .2, 1)' });
}

function actualizarVistaActual() {
  if (!datosCargados) return;
  const { vista, parametro } = leerHash();
  if (vista === 'inicio') renderGraficoInicio();
  if (vista === 'viajes') renderViajes();
  if (vista === 'viaje') {
    if (!renderDetalle(parametro)) irA('#viajes');
  }
  if (vista === 'reportes') renderReportes(true);
  if (vista === 'choferes') renderChoferes();
  if (vista === 'clientes') renderClientes();
  if (vista === 'camiones') renderCamiones();
}

function iniciar() {
  iniciarValidacionObligatorios();
  iniciarAuth();
  iniciarCarruselesEstadisticas();
  if ($('btnNewTrip')) {
    iniciarViajes({ onNuevo: () => abrirFormulario() });
    iniciarDetalle({ onEditar: abrirFormulario });
    iniciarFormulario({ onGuardado: viaje => irA(`#viaje/${encodeURIComponent(viaje.codigo)}`) });
  }
  if ($('reportDateFrom') || $('homeChart')) iniciarReportes();
  if ($('btnNewDriver')) iniciarChoferes();
  if ($('btnNewCustomer')) iniciarClientes();
  if ($('btnNewTruck')) iniciarCamiones();
  if ($('btnPrintOrderOutput')) iniciarSalidaOrden();

  // Click en una fila de viaje (salvo que se haya hecho sobre el link del ID).
  document.addEventListener('click', e => {
    const fila = e.target.closest('tr[data-codigo]');
    if (fila && !e.target.closest('a')) location.hash = `#viaje/${encodeURIComponent(fila.dataset.codigo)}`;
  });

  // Menú lateral en tablet y celular.
  const mobileMenu = window.matchMedia('(max-width: 720px)');
  const botonesMenu = [$('menuBtn'), $('sidebarMenuBtn')].filter(Boolean);
  const cambiarMenu = abierto => {
    document.body.classList.toggle('drawer', mobileMenu.matches && abierto);
    document.body.classList.toggle('sidebar-collapsed', !mobileMenu.matches && !abierto);
    botonesMenu.forEach(boton => {
      boton.setAttribute('aria-expanded', String(abierto));
      boton.setAttribute('aria-label', abierto ? 'Contraer menú' : 'Abrir menú');
      boton.title = abierto ? 'Contraer menú' : 'Abrir menú';
    });
  };
  botonesMenu.forEach(boton => boton.addEventListener('click', () => {
    cambiarMenu(mobileMenu.matches
      ? !document.body.classList.contains('drawer')
      : document.body.classList.contains('sidebar-collapsed'));
  }));
  mobileMenu.addEventListener('change', () => cambiarMenu(!mobileMenu.matches));
  $('scrim')?.addEventListener('click', () => cambiarMenu(false));
  document.querySelectorAll('.nav a').forEach(enlace => enlace.addEventListener('click', () => {
    if (mobileMenu.matches) cambiarMenu(false);
  }));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && mobileMenu.matches && document.body.classList.contains('drawer')) {
      cambiarMenu(false);
    }
  });
  cambiarMenu(!mobileMenu.matches);

  // Si la sesión se cierra (acá o en otra pestaña), se limpian los datos y se vuelve al login.
  onCambioSesion(sesion => {
    if (sesion) return;
    detenerSincronizacion();
    vaciarDatos();
    datosCargados = false;
    if (location.hash !== '#login') location.hash = '#login';
  });

  window.addEventListener('hashchange', enrutar);
  enrutar();
}

iniciar();