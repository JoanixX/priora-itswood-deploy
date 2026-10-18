'use strict';

// Ejecuta el código de los nodos Code generados con un $ / $input simulados, como lo haría n8n.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { flujoProcesar, flujoEntrada, flujoHumano, flujoErrores } = require('../n8n/build');
const { leerCsv } = require('../sim/hoja_memoria');
const ev = require('../sim/eventos');

const CATALOGO = leerCsv(path.join(__dirname, '..', 'hoja', 'catalogo_bot.csv'));

function ejecutarCodigo(flujo, nombreNodo, datos, entrada) {
  const nodo = flujo.nodes.find(n => n.name === nombreNodo);
  const $ = nombre => {
    if (!(nombre in datos)) throw new Error(`nodo no simulado: ${nombre}`);
    const filas = datos[nombre];
    return { first: () => ({ json: filas[0] }), all: () => filas.map(json => ({ json })) };
  };
  const $input = { all: () => (entrada || []).map(json => ({ json })), first: () => ({ json: (entrada || [])[0] }) };
  return new Function('$', '$input', nodo.parameters.jsCode)($, $input).map(i => i.json);
}

test('nodo Normalizar evento', () => {
  const flujo = flujoEntrada();
  const salida = ejecutarCodigo(flujo, 'Normalizar evento', {}, [ev.mensaje('51987000001', 'Hola').entry[0].changes[0].value]);
  assert.equal(salida.length, 1);
  assert.equal(salida[0].texto, 'Hola');
});

test('nodos del subflujo: duplicado, motor, comparar modo y preparar envíos', () => {
  const flujo = flujoProcesar();
  const [mensaje] = ejecutarCodigo(flujoEntrada(), 'Normalizar evento', {}, [ev.mensaje('51987000001', 'Hola')]);
  const datos = { Entrada: [mensaje], 'Configuración': [{ phoneNumberId: 'PHONE_CFG' }] };

  assert.equal(ejecutarCodigo(flujo, 'Detectar duplicado', datos, [{}]).length, 1);
  assert.equal(ejecutarCodigo(flujo, 'Detectar duplicado', datos, [{ mensaje_id: mensaje.mensaje_id, resultado: 'PROCESADO' }]).length, 0);

  // Sheets sin filas devuelve un elemento vacío (alwaysOutputData); el catálogo viene como filas.
  datos['Leer conversación'] = [{}];
  datos['Leer catálogo'] = CATALOGO;
  datos['Leer inventario'] = [{ 'ITEM ': 'TABLA QUESERA ROMA ', 'UNIDADES ': 3 }];
  datos['Leer configuración'] = [{ clave: 'nombre_bot', valor: 'Mermín' }, { clave: 'url_web', valor: 'https://tienda.example' }];
  datos['Leer productos'] = [{}];
  const [motor] = ejecutarCodigo(flujo, 'Motor conversacional', datos);
  assert.equal(motor.conversacion.modo, 'BOT');
  assert.match(motor.respuestas[0], /ITS WOOD/);
  assert.match(motor.respuestas[0], /Soy Mermín/);
  assert.equal(motor.eventos[0].resultado, 'BIENVENIDA_WEB');

  datos['Motor conversacional'] = [motor];
  assert.equal(ejecutarCodigo(flujo, 'Comparar modo', datos, [{}])[0].cambio, false);
  const envios = ejecutarCodigo(flujo, 'Preparar envíos', datos, [{ ...motor.conversacion }]);
  assert.equal(envios[0].accion, 'enviar');
  assert.equal(envios[0].phone_number_id, 'PHONE_PRUEBA');
});

