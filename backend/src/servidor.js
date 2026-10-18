// Servidor HTTP con las rutas de docs/API_CONTRATO.md. Sin framework: node:http, JSON y multipart a mano.
// Errores siempre como { "error": "mensaje en español" } con su código HTTP.
import { createServer } from 'node:http';
import { aplicarCambios } from './config.js';
import { responderChat, validarChat } from './chat.js';
import { listarPedidos, obtenerPedido, actualizarPedido, agregarNotificacion } from './pedidos.js';
import { leerArchivo, validarCatalogo, catalogoDesdeFilas, plantilla } from './catalogo.js';
import { calcularMetricas, validarPeriodo } from './metricas.js';
import { resumenSegmentos, recomendacionesDe } from './segmentos.js';
import { nuevaFuente, sincronizar } from './fuentes.js';
import { formatoSoles, hoyISO } from './formato.js';
import { montoPedido } from './prioridad.js';
import { ipDe } from './auth.js';

const LIMITE_JSON = 1024 * 1024;
const LIMITE_ARCHIVO = 5 * 1024 * 1024;
const HORA_RESUMEN = 19;

class ErrorHttp extends Error {
  constructor(status, mensaje) { super(mensaje); this.status = status; }
}

function leerCuerpo(req, limite) {
  return new Promise((resolve, reject) => {
    const partes = [];
    let total = 0;
    req.on('data', (c) => {
      total += c.length;
      if (total > limite) { reject(new ErrorHttp(413, 'El archivo o el cuerpo es demasiado grande')); req.destroy(); return; }
      partes.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(partes)));
    req.on('error', reject);
  });
}

async function leerJson(req) {
  const buf = await leerCuerpo(req, LIMITE_JSON);
  if (!buf.length) return {};
  try { return JSON.parse(buf.toString('utf8')); } catch { throw new ErrorHttp(400, 'El cuerpo no es un JSON válido'); }
}

