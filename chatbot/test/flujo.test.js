'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { HojaMemoria, leerCsv } = require('../sim/hoja_memoria');
const { recibirWebhook, accionHumana } = require('../sim/pipeline');
const ev = require('../sim/eventos');
const { normalizarEntrada } = require('../src/normalizar');
const { buscarProductos, leerCatalogo } = require('../src/motor');

const CATALOGO = leerCsv(path.join(__dirname, '..', 'hoja', 'catalogo_bot.csv'));
const ANA = '51987000001';
const LUIS = '51987000002';

// Entorno con reloj fijo (avanza un segundo por consulta) y un envío simulado que guarda lo enviado.
// Fila de INVENTARIO tal como la devuelve Sheets con el rango H3:I300 (cabeceras con espacio final).
const inv = (item, unidades) => ({ 'ITEM ': item, 'UNIDADES ': unidades });
const INVENTARIO = [inv('TABLA QUESERA ROMA ', 6), inv('MINI TABLA RACKET ', 'DESCONTINUADO'), inv('MESA PICNIC YARD', 0), inv('POSA VASO SCAR ', 'SIN STOCK ')];

function entorno(opciones = {}) {
  const hoja = new HojaMemoria(opciones.catalogo || CATALOGO.map(f => ({ ...f })), opciones.inventario || INVENTARIO.map(f => ({ ...f })));
  let t = Date.parse(opciones.inicio || '2026-10-17T15:00:00.000Z');
  const enviados = [];
  let n = 0;
  const e = {
    hoja,
    enviados,
    config: { phoneNumberId: 'PHONE_PRUEBA', waAvisos: opciones.waAvisos || '' },
    ahora: () => new Date((t += 1000)).toISOString(),
    avanzarHoras: h => { t += h * 36e5; },
    enviar: async envio => {
      if (e.fallarEnvio) throw new Error('(#131000) Something went wrong');
      enviados.push(envio);
      n += 1;
      return { messages: [{ id: `wamid.SALIDA${n}` }] };
    },
  };
  // Envía un mensaje del cliente y devuelve los textos que el bot le respondió.
  e.cliente = async (waId, contenido, extra = {}) => {
    const antes = enviados.length;
    const fecha = new Date(t).toISOString();
    await recibirWebhook(ev.mensaje(waId, contenido, { fecha, ...extra }), e);
    return enviados.slice(antes).filter(x => !x.aviso && x.to === waId).map(x => x.texto);
  };
  e.conv = waId => hoja.tablas.BOT_CONVERSACIONES.find(f => f.wa_id === waId);
  return e;
}

async function conversar(e, waId, mensajes) {
  let ultimas = [];
  for (const m of mensajes) ultimas = await e.cliente(waId, m);
  return ultimas;
}

