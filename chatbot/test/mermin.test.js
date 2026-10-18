'use strict';

// Plan Mermín: configuración, bienvenida web, sincronización de Drive, prioridad, métricas, fidelización y reportes.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { HojaMemoria, leerCsv } = require('../sim/hoja_memoria');
const { recibirWebhook, sincronizarDrive } = require('../sim/pipeline');
const ev = require('../sim/eventos');
const demo = require('../sim/fuente_demo');
const { leerConfig, render, validarCambiosConfig, mensajeBienvenida } = require('../src/config');
const { extraerFolderId, elegirHojaFuente, fechaFuente, conectarDrive } = require('../src/sync');
const { segmentar, leerReglas, validarReglas } = require('../src/fidelizacion');

const CATALOGO = leerCsv(path.join(__dirname, '..', 'hoja', 'catalogo_bot.csv'));
const ANA = '51987000001';
const LUIS = '51987000002';
const CONFIG_DEMO = [
  { clave: 'url_web', valor: 'https://tienda.example/' },
  { clave: 'avisos_whatsapp', valor: '51999000111' },
];

function entorno(opciones = {}) {
  const hoja = new HojaMemoria(CATALOGO.map(f => ({ ...f })), []);
  hoja.tablas.BOT_CONFIG = (opciones.config || CONFIG_DEMO).map(f => ({ ...f }));
  let t = Date.parse(opciones.inicio || '2026-10-17T15:00:00.000Z');
  let n = 0;
  const e = {
    hoja,
    enviados: [],
    config: { phoneNumberId: 'PHONE_PRUEBA', waAvisos: '' },
    ahora: () => new Date((t += 1000)).toISOString(),
    enviar: async envio => { e.enviados.push(envio); return { messages: [{ id: `wamid.S${++n}` }] }; },
  };
  e.cliente = async (waId, contenido) => {
    const antes = e.enviados.length;
    await recibirWebhook(ev.mensaje(waId, contenido, { fecha: new Date(t).toISOString() }), e);
    return e.enviados.slice(antes).filter(x => !x.aviso && x.to === waId).map(x => x.texto);
  };
  e.conv = waId => hoja.tablas.BOT_CONVERSACIONES.find(f => f.wa_id === waId);
  return e;
}
async function conversar(e, waId, mensajes) { for (const m of mensajes) await e.cliente(waId, m); }

// ---------- 1. BOT_CONFIG ----------

test('config: valores por defecto, filas de la hoja y plantillas', () => {
  const c = leerConfig([{ clave: 'nombre_bot', valor: 'Robles' }, { clave: 'tono', valor: 'FORMAL' }, { clave: 'url_web', valor: '' }]);
  assert.equal(c.nombre_bot, 'Robles');
  assert.equal(c.tono, 'formal');
  assert.equal(c.codigo_descuento_web, 'WEB10');
  assert.equal(c.url_web, '');
  assert.equal(render('Hola {nombre} y {falta}', { nombre: 'Ana' }), 'Hola Ana y ');
  assert.match(mensajeBienvenida(c), /^¡Buen día! Soy Robles 🌳/);
  assert.doesNotMatch(mensajeBienvenida(c), /web/, 'sin URL no se ofrece la web');
});

test('config: PUT valida claves, tono, hora y números', () => {
  assert.equal(validarCambiosConfig({ nombre_bot: 'Mermín', tono: 'formal' }).filas.length, 2);
  assert.match(validarCambiosConfig({ otra: 1 }).error, /desconocida/);
  assert.match(validarCambiosConfig({ tono: 'gracioso' }).error, /cercano o formal/);
  assert.match(validarCambiosConfig({ hora_resumen_diario: '25:00' }).error, /HH:MM/);
  assert.match(validarCambiosConfig({ ultima_sync: 'x' }).error, /no se edita/);
  assert.match(validarCambiosConfig({ tope_valor: 'mucho' }).error, /número/);
});

// ---------- 2. Bienvenida con redirección a la web ----------

