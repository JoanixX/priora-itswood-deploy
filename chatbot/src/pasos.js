'use strict';

// Decisiones del subflujo "Procesar mensaje" que rodean al motor: duplicados, cambio de modo y envíos.
// Se usan tal cual en los nodos Code de n8n y en el simulador local.

function s(v) { return v === undefined || v === null ? '' : String(v); }
function modoDe(fila) { return fila ? s(fila.modo).trim().toUpperCase() : ''; }
function filaDe(filas, waId) { return (filas || []).find(f => f && s(f.wa_id) !== '' && s(f.wa_id) === s(waId)) || null; }

// Un evento ya visto se omite salvo que haya quedado en RECIBIDO (falló antes de guardar el estado).
// Si ya se guardó el estado no se recalcula: así no se repiten preguntas ni envíos.
function esDuplicado(mensaje, filasEventos) {
  return (filasEventos || []).some(f => f && s(f.mensaje_id) === s(mensaje.mensaje_id) && s(f.resultado) !== '' && s(f.resultado) !== 'RECIBIDO');
}

// Antes de guardar: si una persona cambió el modo mientras el motor trabajaba, no se pisa su cambio.
function verificarCambioModo(motor, filasConversacion) {
  const actual = modoDe(filaDe(filasConversacion, motor.wa_id));
  return { cambio: actual !== s(motor.modo_leido).toUpperCase(), modo_actual: actual };
}

// Justo antes de enviar: se vuelve a comparar el modo guardado con el que dejó el motor.
function prepararEnvios(motor, mensaje, filasConversacion, phoneNumberId) {
  const actual = modoDe(filaDe(filasConversacion, motor.wa_id));
  const esperado = s(motor.conversacion.modo).toUpperCase();
  return (motor.respuestas || []).map((texto, i) => {
    const base = {
      wa_id: motor.wa_id, conversacion_id: motor.conversacion.conversacion_id,
      en_respuesta_a: mensaje.mensaje_id, orden: i + 1, texto,
    };
    if (actual !== esperado) {
      return { ...base, accion: 'registrar', resultado: 'OMITIDO_CAMBIO_MODO', mensaje_id: `OMIT-${mensaje.mensaje_id}-${i + 1}`, detalle: `modo actual ${actual || '(vacío)'}` };
    }
    if (mensaje.origen === 'api') {
      return { ...base, accion: 'registrar', resultado: 'API', mensaje_id: `API-OUT-${mensaje.mensaje_id}-${i + 1}`, detalle: 'respuesta devuelta por la API' };
    }
    if (mensaje.origen === 'simulacion') {
      return { ...base, accion: 'registrar', resultado: 'SIMULADO', mensaje_id: `SIM-${mensaje.mensaje_id}-${i + 1}`, detalle: 'webhook de simulación: no se envió por WhatsApp' };
    }
    return { ...base, accion: 'enviar', to: motor.wa_id, phone_number_id: s(mensaje.phone_number_id) || s(phoneNumberId) };
  });
}

if (typeof module !== 'undefined' && module.exports) module.exports = { esDuplicado, verificarCambioModo, prepararEnvios, filaDe };
