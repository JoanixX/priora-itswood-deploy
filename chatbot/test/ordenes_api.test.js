'use strict';

// Intención de compra, confirmación de órdenes con cotización a proveedores y API.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { HojaMemoria, leerCsv } = require('../sim/hoja_memoria');
const { recibirWebhook, accionHumana, confirmarOrden, llamarApi } = require('../sim/pipeline');
const ev = require('../sim/eventos');
const { prepararCotizaciones, normalizarWhatsapp } = require('../src/ordenes');

const CATALOGO = leerCsv(path.join(__dirname, '..', 'hoja', 'catalogo_bot.csv'));
const ANA = '51987000001';
const PROV_MADERA = '51911111111';
const PROVEEDORES = [
  { proveedor_id: 'P01', nombre: 'Maderas del Norte', whatsapp: '911 111 111', productos: 'TABLA QUESERA ROMA ; MESA PICNIC YARD', activo: '' },
  { proveedor_id: 'P02', nombre: 'Grabados Lima', whatsapp: '+51 922 222 222', productos: 'TODOS', activo: 'SI' },
  { proveedor_id: 'P03', nombre: 'Proveedor inactivo', whatsapp: '933333333', productos: 'TODOS', activo: 'NO' },
  { proveedor_id: 'P04', nombre: 'Otro rubro', whatsapp: '944444444', productos: 'POSA TAZA KOI', activo: '' },
];

function entorno() {
  const hoja = new HojaMemoria(CATALOGO.map(f => ({ ...f })), []);
  hoja.tablas.PROVEEDORES = PROVEEDORES.map(p => ({ ...p }));
  let t = Date.parse('2026-10-17T15:00:00.000Z');
  let n = 0;
  const e = {
    hoja,
    enviados: [],
    plantillas: [],
    config: { phoneNumberId: 'PHONE_PRUEBA' },
    ahora: () => new Date((t += 1000)).toISOString(),
    enviar: async envio => { e.enviados.push(envio); return { messages: [{ id: `wamid.S${++n}` }] }; },
    enviarPlantilla: async envio => {
      if (e.fallarPlantilla) throw new Error('(#132001) Template name does not exist in the translation');
      e.plantillas.push(envio);
      return { messages: [{ id: `wamid.T${++n}` }] };
    },
  };
  e.cliente = async (waId, texto) => {
    const antes = e.enviados.length;
    await recibirWebhook(ev.mensaje(waId, texto, { fecha: new Date(t).toISOString() }), e);
    return e.enviados.slice(antes).filter(x => x.to === waId).map(x => x.texto);
  };
  e.conv = waId => hoja.tablas.BOT_CONVERSACIONES.find(f => f.wa_id === waId);
  return e;
}

const PEDIDO_ROMA = ['Hola', '1', 'Acme SAC', 'Luis', 'Fin de año', 'roma', '1', '20', 'no', 'mañana', 'Av. Javier Prado 100, San Isidro', 'mañanas', '1'];
async function conversar(e, waId, mensajes) { for (const m of mensajes) await e.cliente(waId, m); }

// ---------- intención de compra ----------

test('intención: un pedido completo y confirmado es ALTA y llega a PAUTAS', async () => {
  const e = entorno();
  await conversar(e, ANA, PEDIDO_ROMA);
  const [sol] = e.hoja.tablas.BOT_SOLICITUDES;
  assert.equal(sol.intencion, 'ALTA');
  assert.ok(sol.puntaje_intencion >= 90, `puntaje ${sol.puntaje_intencion}`);
  assert.equal(e.hoja.tablas['PAUTAS '].length, 1);
});

test('intención: va subiendo con los datos y queda en la conversación', async () => {
  const e = entorno();
  await conversar(e, ANA, ['Hola', '2']);
  assert.equal(e.conv(ANA).intencion, 'BAJA');
  await conversar(e, ANA, ['quiero cotizar una tabla roma', '1', '3']);
  assert.equal(e.conv(ANA).intencion, 'MEDIA');
  assert.match(e.conv(ANA).senales_intencion, /compra/);
});

test('intención: "solo estoy viendo" no se trata como error y una derivación BAJA no entra a PAUTAS', async () => {
  const e = entorno();
  await e.cliente(ANA, 'Hola');
  const [r] = await e.cliente(ANA, 'solo estoy viendo');
  assert.match(r, /sin compromiso/);
  assert.equal(e.conv(ANA).intentos, '0');
  await e.cliente(ANA, 'asesor');
  const [sol] = e.hoja.tablas.BOT_SOLICITUDES;
  assert.equal(sol.intencion, 'BAJA');
  assert.equal(e.hoja.tablas['PAUTAS '].length, 0, 'filtrado: no se agrega a PAUTAS');
  assert.equal(e.conv(ANA).modo, 'PENDIENTE_HUMANO', 'igual se atiende');
});