test('bienvenida: la conversación nueva recibe la web con descuento y UTM una sola vez', async () => {
  const e = entorno();
  const [primero] = await e.cliente(ANA, 'Hola');
  assert.match(primero, /Soy Mermín 🌳, el asistente de ITS WOOD/);
  assert.match(primero, /10% de descuento\* con el código \*WEB10\*/);
  assert.match(primero, /https:\/\/tienda\.example\/\?utm_source=whatsapp&utm_campaign=mermin/);
  assert.match(primero, /1️⃣ Para una empresa/);
  const bienvenidas = () => e.hoja.tablas.BOT_EVENTOS.filter(x => x.resultado === 'BIENVENIDA_WEB');
  assert.equal(bienvenidas().length, 1);
  assert.equal(bienvenidas()[0].conversacion_id, e.conv(ANA).conversacion_id);

  const [segundo] = await e.cliente(ANA, 'menu');
  assert.doesNotMatch(segundo, /utm_source/);
  await e.cliente(ANA, '2');
  assert.equal(bienvenidas().length, 1, 'la conversación existente no la recibe de nuevo');
});

test('bienvenida: el nombre del bot y el tono se editan desde BOT_CONFIG', async () => {
  const e = entorno({ config: [...CONFIG_DEMO, { clave: 'nombre_bot', valor: 'Roble' }, { clave: 'tono', valor: 'formal' }] });
  const [r] = await e.cliente(LUIS, 'Buenas');
  assert.match(r, /Soy Roble 🌳/);
  assert.match(r, /Compre en nuestra web\* y llévese/);
  assert.match(r, /utm_campaign=roble/);
  assert.match(r, /¿Prefiere que le ayude por aquí?/);
});

// ---------- 3. Sincronización de la carpeta de Drive ----------

// Drive simulado: la carpeta tiene la hoja fuente con las pestañas de fuente_demo (editables en la prueba).
function conDrive(e, fuente = demo.copia(), archivos = demo.ARCHIVOS_CARPETA) {
  e.drive = {
    listar: folderId => (folderId === 'CARPETA_DEMO' ? archivos : []),
    leer: (sheetId, pestana) => (sheetId === 'SHEET_FUENTE' ? fuente[pestana] || [] : []),
  };
  e.hoja.tablas.BOT_CONFIG.push({ clave: 'drive_folder_id', valor: 'CARPETA_DEMO' });
  return fuente;
}

test('drive: URL de carpeta, elección de la hoja MERMIN_FUENTE y formatos de la hoja', () => {
  assert.equal(extraerFolderId('https://drive.google.com/drive/u/0/folders/1AbC_dEfGhIjKlMn?usp=sharing'), '1AbC_dEfGhIjKlMn');
  assert.equal(extraerFolderId('https://drive.google.com/open?id=1AbC_dEfGhIjKlMn'), '1AbC_dEfGhIjKlMn');
  assert.equal(extraerFolderId('no es una url'), '');
  assert.equal(elegirHojaFuente(demo.ARCHIVOS_CARPETA).id, 'SHEET_FUENTE');
  assert.equal(elegirHojaFuente([{ id: 'X', name: 'Ventas', mimeType: 'application/vnd.google-apps.spreadsheet' }]).id, 'X', 'sin MERMIN_FUENTE usa la primera');
  assert.equal(elegirHojaFuente([{ id: 'P', name: 'foto.png', mimeType: 'image/png' }]), null);
  assert.equal(fechaFuente('17/10/2026'), '2026-10-17');
  assert.equal(fechaFuente('46312'), '2026-10-17', 'número de serie de Sheets');
  assert.equal(fechaFuente('31/02/2026'), '');
});

test('drive: copia la fuente a las pestañas BOT_ y guarda la hoja y ultima_sync en BOT_CONFIG', async () => {
  const e = entorno();
  conDrive(e);
  const r = await sincronizarDrive(e);
  assert.equal(r.ok, true, r.errores && r.errores.join(' '));
  assert.equal(e.hoja.tablas.BOT_PRODUCTOS.length, 9);
  assert.equal(e.hoja.tablas.BOT_CLIENTES_FUENTE.length, 7);
  assert.equal(e.hoja.tablas.BOT_VENTAS.length, 12);
  const ana = e.hoja.tablas.BOT_CLIENTES_FUENTE.find(c => c.cliente_id === 'C002');
  assert.equal(ana.telefono, '51987000001');
  assert.equal(e.hoja.tablas.BOT_CLIENTES_FUENTE.find(c => c.cliente_id === 'C007').tipo, 'PERSONA');
  const p008 = e.hoja.tablas.BOT_VENTAS.find(v => v.pedido_id === 'P008');
  assert.equal(p008.total, 85, 'sin total se calcula con el precio');
  assert.equal(p008.codigo, 'WEB10');
  assert.equal(e.hoja.tablas.BOT_VENTAS[0].fecha, '2026-04-10');
  const config = leerConfig(e.hoja.tablas.BOT_CONFIG);
  assert.equal(config.sheet_fuente_id, 'SHEET_FUENTE');
  assert.match(config.ultima_sync, /^2026-10-17T/);
});

