// Login de demo del dashboard: una sola cuenta (ADMIN_EMAIL / ADMIN_PASSWORD) y un token firmado con HMAC-SHA256
// (AUTH_SECRET) que dura 12 h. Sin dependencias. No es un sistema de usuarios: alcanza para que el dashboard no
// quede abierto a cualquiera con la URL.
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const DURACION_MS = 12 * 60 * 60 * 1000;
const VENTANA_MS = 15 * 60 * 1000;
const MAX_INTENTOS = 10;

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const hash = (texto) => createHash('sha256').update(String(texto ?? ''), 'utf8').digest();
// Se comparan los hash (mismo largo) para que el tiempo no dependa de cuántos caracteres coinciden.
const iguales = (a, b) => timingSafeEqual(hash(a), hash(b));

/** null si no hay ADMIN_EMAIL/ADMIN_PASSWORD (el backend queda sin login, como antes). */
export function crearAuth({ correo, contrasena, secreto, ahora = () => Date.now() } = {}) {
  if (!correo || !contrasena) return null;
  const correoAdmin = String(correo).trim().toLowerCase();
  // Sin AUTH_SECRET se usa uno al azar: funciona, pero los tokens dejan de valer en cada reinicio.
  const clave = secreto || randomBytes(32).toString('hex');
  const intentos = new Map();
  const firmar = (cuerpo) => createHmac('sha256', clave).update(cuerpo).digest();

  function emitir() {
    const expira = ahora() + DURACION_MS;
    const cuerpo = b64url(JSON.stringify({ sub: correoAdmin, exp: expira }));
    return { token: `${cuerpo}.${b64url(firmar(cuerpo))}`, expira_en: new Date(expira).toISOString() };
  }

  return {
    correo: correoAdmin,
    secretoAleatorio: !secreto,

    /** { ok, token, expira_en } | { ok: false, status, error }. */
    login(entrada, ip = 'desconocida') {
      const t = ahora();
      const registro = intentos.get(ip);
      const vigente = registro && t - registro.desde < VENTANA_MS ? registro : { desde: t, n: 0 };
      vigente.n += 1;
      intentos.set(ip, vigente);
      if (intentos.size > 10000) for (const [k, v] of intentos) if (t - v.desde >= VENTANA_MS) intentos.delete(k);
      if (vigente.n > MAX_INTENTOS) return { ok: false, status: 429, error: 'Demasiados intentos. Espera 15 minutos y vuelve a probar.' };
      const correoOk = iguales(String(entrada?.correo ?? '').trim().toLowerCase(), correoAdmin);
      const claveOk = iguales(entrada?.contrasena ?? '', contrasena);
      if (!(correoOk && claveOk)) return { ok: false, status: 401, error: 'Correo o contraseña incorrectos' };
      intentos.delete(ip);
      return { ok: true, ...emitir() };
    },

    /** Correo del token si es válido y no venció; null si no. */
    verificar(token) {
      const [cuerpo, firma, sobra] = String(token || '').split('.');
      if (!cuerpo || !firma || sobra !== undefined) return null;
      const esperada = firmar(cuerpo);
      const recibida = Buffer.from(firma, 'base64url');
      if (recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) return null;
      try {
        const datos = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8'));
        return datos.sub === correoAdmin && Number(datos.exp) > ahora() ? { correo: datos.sub, expira_en: new Date(datos.exp).toISOString() } : null;
      } catch {
        return null;
      }
    },
  };
}

/** IP del cliente: detrás del proxy de Render llega en X-Forwarded-For. */
export function ipDe(req) {
  const reenviada = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return reenviada || req.socket.remoteAddress || 'desconocida';
}
