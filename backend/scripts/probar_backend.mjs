#!/usr/bin/env node
// Prueba de humo contra un backend levantado (local o Render): recorre las rutas que usa la app, corre los 3
// escenarios de la demo y avisa si alguna respuesta pasa de 4 s (la app se pasa a "Modo ejemplo" a los 4 s).
//
//   node scripts/probar_backend.mjs https://priora-backend.onrender.com
//   node scripts/probar_backend.mjs http://localhost:3000 --origen https://priora-app.vercel.app
//   node scripts/probar_backend.mjs <url> --solo-lectura      (no crea pedidos ni cambia nada)
//   node scripts/probar_backend.mjs <url> --correo <correo> --contrasena <clave>   (si el backend tiene login)
//
// Con login activo (/health dice "auth": true) hace falta la cuenta del dashboard: por --correo/--contrasena o por
// las variables PRIORA_CORREO / PRIORA_CONTRASENA (así la clave no queda en el historial de la terminal).
//
// Sin --solo-lectura crea 3 pedidos de prueba (Grupo Miraflores SAC, Valeria, Constructora Pacífico SAC) y marca
// uno como confirmado. Si el backend guarda en Google Sheets, quedan en la pestaña Pedidos.
import { readFileSync } from 'node:fs';
import { ESCENARIOS, correrEscenario } from './escenarios.mjs';

