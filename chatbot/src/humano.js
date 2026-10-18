'use strict';

// Decide qué hace el formulario de atención humana: tomar, responder, devolver al bot o cerrar.
// No envía ni escribe: devuelve el cambio de modo y el mensaje que el flujo enviará.

const VENTANA_HORAS = 24;
const ACCIONES = {
  'Tomar caso': 'HUMANO',
  'Responder': 'HUMANO',
  'Devolver al bot': 'BOT',
  'Cerrar caso': 'CERRADO',
  // No cambia el modo: confirma la última solicitud del cliente y pide cotización a los proveedores.
  'Confirmar orden': null,
};
const CAMPOS_FORMULARIO = { wa: 'WhatsApp del cliente', accion: 'Acción', mensaje: 'Mensaje al cliente', responsable: 'Responsable' };

function t(v) { return v === undefined || v === null ? '' : String(v).trim(); }

function decidirAccionHumana({ formulario, filas, ahora }) {
  const ahoraIso = ahora || new Date().toISOString();
  const waId = t(formulario[CAMPOS_FORMULARIO.wa]).replace(/\D/g, '');
  const accion = t(formulario[CAMPOS_FORMULARIO.accion]);
  const mensaje = t(formulario[CAMPOS_FORMULARIO.mensaje]);
  const responsable = t(formulario[CAMPOS_FORMULARIO.responsable]);
  const error = texto => ({ ok: false, wa_id: waId, texto_resultado: texto });

  if (!waId) return error('Escribe el número de WhatsApp del cliente con código de país, por ejemplo 51987654321.');
  if (!(accion in ACCIONES)) return error('Elige una acción válida.');
  if (!responsable) return error('Indica quién atiende el caso.');
  if (accion === 'Responder' && !mensaje) return error('Escribe el mensaje que quieres enviar.');
  const conv = (filas || []).find(f => f && t(f.wa_id) === waId);
  if (!conv) return error(`No hay una conversación registrada para ${waId}.`);

  if (mensaje) {
    const ultima = Date.parse(t(conv.ultima_entrada));
    const horas = Number.isFinite(ultima) ? (Date.parse(ahoraIso) - ultima) / 36e5 : Infinity;
    if (horas > VENTANA_HORAS) {
      return error('El último mensaje del cliente tiene más de 24 horas: WhatsApp no permite enviarle texto libre. Hace falta una plantilla aprobada (segunda etapa). No se cambió nada.');
    }
  }

  if (accion === 'Confirmar orden') {
    if (!t(conv.solicitud_id)) return error('Ese cliente todavía no tiene una solicitud registrada.');
    if (mensaje) return error('Confirmar orden no envía mensaje al cliente: deja el mensaje vacío y usa Responder aparte.');
  }
  const modo = ACCIONES[accion] || t(conv.modo);
  const avisos = {
    HUMANO: 'El caso quedó en atención humana; el bot no responderá a este cliente.',
    BOT: 'El caso volvió al bot; responderá al próximo mensaje del cliente.',
    CERRADO: 'El caso quedó cerrado. Si el cliente vuelve a escribir, el bot iniciará una conversación nueva.',
  };
  const confirmar = accion === 'Confirmar orden' ? t(conv.solicitud_id) : '';
  return {
    ok: true,
    wa_id: waId,
    modo,
    modo_anterior: t(conv.modo),
    responsable,
    actualizado_en: ahoraIso,
    conversacion_id: t(conv.conversacion_id),
    enviar: mensaje,
    confirmar_solicitud: confirmar,
    texto_resultado: confirmar ? `Orden ${confirmar} confirmada.` : avisos[modo],
  };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { decidirAccionHumana, CAMPOS_FORMULARIO, ACCIONES };