test('camino persona completo: registra la solicitud con el precio del catálogo y deriva', async () => {
  const e = entorno();
  const [saludo] = await e.cliente(ANA, 'Hola');
  assert.match(saludo, /ITS WOOD/);
  assert.match(saludo, /1️⃣ Para una empresa/);

  assert.match((await e.cliente(ANA, '2'))[0], /Qué producto te interesa/);
  const [lista] = await e.cliente(ANA, 'tabla roma');
  assert.match(lista, /1\. Tabla Quesera - ROMA — S\/ 85\.00/);
  assert.match((await e.cliente(ANA, '1'))[0], /Elegiste Tabla Quesera - ROMA \(S\/ 85\.00 c\/u/);
  assert.match((await e.cliente(ANA, '3'))[0], /personalizarlo/);
  assert.match((await e.cliente(ANA, 'Con la frase "Feliz aniversario"'))[0], /queda registrada como solicitud/);
  assert.match((await e.cliente(ANA, '20/12/2026'))[0], /20\/12\/2026.*sujeta a confirmación/s);
  assert.match((await e.cliente(ANA, 'Ana Pérez'))[0], /dirección/);
  assert.match((await e.cliente(ANA, 'Av. Larco 123, Miraflores'))[0], /horario/);
  const [resumen] = await e.cliente(ANA, 'Tardes de 2 a 6');
  assert.match(resumen, /Total referencial: S\/ 255\.00/);
  assert.match(resumen, /Fecha deseada: 20\/12\/2026 \(por confirmar\)/);

  const [cierre] = await e.cliente(ANA, '1');
  assert.match(cierre, /Registré tu solicitud SOL-20261017-0001-/);

  const [sol] = e.hoja.tablas.BOT_SOLICITUDES;
  assert.equal(sol.segmento, 'PERSONA');
  assert.equal(sol.producto_id, 'PR-492A873B');
  assert.equal(sol.precio_unitario_ref, 85);
  assert.equal(sol.cantidad, 3);
  assert.equal(sol.total_referencial, 255);
  assert.equal(sol.fecha_deseada, '2026-12-20');
  assert.equal(sol.fecha_confirmada, 'PENDIENTE');
  assert.equal(sol.estado, 'PENDIENTE_HUMANO');
  assert.equal(sol.motivo, 'SOLICITUD_COMPLETA');
  assert.equal(e.conv(ANA).modo, 'PENDIENTE_HUMANO');
  assert.equal(e.hoja.tablas.BOT_CLIENTES[0].nombre, 'Ana Pérez');

  // Con el caso pendiente de una persona, el bot registra pero no contesta.
  assert.deepEqual(await e.cliente(ANA, '¿Me confirman?'), []);
  const ultimo = e.hoja.tablas.BOT_EVENTOS.filter(x => x.direccion === 'ENTRADA').pop();
  assert.equal(ultimo.resultado, 'SIN_RESPUESTA_ATENCION_HUMANA');
  assert.equal(ultimo.texto, '¿Me confirman?');
});

test('camino empresa: exige cantidad exacta, acepta logo como imagen y fecha en palabras', async () => {
  const e = entorno();
  await conversar(e, LUIS, ['Buenas', '1']);
  assert.match((await e.cliente(LUIS, 'Acme SAC'))[0], /persona de contacto/);
  assert.match((await e.cliente(LUIS, 'Luis Torres'))[0], /ocasión/);
  assert.match((await e.cliente(LUIS, 'Fin de año'))[0], /Qué producto/);
  const [lista] = await e.cliente(LUIS, 'posataza koi');
  assert.match(lista, /3\. Posataza para cafe - Koi — S\/ 45\.00/);
  await e.cliente(LUIS, '3');
  assert.match((await e.cliente(LUIS, '50 o más'))[0], /cantidad exacta/);
  assert.match((await e.cliente(LUIS, 'entre 50 y 100'))[0], /cantidad exacta/);
  assert.match((await e.cliente(LUIS, '60'))[0], /personalizarlo/);
  assert.match((await e.cliente(LUIS, ev.imagen('MEDIA_LOGO', 'logo en una esquina')))[0], /Recibí la imagen/);
  assert.match((await e.cliente(LUIS, '15 de diciembre'))[0], /15\/12\/2026/);
  await e.cliente(LUIS, 'Calle Las Begonias 441, San Isidro');
  const [resumen] = await e.cliente(LUIS, 'Lunes a viernes de 9 a 5');
  assert.match(resumen, /Empresa: Acme SAC/);
  assert.match(resumen, /Total referencial: S\/ 2,700\.00/);
  await e.cliente(LUIS, 'confirmar');

  const [sol] = e.hoja.tablas.BOT_SOLICITUDES;
  assert.equal(sol.segmento, 'EMPRESA');
  assert.equal(sol.empresa, 'Acme SAC');
  assert.equal(sol.ocasion, 'Fin de año');
  assert.equal(sol.cantidad, 60);
  assert.equal(sol.total_referencial, 2700);
  assert.equal(sol.logo_media_id, 'MEDIA_LOGO');
  assert.match(sol.personalizacion, /Imagen\/logo enviado: logo en una esquina/);
});

test('pedir un asesor en cualquier paso deriva con los datos reunidos', async () => {
  const e = entorno({ waAvisos: '51999999999' });
  await conversar(e, ANA, ['Hola', '2', 'mesa picnic yard', '1']);
  const [r] = await e.cliente(ANA, 'mejor quiero hablar con una persona');
  assert.match(r, /Te comunico con una persona/);
  const [sol] = e.hoja.tablas.BOT_SOLICITUDES;
  assert.equal(sol.motivo, 'SOLICITUD_CLIENTE');
  assert.equal(sol.producto_id, 'PR-432598B6');
  assert.equal(sol.cantidad, '');
  assert.match(sol.resumen, /Último mensaje: mejor quiero hablar con una persona/);
  const aviso = e.enviados.find(x => x.aviso);
  assert.equal(aviso.to, '51999999999');
  assert.match(aviso.texto, /Nueva atención ITS WOOD/);
});

test('ASESOR desde el primer mensaje deriva sin pasar por el menú', async () => {
  const e = entorno();
  const [r] = await e.cliente(ANA, 'Quiero hablar con un asesor');
  assert.match(r, /Te comunico/);
  assert.equal(e.conv(ANA).modo, 'PENDIENTE_HUMANO');
});

test('mínimos: sin columna "minimo" no se asume ninguno; con ella se valida por producto', async () => {
  const sinMinimo = entorno();
  await conversar(sinMinimo, ANA, ['Hola', '2', 'espejo aura', '1']);
  assert.match((await sinMinimo.cliente(ANA, '1'))[0], /personalizarlo/);

  const catalogo = CATALOGO.map(f => ({ ...f, minimo: f.id === 'PR-459E2D67' ? '12' : '' }));
  const conMinimo = entorno({ catalogo });
  await conversar(conMinimo, ANA, ['Hola', '2', 'espejo aura', '1']);
  assert.match((await conMinimo.cliente(ANA, '5'))[0], /El mínimo para Espejo de Bolsillo - AURA es de 12 unidades/);
  assert.match((await conMinimo.cliente(ANA, '12'))[0], /personalizarlo/);
});

test('stock registrado menor que la cantidad: avisa que el resto depende de producción', async () => {
  const e = entorno();
  await conversar(e, ANA, ['Hola', '2', 'mini tabla arbolito', '1']);
  assert.match((await e.cliente(ANA, '5'))[0], /Hoy hay 2 unidad\(es\) en stock/);
});

test('fechas: rechaza pasadas y hoy, acepta SIN FECHA', async () => {
  const e = entorno();
  await conversar(e, ANA, ['Hola', '2', 'roma', '1', '2', 'no']);
  assert.match((await e.cliente(ANA, '01/01/2026'))[0], /ya pasó/);
  assert.match((await e.cliente(ANA, '17/10/2026'))[0], /ya pasó o es hoy/);
  assert.match((await e.cliente(ANA, 'sin fecha'))[0], /Cuál es tu nombre/);
  assert.equal(e.conv(ANA).fecha_deseada, 'Sin fecha definida');
});

test('nombre, dirección y horario son preguntas separadas', async () => {
  const e = entorno();
  await conversar(e, ANA, ['Hola', '2', 'roma', '1', '2', 'no', 'mañana']);
  assert.equal(e.conv(ANA).paso, 'P_NOMBRE');
  await e.cliente(ANA, 'Ana');
  assert.equal(e.conv(ANA).paso, 'P_DIRECCION');
  await e.cliente(ANA, ev.ubicacion(-12.12, -77.03, 'Casa', 'Av. Pardo 500, Miraflores'));
  assert.equal(e.conv(ANA).paso, 'P_HORARIO');
  assert.match(e.conv(ANA).direccion, /Ubicación compartida: Casa - Av. Pardo 500/);
  assert.equal(e.conv(ANA).fecha_deseada, '2026-10-18');
});

test('cambiar de camino conserva los datos válidos', async () => {
  const e = entorno();
  await conversar(e, ANA, ['Hola', '2', 'roma', '1', '10']);
  assert.match((await e.cliente(ANA, 'menu'))[0], /Tus datos se conservan/);
  assert.match((await e.cliente(ANA, '1'))[0], /nombre de tu empresa/);
  await conversar(e, ANA, ['Café Lima', 'Ana', 'Aniversario']);
  // Producto y cantidad ya estaban: sigue con la personalización.
  assert.equal(e.conv(ANA).paso, 'P_PERSONALIZACION');
  assert.equal(e.conv(ANA).producto_id, 'PR-492A873B');
  assert.equal(e.conv(ANA).cantidad, '10');
});

test('corregir un dato desde el resumen recalcula el total', async () => {
  const e = entorno();
  await conversar(e, ANA, ['Hola', '2', 'roma', '1', '2', 'no', 'sin fecha', 'Ana', 'Jr. Cusco 120, Lima', 'mañanas', '2']);
  assert.match((await e.cliente(ANA, '2'))[0], /Cuántas unidades/);
  const [resumen] = await e.cliente(ANA, '4');
  assert.match(resumen, /Total referencial: S\/ 340\.00/);
});

test('dos clientes intercalados no mezclan registros', async () => {
  const e = entorno();
  await e.cliente(ANA, 'Hola');
  await e.cliente(LUIS, 'Hola');
  await e.cliente(ANA, '2');
  await e.cliente(LUIS, '1');
  await e.cliente(ANA, 'roma');
  await e.cliente(LUIS, 'Acme');
  assert.equal(e.conv(ANA).segmento, 'PERSONA');
  assert.equal(e.conv(ANA).empresa, '');
  assert.equal(e.conv(LUIS).segmento, 'EMPRESA');
  assert.equal(e.conv(LUIS).empresa, 'Acme');
  assert.equal(e.conv(LUIS).candidatos, '');
  assert.notEqual(e.conv(ANA).candidatos, '');
});

test('dos mensajes seguidos del mismo cliente se procesan en orden', async () => {
  const e = entorno();
  await e.cliente(ANA, 'Hola');
  const cuerpo = ev.mensaje(ANA, '2');
  cuerpo.entry[0].changes[0].value.messages.push({ from: ANA, id: 'wamid.SEGUIDO', timestamp: '1792249201', type: 'text', text: { body: 'roma' } });
  await recibirWebhook(cuerpo, e);
  assert.equal(e.conv(ANA).paso, 'P_PRODUCTO');
  assert.match(e.enviados.at(-1).texto, /Tabla Quesera - ROMA/);
});

test('mensaje duplicado: no se procesa ni se responde dos veces', async () => {
  const e = entorno();
  const cuerpo = ev.mensaje(ANA, 'Hola', { id: 'wamid.DUP' });
  await recibirWebhook(cuerpo, e);
  await recibirWebhook(cuerpo, e);
  assert.equal(e.enviados.length, 1);
  assert.equal(e.hoja.tablas.BOT_EVENTOS.filter(x => x.mensaje_id === 'wamid.DUP').length, 1);
});

test('reinicio: el paso se recupera desde la hoja', async () => {
  const e = entorno();
  await conversar(e, ANA, ['Hola', '2', 'roma', '1']);
  // Simula un reinicio: nada en memoria salvo las filas de la hoja.
  const copia = entorno();
  copia.hoja.tablas = JSON.parse(JSON.stringify(e.hoja.tablas));
  assert.match((await copia.cliente(ANA, '7'))[0], /personalizarlo/);
  assert.equal(copia.conv(ANA).cantidad, '7');
});

test('caída de Sheets al guardar: no se envía nada y el reintento procesa una sola vez', async () => {
  const e = entorno();
  await e.cliente(ANA, 'Hola');
  e.hoja.interceptar = (op, tabla) => { if (op === 'guardar' && tabla === 'BOT_CONVERSACIONES') throw new Error('Quota exceeded'); };
  const cuerpo = ev.mensaje(ANA, '2', { id: 'wamid.CAIDA' });
  await assert.rejects(recibirWebhook(cuerpo, e), /Quota exceeded/);
  assert.equal(e.enviados.length, 1);
  assert.equal(e.hoja.tablas.BOT_EVENTOS.find(x => x.mensaje_id === 'wamid.CAIDA').resultado, 'RECIBIDO');
  assert.equal(e.conv(ANA).paso, 'SEGMENTO');

  e.hoja.interceptar = null;
  await recibirWebhook(cuerpo, e);
  await recibirWebhook(cuerpo, e);
  assert.equal(e.enviados.length, 2);
  assert.equal(e.conv(ANA).paso, 'P_PRODUCTO');
});

test('error de envío: se registra y no se reenvía automáticamente', async () => {
  const e = entorno();
  e.fallarEnvio = true;
  const cuerpo = ev.mensaje(ANA, 'Hola', { id: 'wamid.ERRENVIO' });
  await recibirWebhook(cuerpo, e);
  const salida = e.hoja.tablas.BOT_EVENTOS.find(x => x.direccion === 'SALIDA');
  assert.equal(salida.resultado, 'ERROR_ENVIO');
  assert.match(salida.detalle, /131000/);
  e.fallarEnvio = false;
  await recibirWebhook(cuerpo, e);
  assert.equal(e.enviados.length, 0);
});

test('si una persona toma el caso mientras el bot procesa, el bot no pisa el modo ni responde', async () => {
  const e = entorno();
  await e.cliente(ANA, 'Hola');
  let lecturas = 0;
  e.hoja.interceptar = (op, tabla, hoja) => {
    if (op === 'leer' && tabla === 'BOT_CONVERSACIONES' && ++lecturas === 2) hoja.tablas.BOT_CONVERSACIONES[0].modo = 'HUMANO';
  };
  assert.deepEqual(await e.cliente(ANA, '2'), []);
  assert.equal(e.conv(ANA).modo, 'HUMANO');
  assert.equal(e.conv(ANA).paso, 'SEGMENTO');
  assert.equal(e.hoja.tablas.BOT_EVENTOS.filter(x => x.direccion === 'ENTRADA').pop().resultado, 'OMITIDO_CAMBIO_MODO');
});

test('si la toma ocurre después de guardar y antes de enviar, el envío se omite y queda registrado', async () => {
  const e = entorno();
  await e.cliente(ANA, 'Hola');
  let lecturas = 0;
  e.hoja.interceptar = (op, tabla, hoja) => {
    if (op === 'leer' && tabla === 'BOT_CONVERSACIONES' && ++lecturas === 3) hoja.tablas.BOT_CONVERSACIONES[0].modo = 'HUMANO';
  };
  assert.deepEqual(await e.cliente(ANA, '2'), []);
  assert.equal(e.hoja.tablas.BOT_EVENTOS.at(-1).resultado, 'OMITIDO_CAMBIO_MODO');
});

test('atención humana: tomar, responder por el mismo chat, devolver al bot y cerrar', async () => {
  const e = entorno();
  await conversar(e, ANA, ['Hola', '2', 'roma', '1', '2', 'no', 'sin fecha', 'Ana', 'Jr. Cusco 120, Lima', 'mañanas', '1']);
  const form = (accion, mensaje = '') => ({ 'WhatsApp del cliente': '+51 987 000 001', 'Acción': accion, 'Mensaje al cliente': mensaje, 'Responsable': 'Carla' });

  const tomado = await accionHumana(form('Tomar caso', 'Hola Ana, soy Carla de ITS WOOD. El total es S/ 170.'), e);
  assert.equal(tomado.ok, true);
  assert.equal(e.conv(ANA).modo, 'HUMANO');
  assert.equal(e.conv(ANA).responsable, 'Carla');
  assert.equal(e.enviados.at(-1).to, ANA);
  assert.equal(e.hoja.tablas.BOT_EVENTOS.at(-1).direccion, 'SALIDA_HUMANO');
  assert.deepEqual(await e.cliente(ANA, 'Perfecto, ¿cómo pago?'), []);

  await accionHumana(form('Devolver al bot'), e);
  assert.match((await e.cliente(ANA, 'Hola otra vez'))[0], /Qué tipo de pedido/);

  await accionHumana(form('Cerrar caso', 'Gracias por tu compra'), e);
  assert.equal(e.conv(ANA).modo, 'CERRADO');
  const anterior = e.conv(ANA).conversacion_id;
  const [nuevo] = await e.cliente(ANA, 'Hola, quiero otro pedido');
  assert.match(nuevo, /Hola de nuevo, Ana/);
  assert.notEqual(e.conv(ANA).conversacion_id, anterior);
  assert.equal(e.conv(ANA).producto_id, '');
  assert.equal(e.conv(ANA).responsable, 'Carla', 'el bot no escribe la columna del equipo');
});

test('atención humana: fuera de la ventana de 24 h no envía texto libre ni cambia el modo', async () => {
  const e = entorno();
  await conversar(e, ANA, ['Hola', 'asesor']);
  e.avanzarHoras(25);
  const r = await accionHumana({ 'WhatsApp del cliente': ANA, 'Acción': 'Responder', 'Mensaje al cliente': 'Hola', 'Responsable': 'Carla' }, e);
  assert.equal(r.ok, false);
  assert.match(r.texto_resultado, /24 horas/);
  assert.equal(e.conv(ANA).modo, 'PENDIENTE_HUMANO');
});

test('audios: pide escribir y no cambia de paso; tres respuestas inválidas derivan', async () => {
  const e = entorno();
  await e.cliente(ANA, 'Hola');
  assert.match((await e.cliente(ANA, ev.audio('MEDIA_AUDIO')))[0], /no puedo escuchar audios/);
  assert.equal(e.conv(ANA).paso, 'SEGMENTO');
  await e.cliente(ANA, 'qué?');
  await e.cliente(ANA, 'no sé');
  const [r] = await e.cliente(ANA, 'mmm');
  assert.match(r, /no te estoy entendiendo/);
  assert.equal(e.hoja.tablas.BOT_SOLICITUDES[0].motivo, 'NO_ENTENDIDO');
});

test('texto que empieza como fórmula se guarda literal', async () => {
  const e = entorno();
  await conversar(e, ANA, ['Hola', '2', 'roma', '1', '2', 'no', 'sin fecha']);
  await e.cliente(ANA, '=HYPERLINK("http://x","clic")');
  assert.equal(e.conv(ANA).nombre, '=HYPERLINK("http://x","clic")');
});

test('estados de entrega actualizan la fila de salida; "sent" se descarta', async () => {
  const e = entorno();
  await e.cliente(ANA, 'Hola');
  const salida = e.hoja.tablas.BOT_EVENTOS.find(x => x.direccion === 'SALIDA');
  await recibirWebhook(ev.estado(salida.mensaje_id, ANA, 'sent'), e);
  assert.equal(salida.estado_entrega, undefined);
  await recibirWebhook(ev.estado(salida.mensaje_id, ANA, 'delivered'), e);
  assert.equal(salida.estado_entrega, 'delivered');
  await recibirWebhook(ev.estado(salida.mensaje_id, ANA, 'failed', { code: 131047, title: 'Re-engagement message' }), e);
  assert.equal(salida.estado_entrega, 'failed');
  assert.match(salida.detalle, /131047/);
});

test('normalizador: acepta la salida del trigger y el webhook de simulación', () => {
  const crudo = ev.mensaje(ANA, { type: 'interactive', interactive: { type: 'button_reply', button_reply: { id: 'SEG_EMPRESA', title: 'Empresa' } } });
  const valor = crudo.entry[0].changes[0].value;
  const [desdeTrigger] = normalizarEntrada([{ json: valor }]);
  assert.equal(desdeTrigger.origen, 'whatsapp');
  assert.equal(desdeTrigger.texto, 'Empresa');
  assert.equal(desdeTrigger.opcion_id, 'SEG_EMPRESA');
  assert.equal(desdeTrigger.phone_number_id, 'PHONE_PRUEBA');
  const [desdeWebhook] = normalizarEntrada([{ json: { headers: {}, body: crudo } }]);
  assert.equal(desdeWebhook.origen, 'simulacion');
});

test('webhook de simulación: registra la respuesta como SIMULADO sin enviarla', async () => {
  const e = entorno();
  const { procesarMensaje } = require('../sim/pipeline');
  const [m] = normalizarEntrada([{ json: { headers: {}, body: ev.mensaje(ANA, 'Hola') } }]);
  await procesarMensaje(m, e);
  assert.equal(e.enviados.length, 0);
  assert.equal(e.hoja.tablas.BOT_EVENTOS.at(-1).resultado, 'SIMULADO');
});

test('búsqueda en el catálogo: plurales y sinónimos', () => {
  const productos = leerCatalogo(CATALOGO);
  const nombres = q => buscarProductos(q, productos).map(p => p.nombre);
  assert.ok(nombres('tablas parrilleras').includes('Tabla Parrillera - Brasa'));
  assert.ok(nombres('algo para navidad').includes('Box Navideno Mini Tabla y Cuchillo'));
  assert.ok(nombres('recuerdos de bautizo').includes('CRUCES DE MADERA - RECUERDOS PARA SACRAMENTOS'));
  assert.ok(nombres('fotos boda').includes('Portarretrato para Bodas - Libro'));
  assert.deepEqual(nombres('PR-4A398B5B'), []);
  assert.deepEqual(nombres('zapatillas'), []);
});

test('PAUTAS: la derivación agrega un prospecto con el nombre interno y fechas como fecha', async () => {
  const e = entorno();
  await conversar(e, LUIS, ['Hola', '1', 'Acme SAC', 'Luis Torres', 'Fin de año', 'roma', '1', '20', 'no', '20/12/2026', 'Av. Javier Prado 100, San Isidro', 'mañanas', '1']);
  const [pauta] = e.hoja.tablas['PAUTAS '];
  assert.equal(pauta['FECHA MENSAJE'], '=DATE(2026,10,17)');
  assert.equal(pauta['ULTIMO CONTACTO'], '=DATE(2026,10,17)');
  assert.equal(pauta.CLIENTE, 'Acme SAC (Luis Torres)');
  assert.equal(pauta.NUMERO, "'987000002", 'número local de 9 dígitos, como texto');
  assert.equal(pauta.CELEBRACION, 'Fin de año');
  assert.equal(pauta['FECHA EVENTO'], "'20/12/2026", 'texto, como el resto de la columna');
  assert.equal(pauta['LISTADO DE PRODUCTOS '], 'TABLA QUESERA ROMA ');
  assert.equal(pauta.CANTIDAD, 20);
  assert.equal(pauta.ESTADO, '', 'el estado lo pone el equipo');
  assert.match(pauta['PROXIMO SEGUIMIENTO'], /^=IF\(INDIRECT\("I"&ROW\(\)\)/, 'misma fórmula que usa el equipo');
});

test('PAUTAS: un texto del cliente que parece fórmula se escribe como texto', async () => {
  const e = entorno();
  await conversar(e, ANA, ['Hola', '2', 'roma', '1', '1', 'no', 'sin fecha', '=IMPORTXML("http://x")', 'asesor']);
  assert.equal(e.hoja.tablas['PAUTAS '][0].CLIENTE, `'=IMPORTXML("http://x")`);
});

test('INVENTARIO: manda sobre el CSV, oculta descontinuados y avisa sin stock', async () => {
  const e = entorno();
  await conversar(e, ANA, ['Hola', '2', 'roma', '1']);
  assert.match((await e.cliente(ANA, '7'))[0], /Hoy hay 6 unidad\(es\) en stock/);

  const otro = entorno();
  await conversar(otro, LUIS, ['Hola', '2']);
  const [lista] = await otro.cliente(LUIS, 'mini tabla racket');
  assert.doesNotMatch(lista, /Racket/);
  await conversar(otro, LUIS, ['menu', '2']);
  await conversar(otro, LUIS, ['mesa picnic yard', '1']);
  assert.match((await otro.cliente(LUIS, '2'))[0], /Hoy no hay unidades en stock/);
});