test('drive: una columna faltante se registra en BOT_ERRORES y conserva la última copia válida', async () => {
  const e = entorno();
  const fuente = conDrive(e);
  await sincronizarDrive(e);
  for (const f of fuente.VENTAS) delete f.total;
  fuente.PRODUCTOS.push({ sku: 'NUEVO', nombre: 'Nuevo', categoria: '', precio: '10', costo: '', stock: '', activo: '' });
  const r = await sincronizarDrive(e);
  assert.equal(r.ok, false);
  assert.match(r.errores[0], /VENTAS le faltan columnas: total/);
  assert.match(e.hoja.tablas.BOT_ERRORES.at(-1).mensaje, /total/);
  assert.equal(e.hoja.tablas.BOT_PRODUCTOS.length, 9, 'la copia anterior no se toca');

  const sinCarpeta = entorno();
  const r2 = await sincronizarDrive(sinCarpeta);
  assert.match(r2.errores[0], /Falta conectar la carpeta/);
});

test('drive: conectar la carpeta valida la URL y pide compartirla con la cuenta de servicio', () => {
  assert.equal(conectarDrive({ url: 'hola' }).status, 400);
  const sinAcceso = conectarDrive({ url: 'https://drive.google.com/drive/folders/1AbC_dEfGhIjKlMn', archivos: [], correoServicio: 'bot@proyecto.iam.gserviceaccount.com' });
  assert.equal(sinAcceso.status, 403);
  assert.match(sinAcceso.error, /bot@proyecto\.iam\.gserviceaccount\.com/);
  const ok = conectarDrive({ url: 'https://drive.google.com/drive/folders/1AbC_dEfGhIjKlMn', archivos: demo.ARCHIVOS_CARPETA });
  assert.deepEqual(ok.config.map(c => [c.clave, c.valor]), [['drive_folder_id', '1AbC_dEfGhIjKlMn'], ['sheet_fuente_id', 'SHEET_FUENTE']]);
});

// ---------- 4. Prioridad por cantidad, valor y ganancia ----------

const PEDIDO_PERSONA = (producto, cantidad, opcion = '1') => ['Hola', '2', producto, opcion, String(cantidad), 'no', 'sin fecha', 'Ana', 'Av. Larco 123, Miraflores', 'tardes', '1'];

test('prioridad: 50 posatazas es ALTA, usa el costo de BOT_PRODUCTOS y avisa al negocio con 🔴', async () => {
  const e = entorno();
  conDrive(e);
  await sincronizarDrive(e);
  // En la lista de "posataza koi", la 3 es Posataza para cafe - Koi (S/ 45).
  await conversar(e, ANA, PEDIDO_PERSONA('posataza koi', 50, '3'));
  const [sol] = e.hoja.tablas.BOT_SOLICITUDES;
  assert.equal(sol.valor_estimado, 2250);
  assert.equal(sol.ganancia_estimada, 1350, '(45 - 18) × 50 con el costo de la hoja fuente');
  assert.equal(sol.prioridad, 'ALTA');
  assert.ok(sol.puntaje_prioridad >= 70, `puntaje ${sol.puntaje_prioridad}`);
  assert.match(sol.resumen, /^🔴 /);
  assert.equal(e.conv(ANA).modo, 'PENDIENTE_HUMANO');
  const aviso = e.enviados.find(x => x.aviso);
  assert.equal(aviso.to, '51999000111', 'destino de BOT_CONFIG.avisos_whatsapp');
  assert.match(aviso.texto, /🔴 Lead ALTA ITS WOOD/);
  assert.match(aviso.texto, /Valor estimado: S\/ 2,250\.00 · Ganancia estimada: S\/ 1,350\.00/);
  assert.match(aviso.texto, /https:\/\/wa\.me\/51987000001/);
});

test('prioridad: sin costo usa margen_por_defecto; MEDIA va a PAUTAS como hoy', async () => {
  const e = entorno();
  await conversar(e, ANA, PEDIDO_PERSONA('roma', 20));
  const [sol] = e.hoja.tablas.BOT_SOLICITUDES;
  assert.equal(sol.ganancia_estimada, 680, '85 × 20 × 0.40');
  assert.equal(sol.prioridad, 'MEDIA');
  assert.equal(e.hoja.tablas['PAUTAS '].length, 1);
  assert.match(e.enviados.find(x => x.aviso).texto, /Nueva atención ITS WOOD/);
});