// ---------- órdenes y proveedores ----------

test('confirmar orden: contacta a los proveedores del producto y a los de TODOS, sin inactivos ni de otro producto', async () => {
  const e = entorno();
  await conversar(e, ANA, PEDIDO_ROMA);
  const { solicitud_id } = e.hoja.tablas.BOT_SOLICITUDES[0];
  const r = await confirmarOrden({ solicitud_id }, e);
  assert.equal(r.ok, true);
  assert.deepEqual(e.plantillas.map(p => p.proveedor_id), ['P01', 'P02']);
  assert.equal(e.plantillas[0].wa_proveedor, PROV_MADERA);
  assert.equal(e.plantillas[0].plantilla, 'itswood_solicitud_cotizacion|es');
  assert.deepEqual(e.plantillas[0].parametros, ['Maderas del Norte', solicitud_id, 'Tabla Quesera - ROMA', '20', 'Sin personalización', '18/10/2026']);
  assert.equal(e.hoja.tablas.BOT_SOLICITUDES[0].estado, 'ORDEN_CONFIRMADA');
  assert.deepEqual(e.hoja.tablas.BOT_COTIZACIONES.map(c => c.estado), ['ENVIADA', 'ENVIADA']);
  assert.match(r.resumen, /2 proveedor\(es\): Maderas del Norte, Grabados Lima/);
});

test('confirmar orden dos veces no vuelve a escribir a los mismos proveedores', async () => {
  const e = entorno();
  await conversar(e, ANA, PEDIDO_ROMA);
  const { solicitud_id } = e.hoja.tablas.BOT_SOLICITUDES[0];
  await confirmarOrden({ solicitud_id }, e);
  const r = await confirmarOrden({ solicitud_id }, e);
  assert.equal(e.plantillas.length, 2);
  assert.match(r.resumen, /ya habían sido contactados/);
});

test('confirmar orden: sin cantidad no se confirma; plantilla rechazada queda como ERROR_ENVIO y se puede reintentar', async () => {
  const e = entorno();
  await conversar(e, ANA, ['Hola', '2', 'roma', '1', 'asesor']);
  const pendiente = await confirmarOrden({ solicitud_id: e.hoja.tablas.BOT_SOLICITUDES[0].solicitud_id }, e);
  assert.equal(pendiente.ok, false);
  assert.match(pendiente.error, /no tiene producto y cantidad/);

  const otra = entorno();
  await conversar(otra, ANA, PEDIDO_ROMA);
  const { solicitud_id } = otra.hoja.tablas.BOT_SOLICITUDES[0];
  otra.fallarPlantilla = true;
  await confirmarOrden({ solicitud_id }, otra);
  assert.deepEqual(otra.hoja.tablas.BOT_COTIZACIONES.map(c => c.estado), ['ERROR_ENVIO', 'ERROR_ENVIO']);
  assert.match(otra.hoja.tablas.BOT_COTIZACIONES[0].detalle, /132001/);
  otra.fallarPlantilla = false;
  await confirmarOrden({ solicitud_id }, otra);
  assert.equal(otra.plantillas.length, 2, 'los que fallaron se reintentan');
});

test('parámetros de plantilla sin saltos de línea y teléfonos normalizados', () => {
  const r = prepararCotizaciones({
    solicitud: { solicitud_id: 'SOL-1', producto_id: 'PR-492A873B', producto_nombre: 'Tabla Quesera - ROMA', cantidad: 5, personalizacion: 'Logo\n\n  en   la esquina', fecha_deseada: 'Lo antes posible' },
    proveedores: PROVEEDORES, cotizaciones: [], catalogo: CATALOGO, simular: true,
  });
  assert.equal(r.envios[0].parametros[4], 'Logo en la esquina');
  assert.equal(r.envios[0].parametros[5], 'Lo antes posible');
  assert.equal(r.envios[0].estado, 'SIMULADA');
  assert.equal(normalizarWhatsapp('+51 922 222 222'), '51922222222');
  assert.equal(normalizarWhatsapp('12345'), '');
});

