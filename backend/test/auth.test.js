// Login de demo: token, rutas protegidas, rutas públicas y límite de intentos.
process.env.TZ = 'America/Lima';

import test from 'node:test';
import assert from 'node:assert/strict';
import { Almacen } from '../src/almacen/index.js';
import { iniciarServidor } from '../src/servidor.js';
import { crearAuth, DURACION_MS } from '../src/auth.js';

// Valores de prueba: la cuenta real va en variables de entorno, nunca en el repo.
const CUENTA = { correo: 'admin@prueba.example', contrasena: 'clave-de-prueba', secreto: 'secreto-de-prueba' };

async function levantar(auth) {
  const almacen = await new Almacen({ esperaEscritura: 5 }).iniciar();
  const servidor = await iniciarServidor({ almacen, auth, origenes: ['https://app.example'] }, 0);
  const base = `http://127.0.0.1:${servidor.address().port}`;
  const api = async (ruta, { method = 'GET', body, token, headers = {} } = {}) => {
    const res = await fetch(`${base}${ruta}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, headers: res.headers, datos: await res.json().catch(() => null) };
  };
  return { api, base, cerrar: () => new Promise((r) => servidor.close(r)) };
}

test('login correcto: token que abre las rutas del dashboard y /auth/yo', async (t) => {
  const s = await levantar(crearAuth(CUENTA));
  t.after(s.cerrar);
  assert.equal((await s.api('/health')).datos.auth, true);
  const r = await s.api('/auth/login', { method: 'POST', body: { correo: ' Admin@Prueba.example ', contrasena: 'clave-de-prueba' } });
  assert.equal(r.status, 200);
  assert.match(r.datos.token, /^[\w-]+\.[\w-]+$/);
  const horas = (Date.parse(r.datos.expira_en) - Date.now()) / 36e5;
  assert.ok(horas > 11.9 && horas <= 12, `expira en ${horas} h`);
  assert.equal((await s.api('/pedidos', { token: r.datos.token })).status, 200);
  assert.deepEqual((await s.api('/auth/yo', { token: r.datos.token })).datos.correo, 'admin@prueba.example');
});

test('contraseña o correo malos → 401; rutas protegidas sin token → 401', async (t) => {
  const s = await levantar(crearAuth(CUENTA));
  t.after(s.cerrar);
  const mala = await s.api('/auth/login', { method: 'POST', body: { correo: 'admin@prueba.example', contrasena: 'otra' } });
  assert.equal(mala.status, 401);
  assert.equal(mala.datos.error, 'Correo o contraseña incorrectos');
  assert.equal((await s.api('/auth/login', { method: 'POST', body: { correo: 'otro@prueba.example', contrasena: 'clave-de-prueba' } })).status, 401);
  assert.equal((await s.api('/auth/login', { method: 'POST', body: {} })).status, 401);
  for (const [metodo, ruta] of [['GET', '/config'], ['PATCH', '/config'], ['GET', '/pedidos'], ['GET', '/catalogo'], ['GET', '/metricas'], ['GET', '/notificaciones'], ['GET', '/auth/yo']]) {
    const r = await s.api(ruta, { method: metodo, body: metodo === 'PATCH' ? {} : undefined });
    assert.equal(r.status, 401, `${metodo} ${ruta}`);
    assert.match(r.datos.error, /Inicia sesión/);
  }
});

test('token alterado o vencido → 401', async (t) => {
  let ahora = Date.now();
  const auth = crearAuth({ ...CUENTA, ahora: () => ahora });
  const s = await levantar(auth);
  t.after(s.cerrar);
  const { token } = (await s.api('/auth/login', { method: 'POST', body: { correo: CUENTA.correo, contrasena: CUENTA.contrasena } })).datos;
  const [cuerpo, firma] = token.split('.');
  // Cuerpo cambiado (otro vencimiento) con la firma vieja.
  const otroCuerpo = Buffer.from(JSON.stringify({ sub: CUENTA.correo, exp: ahora + 10 * DURACION_MS })).toString('base64url');
  assert.equal((await s.api('/pedidos', { token: `${otroCuerpo}.${firma}` })).status, 401);
  assert.equal((await s.api('/pedidos', { token: `${cuerpo}.${firma.slice(0, -2)}AA` })).status, 401);
  assert.equal((await s.api('/pedidos', { token: 'basura' })).status, 401);
  // Firmado con otro secreto.
  const ajeno = crearAuth({ ...CUENTA, secreto: 'otro-secreto' }).login({ correo: CUENTA.correo, contrasena: CUENTA.contrasena }).token;
  assert.equal((await s.api('/pedidos', { token: ajeno })).status, 401);
  assert.equal((await s.api('/pedidos', { token })).status, 200);
  ahora += DURACION_MS + 1000;
  assert.equal((await s.api('/pedidos', { token })).status, 401, 'vencido a las 12 h');
});

test('rutas públicas: /health, /chat y el preflight de CORS con Authorization', async (t) => {
  const s = await levantar(crearAuth(CUENTA));
  t.after(s.cerrar);
  assert.equal((await s.api('/health')).status, 200);
  const chat = await s.api('/chat', { method: 'POST', body: { conversacion_id: null, texto: null, boton_id: null } });
  assert.equal(chat.status, 200);
  assert.match(chat.datos.mensajes[0].texto, /Mermín/);
  const pre = await fetch(`${s.base}/pedidos`, { method: 'OPTIONS', headers: { Origin: 'https://app.example', 'Access-Control-Request-Headers': 'authorization' } });
  assert.equal(pre.status, 204);
  assert.match(pre.headers.get('access-control-allow-headers'), /Authorization/);
});

test('límite: más de 10 intentos por IP en 15 minutos → 429, aunque la clave sea correcta', async (t) => {
  let ahora = Date.now();
  const s = await levantar(crearAuth({ ...CUENTA, ahora: () => ahora }));
  t.after(s.cerrar);
  const intento = (contrasena, ip = '203.0.113.7') => s.api('/auth/login', { method: 'POST', body: { correo: CUENTA.correo, contrasena }, headers: { 'X-Forwarded-For': ip } });
  for (let i = 0; i < 10; i += 1) assert.equal((await intento('mala')).status, 401);
  const bloqueado = await intento(CUENTA.contrasena);
  assert.equal(bloqueado.status, 429);
  assert.match(bloqueado.datos.error, /15 minutos/);
  assert.equal((await intento(CUENTA.contrasena, '198.51.100.2')).status, 200, 'otra IP no se bloquea');
  ahora += 15 * 60 * 1000;
  assert.equal((await intento(CUENTA.contrasena)).status, 200, 'pasada la ventana se puede volver a entrar');
});

test('sin ADMIN_EMAIL/ADMIN_PASSWORD el backend queda abierto como antes', async (t) => {
  assert.equal(crearAuth({ correo: 'a@b.example' }), null);
  assert.equal(crearAuth({}), null);
  const s = await levantar(null);
  t.after(s.cerrar);
  assert.equal((await s.api('/health')).datos.auth, false);
  assert.equal((await s.api('/pedidos')).status, 200);
  assert.equal((await s.api('/auth/login', { method: 'POST', body: {} })).status, 404);
});
