'use strict';

// Construye cuerpos de webhook con el formato de WhatsApp Cloud API para las pruebas y el chat local.

let secuencia = 0;

function envolver(valor) {
  return {
    object: 'whatsapp_business_account',
    entry: [{ id: 'WABA_PRUEBA', changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', metadata: { display_phone_number: '51900000000', phone_number_id: 'PHONE_PRUEBA' }, ...valor } }] }],
  };
}

function mensaje(waId, contenido, opciones = {}) {
  secuencia += 1;
  const id = opciones.id || `wamid.PRUEBA${secuencia}`;
  const timestamp = String(Math.floor(Date.parse(opciones.fecha || new Date().toISOString()) / 1000));
  const base = { from: waId, id, timestamp };
  let msg;
  if (typeof contenido === 'string') msg = { ...base, type: 'text', text: { body: contenido } };
  else msg = { ...base, ...contenido };
  return envolver({ contacts: [{ profile: { name: opciones.perfil || 'Cliente Prueba' }, wa_id: waId }], messages: [msg] });
}

function estado(mensajeId, waId, status, error) {
  return envolver({ statuses: [{ id: mensajeId, recipient_id: waId, status, timestamp: String(Math.floor(Date.now() / 1000)), errors: error ? [error] : undefined }] });
}

const imagen = (mediaId, caption) => ({ type: 'image', image: { id: mediaId, mime_type: 'image/jpeg', caption } });
const audio = mediaId => ({ type: 'audio', audio: { id: mediaId, mime_type: 'audio/ogg; codecs=opus', voice: true } });
const ubicacion = (lat, lng, nombre, direccion) => ({ type: 'location', location: { latitude: lat, longitude: lng, name: nombre, address: direccion } });

module.exports = { mensaje, estado, imagen, audio, ubicacion };