test('la respuesta de un proveedor se guarda en su cotización y el bot de clientes no le contesta', async () => {
  const e = entorno();
  await conversar(e, ANA, PEDIDO_ROMA);
  await confirmarOrden({ solicitud_id: e.hoja.tablas.BOT_SOLICITUDES[0].solicitud_id }, e);
  assert.deepEqual(await e.cliente(PROV_MADERA, 'S/ 60 c/u, entrega en 7 días'), []);
  await e.cliente(PROV_MADERA, 'incluye el grabado');
  const cot = e.hoja.tablas.BOT_COTIZACIONES.find(c => c.proveedor_id === 'P01');
  assert.equal(cot.estado, 'RESPONDIDA');
  assert.equal(cot.respuesta, 'S/ 60 c/u, entrega en 7 días | incluye el grabado');
  assert.equal(e.conv(PROV_MADERA), undefined, 'el proveedor no abre una conversación de cliente');
  // Un proveedor sin cotización abierta queda registrado igual.
  await e.cliente('51944444444', 'Hola, ¿necesitan algo?');
  assert.equal(e.hoja.tablas.BOT_EVENTOS.at(-1).resultado, 'PROVEEDOR_SIN_COTIZACION_ABIERTA');
});

test('formulario: "Confirmar orden" confirma la última solicitud del cliente sin cambiar el modo', async () => {
  const e = entorno();
  await conversar(e, ANA, PEDIDO_ROMA);
  const r = await accionHumana({ 'WhatsApp del cliente': ANA, 'Acción': 'Confirmar orden', 'Mensaje al cliente': '', 'Responsable': 'Carla' }, e);
  assert.equal(r.ok, true);
  assert.match(r.texto_resultado, /pidió cotización a 2 proveedor/);
  assert.equal(e.conv(ANA).modo, 'PENDIENTE_HUMANO');
});

// ---------- API ----------

test('API: salud, ruta desconocida, método incorrecto y validación', async () => {
  const e = entorno();
  assert.equal((await llamarApi({ metodo: 'GET', ruta: 'salud' }, e)).status, 200);
  assert.equal((await llamarApi({ metodo: 'GET', ruta: 'nada' }, e)).status, 404);
  assert.equal((await llamarApi({ metodo: 'GET', ruta: 'mensaje' }, e)).status, 405);
  const sinTexto = await llamarApi({ metodo: 'POST', ruta: 'mensaje', body: { wa_id: ANA } }, e);
  assert.equal(sinTexto.status, 400);
  assert.match(sinTexto.cuerpo.error, /texto es obligatorio/);
});

test('API: una plataforma conversa con el bot por HTTP y no se envía nada por WhatsApp', async () => {
  const e = entorno();
  const r1 = await llamarApi({ metodo: 'POST', ruta: 'mensaje', body: { wa_id: ANA, texto: 'Hola', nombre: 'Ana' } }, e);
  assert.equal(r1.status, 200);
  assert.match(r1.cuerpo.respuestas[0], /ITS WOOD/);
  assert.equal(r1.cuerpo.atendido_por, 'bot');
  const r2 = await llamarApi({ metodo: 'POST', ruta: 'mensaje', body: { wa_id: ANA, texto: '2' } }, e);
  assert.match(r2.cuerpo.respuestas[0], /Qué producto/);
  assert.equal(e.enviados.length, 0);
  const conv = await llamarApi({ metodo: 'GET', ruta: 'conversacion', query: { wa_id: ANA } }, e);
  assert.equal(conv.cuerpo.datos.paso, 'P_PRODUCTO');
  assert.equal((await llamarApi({ metodo: 'GET', ruta: 'conversacion', query: { wa_id: '51999999999' } }, e)).status, 404);
});

test('API: listar solicitudes por intención, confirmar orden simulada y ver cotizaciones', async () => {
  const e = entorno();
  await conversar(e, ANA, PEDIDO_ROMA);
  await conversar(e, '51987000002', ['Hola', 'asesor']);
  const altas = await llamarApi({ metodo: 'GET', ruta: 'solicitudes', query: { intencion: 'alta' } }, e);
  assert.equal(altas.cuerpo.total, 1);
  assert.equal(altas.cuerpo.datos[0].wa_id, ANA);
  assert.equal((await llamarApi({ metodo: 'GET', ruta: 'solicitudes', query: { intencion: 'x' } }, e)).status, 400);

  const { solicitud_id } = altas.cuerpo.datos[0];
  const conf = await llamarApi({ metodo: 'POST', ruta: 'confirmar-orden', body: { solicitud_id, simular: true } }, e);
  assert.equal(conf.status, 200);
  assert.deepEqual(conf.cuerpo.cotizaciones.map(c => c.estado), ['SIMULADA', 'SIMULADA']);
  assert.equal(e.plantillas.length, 0, 'simular no envía plantillas');
  const cots = await llamarApi({ metodo: 'GET', ruta: 'cotizaciones', query: { solicitud_id } }, e);
  assert.equal(cots.cuerpo.total, 2);
  const no = await llamarApi({ metodo: 'POST', ruta: 'confirmar-orden', body: { solicitud_id: 'SOL-NO' } }, e);
  assert.equal(no.status, 404);
  assert.equal((await llamarApi({ metodo: 'GET', ruta: 'proveedores' }, e)).cuerpo.total, 4);
});
