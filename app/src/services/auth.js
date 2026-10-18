// Login de demo del dashboard. Con backend: POST /auth/login (la cuenta vive en ADMIN_EMAIL / ADMIN_PASSWORD del
// backend). Sin backend ("Modo ejemplo"): la cuenta de demo se valida en el navegador (ver sesion.js).
import { pedir, estadoBackend, ErrorApi } from './api.js';
import { guardarSesion, sesionActual, sesionLocal, hayCuentaDemo } from './sesion.js';

/** ¿Hay que iniciar sesión para entrar a /app? */
export async function necesitaLogin() {
  const e = await estadoBackend();
  return e.conectado ? e.auth : hayCuentaDemo();
}

/** ¿Puede entrar ya? Sin login requerido, o con una sesión válida. */
export async function puedeEntrar() {
  if (!(await necesitaLogin())) return true;
  const s = sesionActual();
  const e = await estadoBackend();
  // Una sesión local (modo ejemplo) no sirve si ahora sí hay backend con login.
  return Boolean(s) && (!e.conectado || !s.local);
}

export async function iniciarSesion(correo, contrasena) {
  const e = await estadoBackend();
  if (e.conectado) {
    if (!e.auth) return { sinLogin: true };
    const r = await pedir('/auth/login', { method: 'POST', body: { correo, contrasena } });
    guardarSesion({ token: r.token, expira_en: r.expira_en, correo: String(correo).trim().toLowerCase() });
    return r;
  }
  if (!hayCuentaDemo()) return { sinLogin: true };
  const s = sesionLocal(correo, contrasena);
  if (!s) throw new ErrorApi('Correo o contraseña incorrectos', 401);
  guardarSesion(s);
  return s;
}