/** multipart/form-data → { nombre, contenido } del campo "archivo". */
export function leerMultipart(buf, tipo) {
  const limite = (String(tipo).match(/boundary=(?:"([^"]+)"|([^;]+))/i) || []).slice(1).find(Boolean);
  if (!limite) throw new ErrorHttp(400, 'Envía el archivo como multipart/form-data en el campo "archivo"');
  const sep = Buffer.from(`--${limite}`);
  let inicio = buf.indexOf(sep);
  while (inicio !== -1) {
    const siguiente = buf.indexOf(sep, inicio + sep.length);
    if (siguiente === -1) break;
    const parte = buf.subarray(inicio + sep.length + 2, siguiente - 2); // sin \r\n de cada lado
    const corte = parte.indexOf('\r\n\r\n');
    if (corte !== -1) {
      const cabeceras = parte.subarray(0, corte).toString('utf8');
      const nombreCampo = (cabeceras.match(/name="([^"]*)"/i) || [])[1];
      if (nombreCampo === 'archivo') return { nombre: (cabeceras.match(/filename="([^"]*)"/i) || [])[1] || '', contenido: parte.subarray(corte + 4) };
    }
    inicio = siguiente;
  }
  throw new ErrorHttp(400, 'Falta el campo "archivo"');
}

async function archivoSubido(req) {
  const buf = await leerCuerpo(req, LIMITE_ARCHIVO);
  const { nombre, contenido } = leerMultipart(buf, req.headers['content-type']);
  if (!contenido.length) throw new ErrorHttp(400, 'El archivo está vacío');
  try { return leerArchivo(nombre, contenido); } catch (e) { throw new ErrorHttp(400, e.message); }
}

/** Mantiene los ids del catálogo actual cuando el nombre coincide (así siguen valiendo los pedidos y sugeridos). */
function conIdsActuales(nuevo, actual) {
  const porNombre = new Map(actual.map((p) => [p.nombre.trim().toLowerCase(), p.id]));
  const usados = new Set();
  return nuevo.map((p) => {
    const id = porNombre.get(p.nombre.trim().toLowerCase());
    if (id && !usados.has(id)) { usados.add(id); return { ...p, id }; }
    return p;
  });
}

/** Resumen del día como notificación, una vez por día desde las 19:00, si está activado en Ajustes. */
function resumenDiario(almacen) {
  const { config, notificaciones, conversaciones, pedidos } = almacen.datos;
  if (config.notificaciones?.resumen_diario === false || new Date().getHours() < HORA_RESUMEN) return;
  const hoy = hoyISO();
  if (notificaciones.some((n) => n.tipo === 'resumen_diario' && hoyISO(new Date(n.creado_en)) === hoy)) return;
  const consultas = conversaciones.filter((c) => c.inicio && hoyISO(new Date(Number(c.inicio))) === hoy).length;
  const deHoy = pedidos.filter((p) => !p.ejemplo && hoyISO(new Date(p.creado_en)) === hoy);
  const monto = deHoy.reduce((a, p) => a + montoPedido(p), 0);
  agregarNotificacion(almacen, { tipo: 'resumen_diario', titulo: 'Resumen del día', texto: `${consultas} consultas, ${deHoy.length} pedidos, ${formatoSoles(monto)}`, enlace: '/app' });
}

// Rutas que no piden token aunque el login esté activo: el chat lo usa el cliente final, no la dueña.
const PUBLICAS = new Set(['GET /health', 'POST /auth/login', 'POST /chat']);

/** Token de "Authorization: Bearer <token>". */
const tokenDe = (req) => (String(req.headers.authorization || '').match(/^Bearer\s+(\S+)$/i) || [])[1] || null;

export function crearApp({ almacen, google = null, origenes = ['*'], version = '0.1.0', auth = null }) {
  const rutas = [
    ['GET', /^\/health$/, () => ({ ok: true, version, almacen: almacen.modo, google: Boolean(google), auth: Boolean(auth), ultimo_error: almacen.ultimoError })],
    ['POST', /^\/auth\/login$/, async (req) => {
      if (!auth) throw new ErrorHttp(404, 'El login no está activo en este backend (faltan ADMIN_EMAIL y ADMIN_PASSWORD)');
      const r = auth.login(await leerJson(req), ipDe(req));
      if (!r.ok) throw new ErrorHttp(r.status, r.error);
      return { token: r.token, expira_en: r.expira_en };
    }],
    ['GET', /^\/auth\/yo$/, (req) => {
      if (!auth) throw new ErrorHttp(404, 'El login no está activo en este backend');
      return auth.verificar(tokenDe(req));
    }],
    ['GET', /^\/config$/, () => ({ ...almacen.datos.config, correo_servicio: google?.correo || null })],
    ['PATCH', /^\/config$/, async (req) => {
      const r = aplicarCambios(almacen.datos.config, await leerJson(req));
      if (!r.ok) throw new ErrorHttp(400, r.error);
      almacen.datos.config = r.config;
      almacen.guardar('config');
      return { ...r.config, correo_servicio: google?.correo || null };
    }],
    ['GET', /^\/catalogo$/, () => almacen.datos.catalogo],
    ['POST', /^\/catalogo\/validar$/, async (req) => validarCatalogo(await archivoSubido(req))],
    ['POST', /^\/catalogo\/confirmar$/, async (req) => {
      const filas = await archivoSubido(req);
      const v = validarCatalogo(filas);
      if (!v.valido) throw new ErrorHttp(400, v.errores[0]);
      almacen.datos.catalogo = conIdsActuales(catalogoDesdeFilas(filas), almacen.datos.catalogo);
      almacen.guardar('catalogo');
      return { ok: true, filas: filas.length };
    }],
    ['GET', /^\/catalogo\/plantilla$/, () => ({
      archivo: plantilla(), tipo: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', nombre: 'plantilla_catalogo_priora.xlsx',
    })],
    ['POST', /^\/chat$/, async (req) => {
      const entrada = validarChat(await leerJson(req));
      if (entrada.error) throw new ErrorHttp(400, entrada.error);
      return responderChat(almacen, entrada);
    }],
    ['GET', /^\/pedidos$/, (req, _m, url) => {
      const estado = url.searchParams.get('estado');
      if (estado && !['nuevo', 'derivado', 'confirmado'].includes(estado)) throw new ErrorHttp(400, 'estado debe ser nuevo, derivado o confirmado');
      return listarPedidos(almacen, { estado });
    }],
    ['GET', /^\/pedidos\/([^/]+)$/, (req, m) => {
      const p = obtenerPedido(almacen, decodeURIComponent(m[1]));
      if (!p) throw new ErrorHttp(404, `No existe el pedido ${m[1]}`);
      return p;
    }],
    ['PATCH', /^\/pedidos\/([^/]+)$/, async (req, m) => {
      const r = actualizarPedido(almacen, decodeURIComponent(m[1]), await leerJson(req));
      if (r.error) throw new ErrorHttp(r.status, r.error);
      return r.pedido;
    }],
    ['GET', /^\/metricas$/, (req, _m, url) => {
      const periodo = validarPeriodo(url.searchParams.get('periodo'));
      if (!periodo) throw new ErrorHttp(400, 'periodo va como aaaa (todo el año) o aaaa-mm (un mes)');
      return calcularMetricas(almacen.datos, periodo);
    }],
    ['GET', /^\/segmentos$/, () => resumenSegmentos(almacen.datos.ventas)],
    ['GET', /^\/segmentos\/([^/]+)\/recomendaciones$/, (req, m) => {
      const r = recomendacionesDe(almacen.datos.ventas, m[1], almacen.datos.config.negocio);
      if (!r) throw new ErrorHttp(404, `No existe el segmento ${m[1]}`);
      return r;
    }],
    ['GET', /^\/fuentes$/, () => ({ correo_servicio: google?.correo || null, fuentes: almacen.datos.fuentes.map(({ recurso_id, ...f }) => f) })],
    ['POST', /^\/fuentes$/, async (req) => {
      const r = nuevaFuente(almacen, await leerJson(req));
      if (r.error) throw new ErrorHttp(r.status, r.error);
      // La lectura puede tardar más que los 4 s de la app: corre en segundo plano y la app ve el estado al recargar.
      sincronizar(almacen, google, r.fuente);
      const { recurso_id, ...f } = r.fuente;
      return f;
    }],
    ['POST', /^\/fuentes\/([^/]+)\/sincronizar$/, (req, m) => {
      const f = almacen.datos.fuentes.find((x) => x.id === m[1]);
      if (!f) throw new ErrorHttp(404, `No existe la fuente ${m[1]}`);
      sincronizar(almacen, google, f);
      const { recurso_id, ...visible } = f;
      return { ...visible, estado: 'sincronizando' };
    }],
    ['GET', /^\/notificaciones$/, () => {
      resumenDiario(almacen);
      const activo = almacen.datos.config.notificaciones?.resumen_diario !== false;
      return almacen.datos.notificaciones.filter((n) => activo || n.tipo !== 'resumen_diario');
    }],
    ['PATCH', /^\/notificaciones\/([^/]+)$/, async (req, m) => {
      const n = almacen.datos.notificaciones.find((x) => x.id === decodeURIComponent(m[1]));
      if (!n) throw new ErrorHttp(404, `No existe la notificación ${m[1]}`);
      const cuerpo = await leerJson(req);
      if (typeof cuerpo.leida !== 'boolean') throw new ErrorHttp(400, 'Envía { "leida": true }');
      n.leida = cuerpo.leida;
      almacen.guardar('notificaciones');
      return n;
    }],
  ];

  const permitido = (origen) => origenes.includes('*') || (origen && origenes.includes(origen.replace(/\/$/, '')));

  return async function manejar(req, res) {
    const origen = req.headers.origin;
    const cabeceras = { 'Cache-Control': 'no-store' };
    if (origen && permitido(origen)) {
      Object.assign(cabeceras, {
        'Access-Control-Allow-Origin': origenes.includes('*') ? '*' : origen, Vary: 'Origin',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '600',
      });
    }
    const responder = (status, cuerpo) => {
      res.writeHead(status, { ...cabeceras, 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(cuerpo));
    };
    if (req.method === 'OPTIONS') { res.writeHead(204, cabeceras); res.end(); return; }
    try {
      const url = new URL(req.url, 'http://local');
      const ruta = url.pathname.replace(/\/+$/, '') || '/';
      const coinciden = rutas.filter(([, re]) => re.test(ruta));
      if (!coinciden.length) throw new ErrorHttp(404, `No existe la ruta ${ruta}`);
      const r = coinciden.find(([metodo]) => metodo === req.method);
      if (!r) throw new ErrorHttp(405, `La ruta ${ruta} acepta ${coinciden.map(([metodo]) => metodo).join(', ')}`);
      if (auth && !PUBLICAS.has(`${req.method} ${ruta}`) && !auth.verificar(tokenDe(req))) {
        throw new ErrorHttp(401, 'Inicia sesión para usar el dashboard (falta el token o venció)');
      }
      const salida = await r[2](req, ruta.match(r[1]), url);
      if (salida && Buffer.isBuffer(salida.archivo)) {
        res.writeHead(200, { ...cabeceras, 'Content-Type': salida.tipo, 'Content-Disposition': `attachment; filename="${salida.nombre}"` });
        res.end(salida.archivo);
        return;
      }
      responder(req.method === 'POST' && ruta === '/fuentes' ? 201 : 200, salida);
    } catch (e) {
      if (!e.status) console.error('[servidor]', e);
      responder(e.status || 500, { error: e.status ? e.message : 'Error interno del servidor' });
    }
  };
}

export function iniciarServidor(opciones, puerto) {
  const servidor = createServer(crearApp(opciones));
  return new Promise((resolve) => servidor.listen(puerto, () => resolve(servidor)));
}