test('prioridad: un pedido BAJA se cierra con la web y el descuento; ASESOR lo pasa a una persona', async () => {
  const e = entorno();
  const respuestas = [];
  for (const m of PEDIDO_PERSONA('roma', 2)) respuestas.push(...await e.cliente(ANA, m));
  assert.match(respuestas.at(-1), /comprar en nuestra web/);
  assert.match(respuestas.at(-1), /WEB10/);
  assert.match(respuestas.at(-1), /escribe ASESOR/);
  const [sol] = e.hoja.tablas.BOT_SOLICITUDES;
  assert.equal(sol.prioridad, 'BAJA');
  assert.equal(sol.estado, 'CERRADO_WEB');
  assert.equal(e.conv(ANA).modo, 'CERRADO');
  assert.equal(e.hoja.tablas['PAUTAS '].length, 0);
  assert.equal(e.enviados.filter(x => x.aviso).length, 0);
  assert.match((await e.cliente(ANA, 'asesor'))[0], /Te comunico con una persona/);
  assert.equal(e.conv(ANA).modo, 'PENDIENTE_HUMANO');
});

test('API: GET leads ordena por prioridad y filtra por nivel', async () => {
  const { llamarApi } = require('../sim/pipeline');
  const e = entorno();
  await conversar(e, ANA, PEDIDO_PERSONA('roma', 20));
  await conversar(e, LUIS, PEDIDO_PERSONA('mesa picnic yard', 30));
  const r = await llamarApi({ metodo: 'GET', ruta: 'leads', query: { orden: 'prioridad' } }, e);
  assert.deepEqual(r.cuerpo.datos.map(x => x.prioridad), ['ALTA', 'MEDIA']);
  assert.deepEqual(r.cuerpo.conteo, { ALTA: 1, MEDIA: 1, BAJA: 0 });
  const altas = await llamarApi({ metodo: 'GET', ruta: 'leads', query: { nivel: 'alta' } }, e);
  assert.equal(altas.cuerpo.datos.length, 1);
  assert.equal((await llamarApi({ metodo: 'GET', ruta: 'leads', query: { nivel: 'X' } }, e)).status, 400);
});

// ---------- 5. Fidelización ----------

test('fidelización: cada regla de segmento con los datos de ejemplo', () => {
  const lista = segmentar({ clientes: demo.CLIENTES, ventas: demo.VENTAS, ahora: '2026-10-17T15:00:00Z' });
  const de = id => lista.find(c => c.cliente_id === id).segmento;
  assert.equal(de('C001'), 'CORPORATIVO', 'tipo EMPRESA');
  assert.equal(de('C002'), 'VIP', '3 pedidos');
  assert.equal(de('C003'), 'RECURRENTE', '2 pedidos');
  assert.equal(de('C004'), 'NUEVO', '1 pedido hace 10 días');
  assert.equal(de('C005'), 'DORMIDO', '150 días sin comprar');
  assert.equal(de('C006'), 'OCASIONAL', '1 pedido hace 50 días');
  assert.equal(de('C007'), 'SIN_COMPRAS');
  // Top 10 % por total: entre 6 compradores es el primero; si no es empresa, es VIP aunque tenga 1 pedido.
  const sinEmpresa = segmentar({ clientes: demo.CLIENTES.map(c => ({ ...c, tipo: 'PERSONA' })), ventas: demo.VENTAS, ahora: '2026-10-17T15:00:00Z' });
  assert.equal(sinEmpresa.find(c => c.cliente_id === 'C001').segmento, 'VIP');
});

test('fidelización: la sincronización guarda el segmento y GET /segmentos los cuenta', async () => {
  const { llamarApi } = require('../sim/pipeline');
  const e = entorno();
  conDrive(e);
  await sincronizarDrive(e);
  assert.equal(e.hoja.tablas.BOT_CLIENTES_FUENTE.find(c => c.cliente_id === 'C005').segmento, 'DORMIDO');
  const r = await llamarApi({ metodo: 'GET', ruta: 'segmentos' }, e);
  const conteo = Object.fromEntries(r.cuerpo.segmentos.map(s => [s.segmento, s.clientes]));
  assert.deepEqual(conteo, { CORPORATIVO: 1, VIP: 1, RECURRENTE: 1, NUEVO: 1, DORMIDO: 1, OCASIONAL: 1, SIN_COMPRAS: 1 });
  assert.equal(r.cuerpo.segmentos.find(s => s.segmento === 'DORMIDO').canal, 'WHATSAPP CON CUPÓN + RETARGETING EN META ADS');
});