test('flujo Sincronizar Drive: nodos Elegir hoja fuente y Validar fuente', () => {
  const { flujoSync } = require('../n8n/build');
  const demo = require('../sim/fuente_demo');
  const flujo = flujoSync();
  const [elegida] = ejecutarCodigo(flujo, 'Elegir hoja fuente', {}, demo.ARCHIVOS_CARPETA);
  assert.equal(elegida.hoja.id, 'SHEET_FUENTE');
  const datos = {
    'Carpeta a sincronizar': [{ ok: true, folder_id: 'CARPETA' }], 'Elegir hoja fuente': [elegida],
    'Leer PRODUCTOS': demo.PRODUCTOS, 'Leer CLIENTES': demo.CLIENTES, 'Leer VENTAS': demo.VENTAS,
  };
  const [r] = ejecutarCodigo(flujo, 'Validar fuente', datos);
  assert.equal(r.ok, true);
  assert.equal(r.productos.length, 9);
  // Sin carpeta: las lecturas no corrieron y el error queda listo para BOT_ERRORES.
  const [sin] = ejecutarCodigo(flujo, 'Validar fuente', { 'Carpeta a sincronizar': [{ ok: false, error: 'Falta conectar la carpeta' }] });
  assert.equal(sin.ok, false);
  const trigger = flujo.nodes.find(n => n.name === 'Cambio en la carpeta');
  assert.equal(trigger.disabled, true, 'sin driveFolderId el trigger de Drive queda desactivado');
});

test('flujo API: el nodo Responder panel calcula las métricas con las pestañas leídas', () => {
  const { flujoApi } = require('../n8n/build');
  const demo = require('../sim/fuente_demo');
  const api = flujoApi();
  const vacio = [{}];
  const datos = {
    'Configuración': [{ ruta: 'metricas', desde: '2026-06-01', hasta: '2026-06-30', sheetId: 'X' }],
    'Panel: leer BOT_CONFIG': vacio, 'Panel: leer BOT_EVENTOS': vacio, 'Panel: leer BOT_SOLICITUDES': vacio,
    'Panel: leer BOT_CONVERSACIONES': vacio, 'Panel: leer BOT_VENTAS': [{ fecha: '2026-06-01', pedido_id: 'P1', total: 100 }, { fecha: '2026-06-02', pedido_id: 'P2', total: 50 }],
    'Panel: leer BOT_CLIENTES': vacio, 'Panel: leer BOT_CLIENTES_FUENTE': demo.CLIENTES, 'Panel: leer BOT_PRODUCTOS': vacio,
    'Panel: leer BOT_FIDELIZACION': vacio, 'Panel: leer BOT_CAMPANAS': vacio,
  };
  const [seg] = ejecutarCodigo(api, 'Petición GET', {}, [{ params: { ruta: 'segmentos', id: 'vip', accion: 'clientes' }, query: {} }]);
  assert.deepEqual([seg.ruta, seg.segmento], ['segmento-clientes', 'VIP']);
  const webhooks = api.nodes.filter(n => n.type === 'n8n-nodes-base.webhook');
  assert.deepEqual(webhooks.map(n => n.parameters.path), ['api/:ruta', 'api/:ruta/:id', 'api/:ruta/:id/:accion']);
  assert.ok(webhooks.every(n => n.webhookId === 'itswood'));
  const [r] = ejecutarCodigo(api, 'Responder panel', datos);
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.ticket_promedio.valor, 75);
  assert.equal(r.cuerpo.clientes_registrados.total, 7);
});

test('flujo Campañas: a quién le toca y filas con el error de cada correo', () => {
  const { flujoCampanas } = require('../n8n/build');
  const demo = require('../sim/fuente_demo');
  const flujo = flujoCampanas();
  const datos = {
    'Desde la API': [{ segmento: 'DORMIDO', enviar: true }],
    'Leer BOT_CONFIG': [{}], 'Leer BOT_CLIENTES_FUENTE': demo.CLIENTES, 'Leer BOT_VENTAS': demo.VENTAS,
    'Leer BOT_PRODUCTOS': demo.PRODUCTOS, 'Leer BOT_FIDELIZACION': [{}], 'Leer BOT_CAMPANAS': [{}],
  };
  const [r] = ejecutarCodigo(flujo, 'A quién le toca', datos);
  assert.equal(r.enviar, true);
  assert.equal(r.resultados[0].destinatarios[0].email, 'diego@example.com');
  datos['A quién le toca'] = [r];
  datos.Correos = ejecutarCodigo(flujo, 'Correos', datos);
  const filas = ejecutarCodigo(flujo, 'Filas enviadas', datos, [{ error: { message: 'SMTP caído' } }]);
  assert.equal(filas[0].estado, 'ERROR_ENVIO');
  assert.match(filas[0].detalle, /SMTP caído/);
});

