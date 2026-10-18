// Sesión del dashboard (login de demo). El token vive en sessionStorage: se borra al cerrar la pestaña.
// Con backend, lo emite POST /auth/login. En "Modo ejemplo" la cuenta se valida aquí mismo con
// VITE_DEMO_PASSWORD: esa variable queda dentro del JavaScript publicado, así que NO es un secreto; solo evita
// que la demo quede abierta sin pedir nada.

const CLAVE = 'priora.sesion';
export const CORREO_DEMO = 'joaquinsito@gmail.com';
const CLAVE_DEMO = import.meta.env.VITE_DEMO_PASSWORD || '';
const DURACION_LOCAL_MS = 12 * 60 * 60 * 1000;

const oyentes = new Set();

function leer() {
  try {
    const s = JSON.parse(sessionStorage.getItem(CLAVE) || 'null');
    return s && s.token && Date.parse(s.expira_en) > Date.now() ? s : null;
  } catch {
    return null;
  }
}

export const sesionActual = () => leer();
export const tokenActual = () => leer()?.token || null;

export function guardarSesion({ token, expira_en, correo, local = false }) {
  try { sessionStorage.setItem(CLAVE, JSON.stringify({ token, expira_en, correo, local })); } catch { /* modo privado */ }
}

/** motivo: 'salir' (botón) o 'vencida' (el backend respondió 401). */
export function cerrarSesion(motivo = 'salir') {
  const habia = Boolean(sessionStorage.getItem(CLAVE));
  try { sessionStorage.removeItem(CLAVE); } catch { /* nada */ }
  if (habia || motivo === 'salir') oyentes.forEach((fn) => fn(motivo));
}

export function alCerrarSesion(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

/** ¿Hay cuenta de demo para el modo ejemplo? Sin VITE_DEMO_PASSWORD la demo local queda abierta como antes. */
export const hayCuentaDemo = () => Boolean(CLAVE_DEMO);

/** Valida la cuenta de demo sin backend. Devuelve la sesión o null. */
export function sesionLocal(correo, contrasena, clave = CLAVE_DEMO, ahora = Date.now()) {
  if (!clave) return null;
  const correoOk = String(correo || '').trim().toLowerCase() === CORREO_DEMO;
  if (!correoOk || contrasena !== clave) return null;
  return { token: `local.${ahora.toString(36)}`, expira_en: new Date(ahora + DURACION_LOCAL_MS).toISOString(), correo: CORREO_DEMO, local: true };
}