test('recomendaciones: comprados juntos, segmento DORMIDO, VIP y momento de recompra', async () => {
  const { llamarApi } = require('../sim/pipeline');
  const e = entorno();
  conDrive(e);
  await sincronizarDrive(e);
  const reco = async id => (await llamarApi({ metodo: 'GET', ruta: `recomendaciones/${id}` }, e)).cuerpo;

  // Carla compró la tabla ROMA: lo que más se compra con ella es la posataza Koi.
  const carla = await reco('C004');
  assert.equal(carla.productos[0].sku, 'PR-4D383833');
  assert.equal(carla.productos[0].motivo, 'COMPRADO_JUNTO');
  assert.equal(carla.recompra.base, 'FRECUENCIA_DEL_SEGMENTO');
  assert.equal(carla.recompra.proxima_compra, '2026-10-27', '1 pedido: frecuencia de NUEVO (20 días)');
  assert.match(carla.mensaje, /^¡Gracias por tu compra, Carla!.*Posataza para cafe - Koi/);

  // Diego está dormido: lo más barato con stock (el espejo no tiene stock).
  const diego = await reco('C005');
  assert.equal(diego.productos[0].nombre, 'CERA DE ABEJA PARA MADERA 90ML');
  assert.equal(diego.productos[0].motivo, 'MAS_ECONOMICO_CON_STOCK');
  assert.match(diego.mensaje, /VUELVE15.*tienda\.example/);

  // Ana es VIP: primero lo de mayor ganancia; recompra por el promedio entre sus pedidos (75 y 51 días).
  const ana = await reco('C002');
  assert.equal(ana.productos[0].nombre, 'Mesa Picnic Plegable - YARD');
  assert.equal(ana.recompra.base, 'PROMEDIO_ENTRE_COMPRAS');
  assert.equal(ana.recompra.dias, 63);
  assert.ok(ana.productos.every(p => !['PR-492A873B', 'PR-4D383833', 'PR-4966E8E6', 'PR-4A398B5B'].includes(p.sku)), 'no repite lo que ya compró');

  assert.equal((await llamarApi({ metodo: 'GET', ruta: 'recomendaciones/C999' }, e)).status, 404);
  const vips = await llamarApi({ metodo: 'GET', ruta: 'segmentos/vip/clientes' }, e);
  assert.equal(vips.cuerpo.clientes[0].cliente_id, 'C002');
  assert.equal(vips.cuerpo.clientes[0].recomendacion.productos.length, 3);
});

test('audiencias: CSV telefono,email solo con acepta_marketing = SI', async () => {
  const { llamarApi } = require('../sim/pipeline');
  const e = entorno();
  conDrive(e);
  await sincronizarDrive(e);
  const r = await llamarApi({ metodo: 'GET', ruta: 'audiencias/DORMIDO.csv' }, e);
  assert.equal(r.csv, 'telefono,email\n+51987000005,diego@example.com\n');
  assert.equal(r.archivo, 'audiencia_dormido.csv');
  const ocasional = await llamarApi({ metodo: 'GET', ruta: 'audiencias/ocasional.csv' }, e);
  assert.equal(ocasional.total, 0, 'Elena no aceptó marketing');
  assert.equal((await llamarApi({ metodo: 'GET', ruta: 'audiencias/OTRO.csv' }, e)).status, 400);
});

test('reglas por segmento: valores por defecto, filas de BOT_FIDELIZACION y validación del PUT', () => {
  const reglas = leerReglas([{ segmento: 'vip', oferta: 'Regalo sorpresa', frecuencia_dias: '15', activo: 'no' }]);
  assert.equal(reglas.VIP.oferta, 'Regalo sorpresa');
  assert.equal(reglas.VIP.frecuencia_dias, '15');
  assert.equal(reglas.VIP.activo, 'NO');
  assert.equal(reglas.NUEVO.frecuencia_dias, '20');
  assert.equal(validarReglas({ reglas: [{ segmento: 'NUEVO', oferta: 'X' }] }).filas[0].oferta, 'X');
  assert.match(validarReglas({ reglas: [{ segmento: 'OTRO' }] }).error, /segmento debe ser/);
  assert.match(validarReglas({ reglas: [{ segmento: 'VIP', frecuencia_dias: '0' }] }).error, /frecuencia_dias/);
});

// ---------- 5. Campañas de fidelización (flujo [9]) ----------