test('flujo Reportes: el semanal se arma con las pestañas leídas; el diario espera su hora', () => {
  const { flujoReportes } = require('../n8n/build');
  const flujo = flujoReportes();
  const tablas = ['BOT_CONFIG', 'BOT_EVENTOS', 'BOT_SOLICITUDES', 'BOT_CONVERSACIONES', 'BOT_VENTAS', 'BOT_CLIENTES', 'BOT_CLIENTES_FUENTE', 'BOT_PRODUCTOS', 'BOT_FIDELIZACION', 'BOT_CAMPANAS'];
  const datos = Object.fromEntries(tablas.map(t => [`Leer ${t}`, [{}]]));
  // El nodo usa la hora real: el resumen diario se programa para la hora siguiente, así nunca coincide.
  const { horaLocal } = require('../src/reportes');
  const otraHora = `${String((horaLocal(new Date().toISOString()) + 1) % 24).padStart(2, '0')}:00`;
  datos['Leer BOT_CONFIG'] = [{ clave: 'avisos_email', valor: 'duena@itswood.example' }, { clave: 'hora_resumen_diario', valor: otraHora }];
  datos['Lunes 08:00'] = [{}];
  const [r] = ejecutarCodigo(flujo, 'Armar reporte', datos);
  assert.equal(r.tipo, 'semanal');
  assert.equal(r.destinos, 'duena@itswood.example');
  delete datos['Lunes 08:00'];
  datos['Cada hora'] = [{}];
  assert.deepEqual(ejecutarCodigo(flujo, 'Armar reporte', datos), [], 'fuera de la hora del resumen no sale nada');
});

test('flujo API: nodos de PUT /fidelizacion y POST /config/drive', () => {
  const { flujoApi } = require('../n8n/build');
  const demo = require('../sim/fuente_demo');
  const api = flujoApi();
  const [c] = ejecutarCodigo(api, 'Cambios del dashboard', {
    'Configuración': [{ ruta: 'fidelizacion-put', cambios: { reglas: [{ segmento: 'VIP', oferta: 'Envío gratis' }] } }],
    'Leer reglas actuales': [{ segmento: 'VIP', canal: 'WHATSAPP', mensaje: 'Hola {nombre}', oferta: 'X', frecuencia_dias: '10', activo: 'SI' }],
  });
  assert.deepEqual(c.filas[0], { segmento: 'VIP', canal: 'WHATSAPP', mensaje: 'Hola {nombre}', oferta: 'Envío gratis', frecuencia_dias: '10', activo: 'SI' });
  const [carpeta] = ejecutarCodigo(api, 'Carpeta pedida', {}, [{ url: 'https://drive.google.com/drive/folders/1AbC_dEfGhIjKlMn' }]);
  const [r] = ejecutarCodigo(api, 'Conectar carpeta', {
    'Carpeta pedida': [carpeta], 'Buscar hojas de la carpeta': demo.ARCHIVOS_CARPETA, 'Configuración': [{ correoServicio: 'bot@x.iam.gserviceaccount.com' }],
  });
  assert.equal(r.status, 200);
  assert.equal(r.filas[0].valor, '1AbC_dEfGhIjKlMn');
});

test('nodo Decidir acción del formulario', () => {
  const flujo = flujoHumano();
  const datos = { 'Formulario de atención': [{ 'WhatsApp del cliente': '51987000001', 'Acción': 'Tomar caso', 'Mensaje al cliente': '', 'Responsable': 'Carla' }] };
  const [d] = ejecutarCodigo(flujo, 'Decidir acción', datos, [{ wa_id: 51987000001, modo: 'PENDIENTE_HUMANO', ultima_entrada: new Date().toISOString() }]);
  assert.equal(d.ok, true);
  assert.equal(d.modo, 'HUMANO');
});

test('nodo Preparar registro de errores oculta credenciales', () => {
  const flujo = flujoErrores();
  const datos = { 'Error Trigger': [{ workflow: { name: 'X' }, execution: { id: 9, lastNodeExecuted: 'Enviar respuesta', mode: 'webhook', error: { message: 'Bad token: EAAGm0PX4ZCpsBAABCDEFGHIJKLMNOPQRSTUV access_token=abc123' } } }] };
  const [r] = ejecutarCodigo(flujo, 'Preparar registro', datos);
  assert.doesNotMatch(r.mensaje, /EAAGm0|abc123/);
  assert.equal(r.nodo, 'Enviar respuesta');
});

