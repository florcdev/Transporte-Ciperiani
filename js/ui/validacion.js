const MENSAJE_OBLIGATORIOS = 'Completá los campos obligatorios';

function estaCompleto(campo) {
  if (campo.type === 'checkbox' || campo.type === 'radio') return campo.checked;
  return campo.value.trim() !== '';
}

function campoVisible(campo) {
  if (campo.type !== 'hidden') return campo;
  return campo.closest('.field')?.querySelector('input:not([type="hidden"]), select, textarea') || campo;
}

function marcarCampo(campo) {
  const visible = campoVisible(campo);
  visible.setAttribute('aria-invalid', 'true');
  visible.closest('.field')?.classList.add('has-required-error');
}

function limpiarCampo(campo) {
  campo.removeAttribute('aria-invalid');
  campo.closest('.field')?.classList.remove('has-required-error');
}

function obtenerError(form) {
  let error = form.querySelector('.form-error[role="alert"]');
  if (!error) {
    error = document.createElement('p');
    error.className = 'form-error';
    error.setAttribute('role', 'alert');
    error.setAttribute('aria-live', 'polite');
    form.append(error);
  }
  return error;
}

export function mostrarErrorCamposObligatorios(form, campos) {
  form.querySelectorAll('[aria-invalid="true"]').forEach(limpiarCampo);
  campos.forEach(marcarCampo);
  const error = obtenerError(form);
  error.textContent = MENSAJE_OBLIGATORIOS;
  error.hidden = false;
}

export function mostrarErrorValidacion(form, campo, mensaje) {
  form.querySelectorAll('[aria-invalid="true"]').forEach(limpiarCampo);
  marcarCampo(campo);
  const error = obtenerError(form);
  error.textContent = mensaje;
  error.hidden = false;
}

export function limpiarErrorValidacion(form, campo) {
  limpiarCampo(campo);
  const error = form.querySelector('.form-error[role="alert"]');
  if (error && !form.querySelector('[aria-invalid="true"]')) error.hidden = true;
}

export function iniciarValidacionObligatorios() {
  document.addEventListener('submit', evento => {
    const form = evento.target;
    if (!(form instanceof HTMLFormElement)) return;

    const faltantes = [...form.querySelectorAll('[required]')].filter(campo =>
      !campo.disabled
      && campo.type !== 'hidden'
      && !campo.closest('[hidden]')
      && !estaCompleto(campo)
    );
    if (!faltantes.length) return;

    evento.preventDefault();
    evento.stopImmediatePropagation();
    mostrarErrorCamposObligatorios(form, faltantes);
    campoVisible(faltantes[0]).focus({ preventScroll: true });
  }, true);

  document.addEventListener('input', limpiarSiCompleto);
  document.addEventListener('change', limpiarSiCompleto);
  document.addEventListener('reset', evento => {
    const form = evento.target;
    if (!(form instanceof HTMLFormElement)) return;
    setTimeout(() => limpiarValidacion(form), 0);
  });
}

function limpiarSiCompleto(evento) {
  const campo = evento.target;
  if (!(campo instanceof HTMLElement) || !campo.matches('[aria-invalid="true"]')) return;
  if (!estaCompleto(campo) || !campo.validity.valid) return;

  limpiarCampo(campo);
  const form = campo.form;
  if (form && !form.querySelector('[aria-invalid="true"]')) {
    const error = form.querySelector('.form-error[role="alert"]');
    if (error?.textContent === MENSAJE_OBLIGATORIOS) error.hidden = true;
  }
}

function limpiarValidacion(form) {
  form.querySelectorAll('[aria-invalid="true"]').forEach(limpiarCampo);
  const error = form.querySelector('.form-error[role="alert"]');
  if (error?.textContent === MENSAJE_OBLIGATORIOS) error.hidden = true;
}