test('campañas: la vista previa no envía; enviar exige confirmar y respeta frecuencia_dias', async () => {
  const { llamarApi, campanas } = require('../sim/pipeline');
  const e = entorno();
  conDrive(e);
  await sincronizarDrive(e);
  e.correos = [];
  e.enviarCorreo = async correo => { e.correos.push(correo); };

  const preview = await llamarApi({ metodo: 'POST', ruta: 'campanas/NUEVO/preview', body: {} }, e);
  assert.equal(preview.cuerpo.total, 1);
  assert.equal(preview.cuerpo.destinatarios[0].nombre, 'Carla Ruiz');
  assert.match(preview.cuerpo.destinatarios[0].asunto, /^ITS WOOD: Cupón SEGUNDA10/);
  assert.equal(e.correos.length, 0);

  assert.equal((await llamarApi({ metodo: 'POST', ruta: 'campanas/NUEVO/enviar', body: {} }, e)).status, 400, 'sin confirmar no envía');
  const envio = await llamarApi({ metodo: 'POST', ruta: 'campanas/NUEVO/enviar', body: { confirmar: true } }, e);
  assert.equal(envio.cuerpo.destinatarios, 1);
  assert.equal(e.correos[0].to, 'carla@example.com');
  assert.equal(e.hoja.tablas.BOT_CAMPANAS[0].estado, 'ENVIADO');

  // Ya contactada hoy: con frecuencia de 20 días no le toca de nuevo.
  const otra = await llamarApi({ metodo: 'POST', ruta: 'campanas/NUEVO/preview', body: {} }, e);
  assert.equal(otra.cuerpo.total, 0);
  assert.equal(otra.cuerpo.omitidos.contactado_recientemente, 1);

  // Disparo diario: vista previa de todos los segmentos como PREVISTA (Elena no aceptó marketing: no aparece).
  const diario = await campanas({}, e);
  assert.equal(diario.resultados.length, 5);
  assert.ok(e.hoja.tablas.BOT_CAMPANAS.some(c => c.estado === 'PREVISTA' && c.segmento === 'DORMIDO'));
  assert.equal(e.correos.length, 1, 'la vista previa diaria no envía nada');
});

// ---------- 6. Reportes al negocio (flujo [10]) ----------

test('reportes: el diario sale a la hora configurada con leads por prioridad, ventas y las 5 métricas', async () => {
  const { reportes } = require('../sim/pipeline');
  // 15:00 UTC = 10:00 en Lima.
  const e = entorno({ config: [...CONFIG_DEMO, { clave: 'avisos_email', valor: 'duena@itswood.example' }, { clave: 'hora_resumen_diario', valor: '10:00' }] });
  conDrive(e);
  await sincronizarDrive(e);
  await conversar(e, ANA, PEDIDO_PERSONA('posataza koi', 50, '3'));
  e.correos = [];
  e.enviarCorreo = async c => { e.correos.push(c); };
  const r = await reportes({ tipo: 'diario' }, e);
  assert.equal(e.correos[0].to, 'duena@itswood.example');
  assert.equal(r.asunto, 'Mermín · Resumen del día 17/10/2026');
  assert.match(r.texto, /Leads: 1 \(🔴 ALTA 1 · MEDIA 0 · BAJA 0\)/);
  assert.match(r.texto, /🔴 Ana — Posataza para cafe - Koi × 50 — S\/ 2,250\.00 \(ganancia S\/ 1,350\.00\)/);
  assert.match(r.texto, /1\. Tiempo de primera respuesta: 180 min antes/);
  assert.match(r.texto, /4\. Ticket promedio: S\/ 713\.75 \(4 pedidos\)/);
  assert.match(r.texto, /5\. Clientes registrados: 7/);

  const fuera = entorno({ config: [{ clave: 'avisos_email', valor: 'duena@itswood.example' }, { clave: 'hora_resumen_diario', valor: '19:00' }] });
  assert.equal(await reportes({ tipo: 'diario' }, fuera), null, 'a otra hora no se envía');
});

test('reportes: el semanal compara con la semana anterior y lista los segmentos por activar', async () => {
  const { reportes } = require('../sim/pipeline');
  // Lunes 19/10/2026 08:00 en Lima: informa del 12 al 18 de octubre.
  const e = entorno({ inicio: '2026-10-19T13:00:00.000Z', config: [...CONFIG_DEMO, { clave: 'avisos_email', valor: 'a@x.example, b@x.example' }] });
  conDrive(e);
  await sincronizarDrive(e);
  const r = await reportes({ tipo: 'semanal' }, e);
  assert.equal(r.destinos, 'a@x.example,b@x.example');
  assert.match(r.texto, /Resumen semanal — ITS WOOD \(12\/10\/2026 al 18\/10\/2026\)/);
  assert.match(r.texto, /4\. Ticket promedio: — \(0 pedidos\) \(semana anterior: S\/ 107\.50\)/, 'P005 y P008 fueron la semana previa');
  assert.match(r.texto, /Segmentos con más clientes por activar/);
  assert.match(r.texto, /DORMIDO: 1 cliente\(s\) — POST \/campanas\/DORMIDO\/preview/);
});

