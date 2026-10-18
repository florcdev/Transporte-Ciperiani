import { iniciarSesion, cerrarSesion } from '../services/auth.service.js';

export function iniciarAuth() {
  const form = document.getElementById('loginForm');
  const error = document.getElementById('loginError');
  const boton = document.getElementById('btnLogin');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    error.hidden = true;

    const { email, password } = form.elements;
    if (!email.value.trim() || !password.value) {
      error.textContent = 'Completá los campos obligatorios';
      error.hidden = false;
      return;
    }

    boton.disabled = true;
    try {
      await iniciarSesion(email.value.trim(), password.value);
      form.reset();
      location.hash = '#inicio';
    } catch {
      error.textContent = 'Correo o contraseña incorrectos.';
      error.hidden = false;
    } finally {
      boton.disabled = false;
    }
  });

  document.getElementById('btnLogout').addEventListener('click', async e => {
    e.preventDefault();
    await cerrarSesion();
    location.hash = '#login';
  });

}