'use strict';

// Convierte lo que llega al flujo de entrada en eventos planos: un elemento por mensaje y otro por estado de entrega.
// Acepta la salida del WhatsApp Trigger de n8n, el cuerpo crudo del webhook de Meta y el webhook de simulación
// ({ headers, body }). Los estados "sent" se descartan: el envío ya se registra con la respuesta de la API.

const MAX_TEXTO_ENTRADA = 1000;

function txt(v) { return v === undefined || v === null ? '' : String(v); }
function corto(v) { const s = txt(v); return s.length > MAX_TEXTO_ENTRADA ? s.slice(0, MAX_TEXTO_ENTRADA) : s; }

function valoresWhatsApp(obj) {
  if (!obj || typeof obj !== 'object') return [];
  if (Array.isArray(obj.entry)) return obj.entry.flatMap(e => (e.changes || []).map(c => c.value || {}));
  if (Array.isArray(obj.changes)) return obj.changes.map(c => c.value || {});
  if (obj.value && typeof obj.value === 'object' && !obj.messages && !obj.statuses) return [obj.value];
  if (obj.messages || obj.statuses) return [obj];
  return [];
}

function fechaIso(segundos) {
  const n = Number(segundos);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : new Date().toISOString();
}

function normalizarMensaje(msg, valor, origen) {
  const contacto = (valor.contacts || []).find(c => c.wa_id === msg.from) || (valor.contacts || [])[0] || {};
  const evento = {
    tipo_evento: 'mensaje',
    origen,
    mensaje_id: txt(msg.id),
    wa_id: txt(msg.from),
    telefono: txt(msg.from),
    nombre_perfil: txt(contacto.profile && contacto.profile.name),
    phone_number_id: txt(valor.metadata && valor.metadata.phone_number_id),
    fecha_iso: fechaIso(msg.timestamp),
    tipo: txt(msg.type),
    texto: '',
    opcion_id: '',
    media_id: '',
    latitud: '',
    longitud: '',
  };
  const m = msg[msg.type] || {};
  switch (msg.type) {
    case 'text': evento.texto = m.body; break;
    case 'interactive': {
      const r = m.button_reply || m.list_reply || {};
      evento.texto = r.title;
      evento.opcion_id = r.id;
      break;
    }
    case 'button': evento.texto = m.text; evento.opcion_id = m.payload; break;
    case 'image': case 'video': case 'document': case 'sticker':
      evento.media_id = m.id;
      evento.texto = m.caption;
      break;
    case 'audio': evento.media_id = m.id; break;
    case 'location':
      evento.texto = [m.name, m.address].filter(Boolean).join(' - ');
      evento.latitud = txt(m.latitude);
      evento.longitud = txt(m.longitude);
      break;
    case 'reaction': evento.texto = m.emoji; break;
    default: break;
  }
  for (const k of ['texto', 'opcion_id', 'media_id']) evento[k] = corto(evento[k]);
  return evento;
}

function normalizarEstado(st) {
  const error = (st.errors || [])[0];
  return {
    tipo_evento: 'estado',
    mensaje_id: txt(st.id),
    wa_id: txt(st.recipient_id),
    estado: txt(st.status),
    fecha_iso: fechaIso(st.timestamp),
    detalle: error ? corto(`${txt(error.code)} ${txt(error.title)} ${txt(error.message)}`.trim()) : '',
  };
}

function normalizarEntrada(items) {
  const eventos = [];
  for (const item of items || []) {
    const json = item && item.json !== undefined ? item.json : item;
    const esSimulacion = !!(json && json.body && json.headers);
    const origen = esSimulacion ? 'simulacion' : 'whatsapp';
    for (const valor of valoresWhatsApp(esSimulacion ? json.body : json)) {
      for (const msg of valor.messages || []) if (msg && msg.id && msg.from) eventos.push(normalizarMensaje(msg, valor, origen));
      for (const st of valor.statuses || []) if (st && st.id && st.status !== 'sent') eventos.push(normalizarEstado(st));
    }
  }
  return eventos;
}

if (typeof module !== 'undefined' && module.exports) module.exports = { normalizarEntrada };