// ---------- 7. Las 5 métricas ----------

const PEDIDO_EMPRESA = ['Hola', '1', 'Acme SAC', 'Luis', 'Fin de año', 'roma', '1', '20', 'no', 'mañana', 'Av. Javier Prado 100, San Isidro', 'mañanas', '1'];

async function escenarioMetricas() {
  const { llamarApi } = require('../sim/pipeline');
  const e = entorno();
  conDrive(e);
  await sincronizarDrive(e);
  await conversar(e, LUIS, PEDIDO_EMPRESA);
  await conversar(e, ANA, ['Hola', '2']);
  const [sol] = e.hoja.tablas.BOT_SOLICITUDES;
  await llamarApi({ metodo: 'POST', ruta: 'confirmar-orden', body: { solicitud_id: sol.solicitud_id, simular: true } }, e);
  return { e, llamarApi };
}

test('métricas: GET /metricas devuelve exactamente las 5 métricas', async () => {
  const { e, llamarApi } = await escenarioMetricas();
  const r = await llamarApi({ metodo: 'GET', ruta: 'metricas', query: {} }, e);
  assert.equal(r.status, 200);
  const m = r.cuerpo;
  assert.deepEqual(Object.keys(m).filter(k => !['ok', 'ruta', 'periodo'].includes(k)),
    ['tiempo_primera_respuesta', 'conversion', 'pedidos_corporativos', 'ticket_promedio', 'clientes_registrados']);
  assert.deepEqual(m.periodo, { desde: '2026-09-18', hasta: '2026-10-17' });

  // 1. Antes: línea base de BOT_CONFIG; después: mediana medida en BOT_EVENTOS (segundos en el simulador).
  assert.equal(m.tiempo_primera_respuesta.antes_minutos, 180);
  assert.equal(m.tiempo_primera_respuesta.conversaciones_medidas, 2);
  assert.ok(m.tiempo_primera_respuesta.despues_minutos < 1);
  assert.ok(m.tiempo_primera_respuesta.mejora_pct > 99);
  // 2. Una de las dos conversaciones terminó en pedido confirmado.
  assert.deepEqual(m.conversion, { conversaciones: 2, pedidos: 1, porcentaje: 50 });
  // 3. Pedido corporativo confirmado este mes; ninguno el anterior.
  assert.deepEqual(m.pedidos_corporativos, { mes: '2026-10', mes_actual: 1, mes_anterior: 0, variacion_pct: null });
  // 4. Ventas del período: P002 2550, P005 130, P007 90, P008 85.
  assert.deepEqual(m.ticket_promedio, { valor: 713.75, pedidos: 4, total_vendido: 2855, fuente: 'BOT_VENTAS' });
  // 5. Luis (BOT_CLIENTES al derivar) ya estaba en la fuente como Acme: 7 clientes únicos por teléfono.
  assert.equal(m.clientes_registrados.total, 7);
  assert.deepEqual(m.clientes_registrados.por_segmento, { EMPRESA: 1, PERSONA: 6, SIN_SEGMENTO: 0 });
  assert.equal(m.clientes_registrados.en_ambas, 1);
});

test('métricas: período a medida, ticket sin ventas y validación de fechas', async () => {
  const { e, llamarApi } = await escenarioMetricas();
  const junio = await llamarApi({ metodo: 'GET', ruta: 'metricas', query: { desde: '2026-06-01', hasta: '2026-06-30' } }, e);
  assert.deepEqual(junio.cuerpo.ticket_promedio, { valor: 175, pedidos: 1, total_vendido: 175, fuente: 'BOT_VENTAS' });
  e.hoja.tablas.BOT_VENTAS = [];
  const sinVentas = await llamarApi({ metodo: 'GET', ruta: 'metricas', query: {} }, e);
  assert.equal(sinVentas.cuerpo.ticket_promedio.fuente, 'BOT_SOLICITUDES');
  assert.equal(sinVentas.cuerpo.ticket_promedio.valor, 1700);
  assert.equal((await llamarApi({ metodo: 'GET', ruta: 'metricas', query: { desde: '17/10/2026' } }, e)).status, 400);
});

