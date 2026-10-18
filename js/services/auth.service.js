import { supabase } from '../lib/supabase.js';

export async function sesionActual() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function iniciarSesion(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

async function obtenerCorreoCuentaActiva() {
  const { data, error: usuarioError } = await supabase.auth.getUser();
  if (usuarioError) throw usuarioError;

  const email = data.user?.email;
  if (!email) throw new Error('La cuenta activa no tiene un correo asociado.');
  return email;
}

export async function solicitarCodigoCambioContrasena() {
  const email = await obtenerCorreoCuentaActiva();
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

export async function verificarCodigoCambioContrasena(codigo) {
  const email = await obtenerCorreoCuentaActiva();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token: codigo,
    type: 'recovery'
  });
  if (error) throw error;
}

export async function actualizarContrasena(contrasenaNueva) {
  const { error } = await supabase.auth.updateUser({ password: contrasenaNueva });
  if (error) throw error;
}

export const cerrarSesion = () => supabase.auth.signOut({ scope: 'local' });

/** El callback recibe la sesión (o null al cerrar sesión). */
export function onCambioSesion(callback) {
  supabase.auth.onAuthStateChange((_evento, sesion) => callback(sesion));
}