const args = process.argv.slice(2);
const base = (args.find((a) => /^https?:\/\//.test(a)) || process.env.API_URL || 'http://localhost:3000').replace(/\/$/, '');
const opcion = (nombre) => (args.includes(nombre) ? args[args.indexOf(nombre) + 1] : null);
const origen = opcion('--origen');
const correo = opcion('--correo') || process.env.PRIORA_CORREO || null;
const contrasena = opcion('--contrasena') || process.env.PRIORA_CONTRASENA || null;
const soloLectura = args.includes('--solo-lectura');
const LIMITE_APP_MS = 4000;
let token = null;

const resultados = [];
async function llamar(ruta, { method = 'GET', body, form } = {}) {
  const t0 = Date.now();
  const res = await fetch(`${base}${ruta}`, {
    method,
    headers: {
      ...(form ? {} : { 'Content-Type': 'application/json' }), ...(origen ? { Origin: origen } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form || (body !== undefined ? JSON.stringify(body) : undefined),
    signal: AbortSignal.timeout(90000),
  });
  const ms = Date.now() - t0;
  const tipo = res.headers.get('content-type') || '';
  const datos = tipo.includes('json') ? await res.json() : await res.arrayBuffer();
  return { status: res.status, ms, datos, headers: res.headers };
}

async function paso(nombre, fn) {
  const t0 = Date.now();
  try {
    const detalle = await fn();
    resultados.push({ nombre, ok: true, ms: Date.now() - t0, detalle });
  } catch (e) {
    resultados.push({ nombre, ok: false, ms: Date.now() - t0, detalle: e.message });
  }
}
const exigir = (cond, mensaje) => { if (!cond) throw new Error(mensaje); };
const lentas = [];
const medir = (r, ruta) => { if (r.ms > LIMITE_APP_MS) lentas.push(`${ruta} tardó ${r.ms} ms`); return r; };

console.log(`Probando ${base}${origen ? ` con Origin ${origen}` : ''}${soloLectura ? ' (solo lectura)' : ''}\n`);

// Render (plan gratis) duerme el servicio: la primera llamada puede tardar ~1 min en despertarlo.
let conLogin = false;
await paso('GET /health (despierta el servicio)', async () => {
  const r = await llamar('/health');
  exigir(r.status === 200 && r.datos.ok, `status ${r.status}`);
  if (origen) exigir(r.headers.get('access-control-allow-origin'), `CORS: el backend no permite ${origen}; revisa FRONTEND_ORIGIN`);
  conLogin = Boolean(r.datos.auth);
  return `almacén ${r.datos.almacen} · Google ${r.datos.google ? 'sí' : 'no'} · login ${conLogin ? 'sí' : 'no'} · ${r.ms} ms${r.datos.ultimo_error ? ` · ÚLTIMO ERROR: ${r.datos.ultimo_error}` : ''}`;
});

if (conLogin) {
  await paso('Sin token, las rutas del dashboard responden 401', async () => {
    const r = await llamar('/pedidos');
    exigir(r.status === 401, `status ${r.status}: el dashboard está abierto`);
    return r.datos.error;
  });
  await paso('POST /auth/login', async () => {
    exigir(correo && contrasena, 'El backend tiene login: pasa --correo y --contrasena (o PRIORA_CORREO y PRIORA_CONTRASENA)');
    const r = await llamar('/auth/login', { method: 'POST', body: { correo, contrasena } });
    exigir(r.status === 200 && r.datos.token, `status ${r.status}: ${r.datos?.error || ''}`);
    token = r.datos.token;
    return `sesión hasta ${r.datos.expira_en} · ${r.ms} ms`;
  });
}

for (const ruta of ['/config', '/catalogo', '/pedidos', `/metricas?periodo=${new Date().getFullYear()}`, '/segmentos', '/segmentos/empresas_un_pedido/recomendaciones', '/fuentes', '/notificaciones']) {
  await paso(`GET ${ruta}`, async () => {
    const r = medir(await llamar(ruta), ruta);
    exigir(r.status === 200, `status ${r.status}: ${r.datos?.error || ''}`);
    const n = Array.isArray(r.datos) ? `${r.datos.length} elementos` : Object.keys(r.datos).slice(0, 4).join(', ');
    return `${n} · ${r.ms} ms`;
  });
}

await paso('GET /catalogo/plantilla', async () => {
  const r = medir(await llamar('/catalogo/plantilla'), '/catalogo/plantilla');
  exigir(r.status === 200 && /spreadsheetml/.test(r.headers.get('content-type') || ''), `status ${r.status}`);
  return `${r.datos.byteLength} bytes`;
});

for (const archivo of ['catalogo_correcto.csv', 'catalogo_con_errores.csv']) {
  await paso(`POST /catalogo/validar (${archivo})`, async () => {
    const form = new FormData();
    form.append('archivo', new Blob([readFileSync(new URL(`../test/archivos/${archivo}`, import.meta.url))], { type: 'text/csv' }), archivo);
    const r = medir(await llamar('/catalogo/validar', { method: 'POST', form }), '/catalogo/validar');
    exigir(r.status === 200, `status ${r.status}`);
    const esperado = archivo.includes('errores') ? false : true;
    exigir(r.datos.valido === esperado, `valido=${r.datos.valido}, se esperaba ${esperado}`);
    return esperado ? `${r.datos.filas} filas válidas` : `${r.datos.errores.length} errores detectados`;
  });
}

if (!soloLectura) {
  const pedidos = [];
  for (const e of ESCENARIOS) {
    await paso(`POST /chat escenario "${e.titulo}" → ${e.esperado}`, async () => {
      let maximo = 0;
      const r = await correrEscenario(async (cuerpo) => {
        const x = medir(await llamar('/chat', { method: 'POST', body: cuerpo }), '/chat');
        maximo = Math.max(maximo, x.ms);
        exigir(x.status === 200, `status ${x.status}: ${x.datos?.error || ''}`);
        return x.datos;
      }, e);
      exigir(r.pedido_id, `no cerró el pedido (paso ${r.paso})`);
      exigir(r.prioridad?.prioridad === e.esperado, `prioridad ${r.prioridad?.prioridad} (${r.prioridad?.motivo})`);
      pedidos.push(r.pedido_id);
      return `${r.pedido_id} · ${r.prioridad.motivo} · respuesta más lenta ${maximo} ms`;
    });
  }
  if (pedidos[0]) {
    await paso(`PATCH /pedidos/${pedidos[0]} → confirmado`, async () => {
      const r = medir(await llamar(`/pedidos/${pedidos[0]}`, { method: 'PATCH', body: { estado: 'confirmado' } }), '/pedidos/{id}');
      exigir(r.status === 200 && r.datos.estado === 'confirmado', `status ${r.status}`);
      return `${r.ms} ms`;
    });
  }
}

await paso('PATCH /config inválido → 400 (no cambia nada)', async () => {
  const r = await llamar('/config', { method: 'PATCH', body: { reglas: { umbral_alta: 1 } } });
  exigir(r.status === 400 && r.datos.error, `status ${r.status}`);
  return r.datos.error;
});

const anchos = Math.max(...resultados.map((r) => r.nombre.length));
for (const r of resultados) console.log(`${r.ok ? 'OK   ' : 'FALLA'} ${r.nombre.padEnd(anchos)}  ${r.detalle}`);
if (lentas.length) console.log(`\nAVISO: respuestas de más de ${LIMITE_APP_MS / 1000} s (la app pasaría a "Modo ejemplo"):\n  ${lentas.join('\n  ')}`);
const fallas = resultados.filter((r) => !r.ok).length;
console.log(`\n${resultados.length - fallas} de ${resultados.length} pasos OK.`);
process.exit(fallas ? 1 : 0);
