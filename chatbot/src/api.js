'use strict';

// API del bot para otras plataformas (backend a backend), expuesta por n8n en
//   /webhook/itswood/api/<ruta>   con la cabecera X-Api-Key.
// Este archivo valida la petición y da forma a las respuestas; las lecturas y escrituras las hace el flujo.
// Sin dependencias: se usa en los nodos Code de n8n y en el simulador.

const RUTAS = {
  salud: { metodo: 'GET' },
  mensaje: { metodo: 'POST' },
  conversacion: { metodo: 'GET' },
  solicitudes: { metodo: 'GET' },
  proveedores: { metodo: 'GET' },
  cotizaciones: { metodo: 'GET' },
  'confirmar-orden': { metodo: 'POST' },
  leads: { metodo: 'GET' },
  metricas: { metodo: 'GET' },
  segmentos: { metodo: 'GET' },
  config: { metodo: ['GET', 'PUT'] },
  'config-drive': { metodo: 'POST', url: 'config/drive' },
  sync: { metodo: 'POST' },
  fidelizacion: { metodo: ['GET', 'PUT'] },
  // Rutas con un parámetro en la URL (ver resolverRuta).
  'segmento-clientes': { metodo: 'GET', url: 'segmentos/{segmento}/clientes' },
  recomendacion: { metodo: 'GET', url: 'recomendaciones/{cliente_id}' },
  audiencia: { metodo: 'GET', url: 'audiencias/{segmento}.csv' },
  'campana-preview': { metodo: 'POST', url: 'campanas/{segmento}/preview' },
  'campana-enviar': { metodo: 'POST', url: 'campanas/{segmento}/enviar' },
};
const LIMITE_MAXIMO = 500;
const INTENCIONES = ['ALTA', 'MEDIA', 'BAJA'];
const SEGMENTOS_API = ['CORPORATIVO', 'VIP', 'RECURRENTE', 'NUEVO', 'DORMIDO', 'OCASIONAL', 'SIN_COMPRAS'];

function t(x) { return x === undefined || x === null ? '' : String(x).trim(); }
function digitos(x) { return t(x).replace(/\D/g, ''); }

// Ruta de la URL (hasta tres tramos: /api/<ruta>/<id>/<accion>) -> nombre interno y parámetro.
function resolverRuta(ruta, id, accion) {
  const [a, b, c] = [ruta, id, accion].map(t);
  const base = a.toLowerCase();
  if (!b) return { nombre: base, param: '' };
  if (base === 'config' && b.toLowerCase() === 'drive' && !c) return { nombre: 'config-drive', param: '' };
  if (base === 'segmentos' && c.toLowerCase() === 'clientes') return { nombre: 'segmento-clientes', param: b.toUpperCase() };
  if (base === 'recomendaciones' && !c) return { nombre: 'recomendacion', param: b };
  if (base === 'audiencias' && !c) return { nombre: 'audiencia', param: b.replace(/\.csv$/i, '').toUpperCase() };
  if (base === 'campanas' && ['preview', 'enviar'].includes(c.toLowerCase())) return { nombre: `campana-${c.toLowerCase()}`, param: b.toUpperCase() };
  return { nombre: [a, b, c].filter(Boolean).join('/').toLowerCase(), param: '' };
}