// ---------- 9. Contrato de API para el dashboard ----------

test('API: GET y PUT /config cambian el nombre del bot que ve el cliente', async () => {
  const { llamarApi } = require('../sim/pipeline');
  const e = entorno();
  const antes = await llamarApi({ metodo: 'GET', ruta: 'config' }, e);
  assert.equal(antes.cuerpo.config.nombre_bot, 'Mermín');
  assert.ok(antes.cuerpo.solo_lectura.includes('ultima_sync'));
  const put = await llamarApi({ metodo: 'PUT', ruta: 'config', body: { nombre_bot: 'Roble', porcentaje_descuento_web: '15' } }, e);
  assert.deepEqual(put.cuerpo, { ok: true, ruta: 'config', guardados: ['nombre_bot', 'porcentaje_descuento_web'] });
  assert.match((await e.cliente(ANA, 'Hola'))[0], /Soy Roble 🌳.*15% de descuento/s);
  assert.equal((await llamarApi({ metodo: 'PUT', ruta: 'config', body: { tono: 'raro' } }, e)).status, 400);
  assert.equal((await llamarApi({ metodo: 'POST', ruta: 'config', body: {} }, e)).status, 405);
});

test('API: GET y PUT /fidelizacion editan una regla sin borrar las otras columnas', async () => {
  const { llamarApi } = require('../sim/pipeline');
  const e = entorno();
  const put = await llamarApi({ metodo: 'PUT', ruta: 'fidelizacion', body: { reglas: [{ segmento: 'VIP', oferta: 'Envío gratis' }] } }, e);
  assert.deepEqual(put.cuerpo.guardados, ['VIP']);
  const r = await llamarApi({ metodo: 'GET', ruta: 'fidelizacion' }, e);
  const vip = r.cuerpo.reglas.find(x => x.segmento === 'VIP');
  assert.equal(vip.oferta, 'Envío gratis');
  assert.equal(vip.canal, 'WHATSAPP PERSONAL (HUMANO)');
  assert.equal(r.cuerpo.reglas.length, 5);
});

test('API: POST /config/drive conecta la carpeta y POST /sync sincroniza', async () => {
  const { llamarApi } = require('../sim/pipeline');
  const e = entorno();
  e.config.correoServicio = 'bot@proyecto.iam.gserviceaccount.com';
  e.drive = { listar: id => (id === 'CARPETA_DEMO_1234' ? demo.ARCHIVOS_CARPETA : []), leer: (id, p) => (id === 'SHEET_FUENTE' ? demo.copia()[p] : []) };
  const sinAcceso = await llamarApi({ metodo: 'POST', ruta: 'config/drive', body: { url: 'https://drive.google.com/drive/folders/OTRA_CARPETA_1' } }, e);
  assert.equal(sinAcceso.status, 403);
  assert.equal(sinAcceso.cuerpo.correo_servicio, 'bot@proyecto.iam.gserviceaccount.com');
  const ok = await llamarApi({ metodo: 'POST', ruta: 'config/drive', body: { url: 'https://drive.google.com/drive/folders/CARPETA_DEMO_1234?usp=sharing' } }, e);
  assert.equal(ok.cuerpo.hoja.id, 'SHEET_FUENTE');
  const sync = await llamarApi({ metodo: 'POST', ruta: 'sync', body: {} }, e);
  assert.equal(sync.cuerpo.ok, true);
  assert.match(sync.cuerpo.resumen, /9 productos, 7 clientes y 12 líneas de venta/);
  assert.match(sync.cuerpo.ultima_sync, /^2026-10-17T/);
  assert.equal((await llamarApi({ metodo: 'POST', ruta: 'config/drive', body: {} }, e)).status, 400);
});

test('API: rutas desconocidas y métodos equivocados', async () => {
  const { llamarApi } = require('../sim/pipeline');
  const e = entorno();
  assert.equal((await llamarApi({ metodo: 'GET', ruta: 'segmentos/VIP/otra' }, e)).status, 404);
  assert.equal((await llamarApi({ metodo: 'GET', ruta: 'campanas/VIP/preview' }, e)).status, 405);
  assert.equal((await llamarApi({ metodo: 'POST', ruta: 'campanas/OCASIONAL/preview', body: {} }, e)).status, 400);
});

module.exports = { entorno, conversar, conDrive, ANA, LUIS, CONFIG_DEMO };