test('las escrituras usan cellFormat RAW y no tocan las columnas del equipo', () => {
  const flujo = flujoProcesar();
  const escrituras = flujo.nodes.filter(n => n.type === 'n8n-nodes-base.googleSheets' && n.parameters.operation !== 'read');
  for (const n of escrituras) assert.equal(n.parameters.options.cellFormat, n.name === 'Registrar en PAUTAS' ? 'USER_ENTERED' : 'RAW', n.name);
  const inventario = flujo.nodes.find(n => n.name === 'Leer inventario');
  assert.equal(inventario.parameters.options.dataLocationOnSheet.values.range, 'H3:I300');
  const guardar = flujo.nodes.find(n => n.name === 'Guardar conversación');
  assert.ok(!('responsable' in guardar.parameters.columns.value));
  assert.ok(!('notas' in guardar.parameters.columns.value));
});

test('BOT_CONVERSACIONES se escribe solo como texto: un número vacío no puede volverse 0', () => {
  const flujo = flujoProcesar();
  const guardar = flujo.nodes.find(n => n.name === 'Guardar conversación');
  assert.deepEqual(guardar.parameters.columns.schema.filter(c => c.type !== 'string').map(c => c.id), []);
  const solicitud = flujo.nodes.find(n => n.name === 'Registrar solicitud');
  assert.match(solicitud.parameters.columns.value.cantidad, /=== '' \? null :/);
});

test('nodos nuevos: API, confirmar orden y respuesta de proveedor', () => {
  const { flujoApi, flujoConfirmarOrden } = require('../n8n/build');
  const api = flujoApi();
  const [noValida] = ejecutarCodigo(api, 'Petición GET', {}, [{ params: { ruta: 'mensaje' }, query: {}, body: {} }]);
  assert.equal(noValida.ruta, 'error');
  assert.equal(noValida.status, 405);
  const [salud] = ejecutarCodigo(api, 'Petición GET', {}, [{ params: { ruta: 'salud' }, query: {} }]);
  assert.equal(salud.cuerpo.ok, true);
  const [msg] = ejecutarCodigo(api, 'Petición POST', {}, [{ params: { ruta: 'mensaje' }, query: {}, body: { wa_id: '51987000001', texto: 'Hola' } }]);
  assert.equal(msg.mensaje.origen, 'api');
  const [lista] = ejecutarCodigo(api, 'Formatear lista', { 'Petición GET': [{ ruta: 'solicitudes', filtros: { intencion: 'ALTA' }, limite: 10 }] },
    [{ row_number: 2, solicitud_id: 'A', intencion: 'ALTA' }, { row_number: 3, solicitud_id: 'B', intencion: 'BAJA' }]);
  assert.deepEqual(lista.cuerpo.datos, [{ solicitud_id: 'A', intencion: 'ALTA' }]);

  const orden = flujoConfirmarOrden();
  const envios = [{ cotizacion_id: 'C1', proveedor_nombre: 'X', estado: 'ENVIADA' }, { cotizacion_id: 'C2', proveedor_nombre: 'Y', estado: 'ENVIADA' }];
  const filas = ejecutarCodigo(orden, 'Filas enviadas', { 'Separar envíos': envios }, [{ messages: [{ id: 'wamid.1' }] }, { error: { message: 'plantilla no aprobada' } }]);
  assert.equal(filas[0].mensaje_id, 'wamid.1');
  assert.equal(filas[1].estado, 'ERROR_ENVIO');
  assert.match(filas[1].detalle, /plantilla no aprobada/);

  const procesar = flujoProcesar();
  const [prov] = ejecutarCodigo(procesar, '¿Es proveedor?', { Entrada: [{ wa_id: '51911111111' }] }, [{ proveedor_id: 'P01', nombre: 'Maderas', whatsapp: '911111111', productos: 'TODOS' }]);
  assert.equal(prov.es_proveedor, true);
});