// Webhook de n8n: { params: { ruta, id, accion }, query, body, headers }. El método llega en el campo que n8n informe
// (con varios métodos habilitados, la salida de cada método va por su propia rama; el flujo lo pasa aquí).
function validarPeticion({ metodo, ruta, id, accion, query, body, ahora }) {
  const q = query || {};
  const b = body && typeof body === 'object' ? body : {};
  const m = t(metodo).toUpperCase();
  const { nombre: r, param } = resolverRuta(ruta, id, accion);
  const fallo = (status, error) => ({ ok: false, status, error, ruta: r });
  if (!RUTAS[r]) return fallo(404, `Ruta desconocida: ${r || '(vacía)'}. Rutas: ${Object.keys(RUTAS).map(k => RUTAS[k].url || k).join(', ')}.`);
  const metodos = [].concat(RUTAS[r].metodo);
  if (!metodos.includes(m)) return fallo(405, `La ruta ${RUTAS[r].url || r} usa ${metodos.join(' o ')}.`);

  const limite = Math.min(Math.max(parseInt(t(q.limite), 10) || 100, 1), LIMITE_MAXIMO);
  switch (r) {
    case 'mensaje': {
      const waId = digitos(b.wa_id);
      const texto = t(b.texto);
      if (waId.length < 10) return fallo(400, 'wa_id es obligatorio: número con código de país, por ejemplo 51987654321.');
      if (!texto) return fallo(400, 'texto es obligatorio.');
      if (texto.length > 1000) return fallo(400, 'texto admite hasta 1000 caracteres.');
      const ahoraIso = ahora || new Date().toISOString();
      const mensajeId = t(b.mensaje_id) || `API-${waId}-${Date.parse(ahoraIso).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      return {
        ok: true, ruta: r,
        // Mismo formato que produce normalizar.js; origen "api": la respuesta vuelve por HTTP, no por WhatsApp.
        mensaje: {
          tipo_evento: 'mensaje', origen: 'api', mensaje_id: mensajeId, wa_id: waId, telefono: waId,
          nombre_perfil: t(b.nombre).slice(0, 80), phone_number_id: '', fecha_iso: ahoraIso, tipo: 'text',
          texto, opcion_id: '', media_id: '', latitud: '', longitud: '',
        },
      };
    }
    case 'conversacion': {
      const waId = digitos(q.wa_id);
      if (waId.length < 10) return fallo(400, 'wa_id es obligatorio en la consulta (?wa_id=51987654321).');
      return { ok: true, ruta: r, filtros: { wa_id: waId }, limite: 1 };
    }
    case 'solicitudes': {
      const intencion = t(q.intencion).toUpperCase();
      if (intencion && !INTENCIONES.includes(intencion)) return fallo(400, `intencion debe ser ${INTENCIONES.join(', ')}.`);
      return { ok: true, ruta: r, filtros: { estado: t(q.estado).toUpperCase(), wa_id: digitos(q.wa_id), intencion }, limite };
    }
    case 'leads': {
      const nivel = t(q.nivel).toUpperCase();
      const orden = t(q.orden).toLowerCase() || 'prioridad';
      if (nivel && !INTENCIONES.includes(nivel)) return fallo(400, `nivel debe ser ${INTENCIONES.join(', ')}.`);
      if (!['prioridad', 'fecha'].includes(orden)) return fallo(400, 'orden debe ser prioridad o fecha.');
      return { ok: true, ruta: r, filtros: { prioridad: nivel, estado: t(q.estado).toUpperCase() }, orden, limite };
    }
    case 'metricas': {
      const desde = t(q.desde);
      const hasta = t(q.hasta);
      const fecha = /^\d{4}-\d{2}-\d{2}$/;
      if ((desde && !fecha.test(desde)) || (hasta && !fecha.test(hasta))) return fallo(400, 'desde y hasta van como AAAA-MM-DD.');
      if (desde && hasta && desde > hasta) return fallo(400, 'desde no puede ser posterior a hasta.');
      return { ok: true, ruta: r, desde, hasta };
    }
    case 'segmento-clientes':
    case 'audiencia':
      if (!SEGMENTOS_API.includes(param)) return fallo(400, `segmento debe ser ${SEGMENTOS_API.join(', ')}.`);
      return { ok: true, ruta: r, segmento: param, limite };
    case 'recomendacion':
      return { ok: true, ruta: r, cliente_id: param };
    // PUT va por su propia rama (config-put / fidelizacion-put): el flujo valida los cambios y los guarda.
    case 'config':
    case 'fidelizacion':
      if (m !== 'PUT') return { ok: true, ruta: r };
      if (!Object.keys(b).length) return fallo(400, 'El cuerpo no puede estar vacío.');
      return { ok: true, ruta: `${r}-put`, cambios: b };
    case 'config-drive':
      if (!t(b.url)) return fallo(400, 'url es obligatoria: el enlace de la carpeta de Drive.');
      return { ok: true, ruta: r, url: t(b.url).slice(0, 500) };
    case 'sync':
      return { ok: true, ruta: r };
    case 'campana-preview':
    case 'campana-enviar':
      if (!SEGMENTOS_API.slice(0, 5).includes(param)) return fallo(400, `segmento debe ser ${SEGMENTOS_API.slice(0, 5).join(', ')}.`);
      // Enviar escribe a clientes reales: se pide una confirmación explícita en el cuerpo.
      if (r === 'campana-enviar' && b.confirmar !== true) return fallo(400, 'Para enviar, manda { "confirmar": true }. Revisa antes la vista previa.');
      return { ok: true, ruta: r, segmento: param };
    case 'cotizaciones':
      return { ok: true, ruta: r, filtros: { solicitud_id: t(q.solicitud_id), estado: t(q.estado).toUpperCase() }, limite };
    case 'proveedores':
      return { ok: true, ruta: r, filtros: {}, limite };
    case 'confirmar-orden': {
      const solicitudId = t(b.solicitud_id);
      if (!solicitudId) return fallo(400, 'solicitud_id es obligatorio.');
      return { ok: true, ruta: r, solicitud_id: solicitudId, simular: b.simular === true, responsable: t(b.responsable).slice(0, 80) || 'API' };
    }
    default:
      return { ok: true, ruta: r };
  }
}

// Filas leídas de Sheets -> lista para la respuesta. Quita filas vacías y el número de fila interno de n8n.
function filtrarFilas(filas, filtros, limite) {
  const f = filtros || {};
  const limpias = (filas || [])
    .filter(x => x && Object.keys(x).some(k => k !== 'row_number' && t(x[k]) !== ''))
    .map(x => { const c = { ...x }; delete c.row_number; return c; })
    .filter(x => Object.entries(f).every(([k, val]) => !val || t(x[k]).toUpperCase() === t(val).toUpperCase()));
  // Lo más reciente primero (las pestañas se escriben en orden de llegada).
  return limpias.reverse().slice(0, limite || 100);
}

function respuestaLista(ruta, filas, filtros, limite) {
  const datos = filtrarFilas(filas, filtros, limite);
  return { status: 200, cuerpo: { ok: true, ruta, total: datos.length, datos } };
}

// Cola de leads para el dashboard: solicitudes con prioridad, la de mayor puntaje primero (o la más reciente).
function respuestaLeads(filas, peticion) {
  const p = peticion || {};
  const todas = filtrarFilas(filas, p.filtros, LIMITE_MAXIMO * 10);
  const puntaje = x => Number(t(x.puntaje_prioridad)) || 0;
  const ordenadas = p.orden === 'fecha'
    ? todas
    : [...todas].sort((a, b) => puntaje(b) - puntaje(a) || t(b.fecha_registro).localeCompare(t(a.fecha_registro)));
  const datos = ordenadas.slice(0, p.limite || 100);
  const conteo = { ALTA: 0, MEDIA: 0, BAJA: 0 };
  for (const x of todas) if (conteo[t(x.prioridad).toUpperCase()] !== undefined) conteo[t(x.prioridad).toUpperCase()] += 1;
  return { status: 200, cuerpo: { ok: true, ruta: 'leads', orden: p.orden || 'prioridad', total: datos.length, conteo, datos } };
}

function respuestaConversacion(filas, waId) {
  const [conv] = filtrarFilas(filas, { wa_id: waId }, 1);
  if (!conv) return { status: 404, cuerpo: { ok: false, error: `No hay conversación para ${waId}.` } };
  return { status: 200, cuerpo: { ok: true, ruta: 'conversacion', datos: conv } };
}

// Salida del subflujo "Procesar mensaje" -> respuesta HTTP de la ruta mensaje.
function respuestaMensaje(mensaje, filasSalida) {
  const salidas = (filasSalida || []).filter(x => x && t(x.texto) && t(x.direccion) === 'SALIDA');
  const respuestas = salidas.map(x => t(x.texto));
  const omitido = salidas.length && salidas.every(x => t(x.resultado) === 'OMITIDO_CAMBIO_MODO');
  return {
    status: 200,
    cuerpo: {
      ok: true, ruta: 'mensaje', mensaje_id: mensaje.mensaje_id, wa_id: mensaje.wa_id,
      respuestas: omitido ? [] : respuestas,
      // Sin respuestas: la conversación está con una persona del equipo, el mensaje era duplicado o el modo cambió.
      atendido_por: respuestas.length && !omitido ? 'bot' : 'equipo_o_sin_respuesta',
    },
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { validarPeticion, resolverRuta, filtrarFilas, respuestaLista, respuestaLeads, respuestaConversacion, respuestaMensaje, RUTAS };
}
