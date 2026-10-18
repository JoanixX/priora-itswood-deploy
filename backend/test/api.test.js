// Pruebas de la API contra el servidor real en un puerto libre, con el almacén en memoria.
process.env.TZ = 'America/Lima';

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Almacen, aFilas, deFilas, TABLAS } from '../src/almacen/index.js';
import { iniciarServidor } from '../src/servidor.js';
import { leerXlsx } from '../src/xlsx.js';
import { ESCENARIOS, correrEscenario } from '../scripts/escenarios.mjs';

const archivo = (nombre) => readFileSync(new URL(`./archivos/${nombre}`, import.meta.url));

async function levantar(opciones = {}) {
  const almacen = await new Almacen({ ejemplos: opciones.ejemplos ?? true, persistencia: opciones.persistencia || null, esperaEscritura: 5 }).iniciar();
  const servidor = await iniciarServidor({ almacen, google: opciones.google || null, origenes: opciones.origenes || ['*'] }, 0);
  const base = `http://127.0.0.1:${servidor.address().port}`;
  const api = async (ruta, { method = 'GET', body, form, headers = {} } = {}) => {
    const res = await fetch(`${base}${ruta}`, {
      method, headers: form ? headers : { 'Content-Type': 'application/json', ...headers }, body: form || (body !== undefined ? JSON.stringify(body) : undefined),
    });
    const tipo = res.headers.get('content-type') || '';
    return { status: res.status, headers: res.headers, datos: tipo.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer()) };
  };
  const chat = async (cuerpo) => (await api('/chat', { method: 'POST', body: cuerpo })).datos;
  const subir = (ruta, nombre, contenido, tipo = 'text/csv') => {
    const form = new FormData();
    form.append('archivo', new Blob([contenido], { type: tipo }), nombre);
    return api(ruta, { method: 'POST', form });
  };
  return { almacen, servidor, api, chat, subir, cerrar: () => new Promise((r) => servidor.close(r)) };
}

test('health y CORS: solo el dominio del frontend', async (t) => {
  const s = await levantar({ origenes: ['https://priora-app.vercel.app'] });
  t.after(s.cerrar);
  const h = await s.api('/health', { headers: { Origin: 'https://priora-app.vercel.app' } });
  assert.equal(h.status, 200);
  assert.equal(h.datos.ok, true);
  assert.equal(h.datos.almacen, 'memoria');
  assert.equal(h.headers.get('access-control-allow-origin'), 'https://priora-app.vercel.app');
  const otro = await s.api('/health', { headers: { Origin: 'https://otro.example' } });
  assert.equal(otro.headers.get('access-control-allow-origin'), null);
  const pre = await fetch(`http://127.0.0.1:${s.servidor.address().port}/chat`, { method: 'OPTIONS', headers: { Origin: 'https://priora-app.vercel.app', 'Access-Control-Request-Method': 'POST' } });
  assert.equal(pre.status, 204);
  assert.match(pre.headers.get('access-control-allow-methods'), /PATCH/);
  assert.equal((await s.api('/no-existe')).status, 404);
  assert.equal((await s.api('/health', { method: 'POST' })).status, 405);
});

test('chat: los 3 escenarios de la demo dan alta, automático y derivado, y crean el pedido', async (t) => {
  const s = await levantar();
  t.after(s.cerrar);
  for (const e of ESCENARIOS) {
    const r = await correrEscenario(s.chat, e);
    assert.equal(r.paso, 'cerrado', e.id);
    assert.match(r.pedido_id, /^PED-\d{4}$/, e.id);
    assert.equal(r.prioridad.prioridad, e.esperado, `${e.id}: ${r.prioridad.motivo}`);
    const p = (await s.api(`/pedidos/${r.pedido_id}`)).datos;
    assert.equal(p.prioridad, e.esperado);
    assert.equal(p.estado, 'nuevo');
  }
  const pedidos = (await s.api('/pedidos')).datos;
  assert.equal(pedidos.length, 9, '6 de ejemplo + 3 nuevos');
  // Derivado y alta primero; automático al final.
  assert.ok(['derivado', 'alta'].includes(pedidos[0].prioridad));
  assert.equal(pedidos.at(-1).prioridad, 'automatico');
  const avisos = (await s.api('/notificaciones')).datos.map((n) => n.tipo);
  assert.ok(avisos.includes('pedido_alta') && avisos.includes('pedido_derivado') && avisos.includes('pedido'));
});

test('chat: bienvenida con enlace a la tienda, máximo 3 botones, reclamo deriva', async (t) => {
  const s = await levantar();
  t.after(s.cerrar);
  const r = await s.chat({ conversacion_id: null, texto: null, boton_id: null });
  assert.match(r.conversacion_id, /^c-/);
  assert.equal(r.mensajes[0].enlace.url, 'https://itswood.pe');
  assert.match(r.mensajes[0].texto, /Soy Mermín/);
  assert.ok(r.mensajes.every((m) => !m.botones || m.botones.length <= 3));
  const rec = await s.chat({ conversacion_id: r.conversacion_id, texto: 'Tengo un reclamo, me llegó roto', boton_id: null });
  assert.equal(rec.paso, 'derivado');
  assert.equal(rec.borrador.flags.reclamo, true);
  assert.equal((await s.api('/chat', { method: 'POST', body: { texto: 'x'.repeat(1001) } })).status, 400);
});

test('config: PATCH valida, aplica de inmediato y recalcula prioridades', async (t) => {
  const s = await levantar();
  t.after(s.cerrar);
  const c = (await s.api('/config')).datos;
  assert.equal(c.asistente, 'Mermín');
  assert.deepEqual(c.reglas, { minimo_empresa: 12, umbral_alta: 30, maximo_sin_derivar: 100, dias_fecha_cercana: 14 });
  const mal = await s.api('/config', { method: 'PATCH', body: { reglas: { umbral_alta: 5 } } });
  assert.equal(mal.status, 400);
  assert.equal(mal.datos.error, 'umbral_alta debe ser mayor que minimo_empresa');
  assert.equal((await s.api('/config', { method: 'PATCH', body: { negocio: 'Otro' } })).status, 400, 'campo no editable');
  const ok = await s.api('/config', { method: 'PATCH', body: { asistente: 'Roble', textos: { saludo: '¡Hola! Soy Roble.' }, tono: 'cercano', reglas: { maximo_sin_derivar: 200 } } });
  assert.equal(ok.status, 200);
  assert.equal(ok.datos.textos.aviso_ia, 'Soy un asistente con IA. Si prefieres, te paso con la dueña.', 'merge parcial');
  assert.match((await s.chat({})).mensajes[0].texto, /Soy Roble/);
  // PED-E002 (150 u.) deja de ser derivado por volumen con el nuevo máximo.
  const e2 = (await s.api('/pedidos/PED-E002')).datos;
  assert.equal(e2.prioridad, 'alta');
});

test('catálogo: valida CSV, rechaza errores por fila, confirma y descarga la plantilla xlsx', async (t) => {
  const s = await levantar();
  t.after(s.cerrar);
  const bien = await s.subir('/catalogo/validar', 'catalogo_correcto.csv', archivo('catalogo_correcto.csv'));
  assert.equal(bien.datos.valido, true);
  assert.equal(bien.datos.filas, 3);
  assert.equal(bien.datos.vista_previa[2].stock, null);
  const mal = await s.subir('/catalogo/validar', 'catalogo_con_errores.csv', archivo('catalogo_con_errores.csv'));
  assert.equal(mal.datos.valido, false);
  assert.deepEqual(mal.datos.errores, ['Fila 2: precio no es un número', 'Fila 3: falta el nombre del producto', 'Fila 4: stock debe ser un número entero o quedar vacío']);
  assert.equal((await s.subir('/catalogo/confirmar', 'catalogo_con_errores.csv', archivo('catalogo_con_errores.csv'))).status, 400);

  const plantilla = await s.api('/catalogo/plantilla');
  assert.match(plantilla.headers.get('content-type'), /spreadsheetml/);
  assert.deepEqual(leerXlsx(plantilla.datos)[0], ['producto', 'categoria', 'precio', 'stock', 'descripcion']);
  // La plantilla descargada se puede subir tal cual.
  const desdeXlsx = await s.subir('/catalogo/validar', 'plantilla.xlsx', plantilla.datos, 'application/octet-stream');
  assert.equal(desdeXlsx.datos.valido, true);
  assert.equal(desdeXlsx.datos.vista_previa[0].precio, 28);

  const conf = await s.subir('/catalogo/confirmar', 'catalogo_correcto.csv', archivo('catalogo_correcto.csv'));
  assert.deepEqual(conf.datos, { ok: true, filas: 3 });
  assert.equal((await s.api('/catalogo')).datos.length, 3);
  assert.equal((await s.api('/catalogo/validar', { method: 'POST', body: {} })).status, 400, 'sin multipart');
});

test('pedidos: PATCH estado, validación y aviso al derivar', async (t) => {
  const s = await levantar();
  t.after(s.cerrar);
  const ok = await s.api('/pedidos/PED-E001', { method: 'PATCH', body: { estado: 'confirmado' } });
  assert.equal(ok.datos.estado, 'confirmado');
  assert.equal((await s.api('/pedidos?estado=confirmado')).datos.length, 1);
  assert.equal((await s.api('/pedidos/PED-E001', { method: 'PATCH', body: { estado: 'pagado' } })).status, 400);
  assert.equal((await s.api('/pedidos/PED-E001', { method: 'PATCH', body: { estado: 'nuevo', resumen: 'x' } })).status, 400);
  assert.equal((await s.api('/pedidos/PED-9999')).status, 404);
  await s.api('/pedidos/PED-E005', { method: 'PATCH', body: { estado: 'derivado' } });
  assert.equal((await s.api('/pedidos/PED-E005')).datos.prioridad, 'derivado');
  // (Después de las 19:00 también aparece el resumen del día: se busca por título.)
  assert.ok((await s.api('/notificaciones')).datos.some((n) => n.titulo === 'Pedido marcado como derivado'));
});

test('métricas, segmentos y recomendaciones con la forma del contrato', async (t) => {
  const s = await levantar();
  t.after(s.cerrar);
  await correrEscenario(s.chat, ESCENARIOS[0]);
  const m = (await s.api(`/metricas?periodo=${new Date().getFullYear()}`)).datos;
  assert.equal(m.conversion_consultas.consultas, 1);
  assert.equal(m.conversion_consultas.pedidos, 1);
  assert.equal(m.conversion_consultas.porcentaje, 100);
  assert.equal(m.tiempo_primera_respuesta.antes_min, null);
  assert.ok(m.tiempo_primera_respuesta.despues_min >= 0);
  assert.ok(m.ticket_promedio.total > 0, 'ticket del histórico de ventas');
  assert.ok(m.clientes_registrados.total > 200);
  assert.equal((await s.api('/metricas?periodo=sept')).status, 400);

  const seg = (await s.api('/segmentos')).datos;
  assert.deepEqual(seg.map((x) => x.id), ['empresas_recurrentes', 'empresas_un_pedido', 'personas_recurrentes', 'personas_una_compra', 'inactivos']);
  assert.ok(seg.every((x) => typeof x.clientes === 'number' && 'monto' in x && 'ultima_compra' in x));
  const r = (await s.api('/segmentos/empresas_un_pedido/recomendaciones')).datos;
  assert.equal(r.segmento, 'empresas_un_pedido');
  assert.ok(r.recomendaciones.length > 0 && r.recomendaciones.every((x) => x.titulo && x.motivo && x.canal && x.mensaje_borrador));
  assert.equal(r.secuencia_postventa.length, 3);
  assert.equal((await s.api('/segmentos/otro/recomendaciones')).status, 404);
});

test('notificaciones: marcar como leída', async (t) => {
  const s = await levantar();
  t.after(s.cerrar);
  const r = await s.api('/notificaciones/N-E1', { method: 'PATCH', body: { leida: true } });
  assert.equal(r.datos.leida, true);
  assert.equal((await s.api('/notificaciones/N-E1', { method: 'PATCH', body: {} })).status, 400);
  assert.equal((await s.api('/notificaciones/N-X', { method: 'PATCH', body: { leida: true } })).status, 404);
});

test('fuentes: sin cuenta de servicio queda en error; con Google lee la hoja de ventas', async (t) => {
  const sin = await levantar();
  t.after(sin.cerrar);
  assert.equal((await sin.api('/fuentes', { method: 'POST', body: { url: 'https://example.com', tipo: 'ventas' } })).status, 400);
  const f = await sin.api('/fuentes', { method: 'POST', body: { url: 'https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOp/edit', tipo: 'ventas' } });
  assert.equal(f.status, 201);
  await new Promise((r) => setTimeout(r, 20));
  const lista = (await sin.api('/fuentes')).datos;
  assert.equal(lista.correo_servicio, null);
  assert.equal(lista.fuentes[0].estado, 'error');
  assert.match(lista.fuentes[0].error, /GOOGLE_SERVICE_ACCOUNT_JSON/);

  // Google simulado: una hoja de ventas con las columnas de la vista Datos.
  const google = {
    correo: 'priora@demo.iam.gserviceaccount.com',
    hojasDeCarpeta: async () => [{ id: 'HOJA1', name: 'Ventas 2026' }],
    info: async () => ({ titulo: 'Ventas 2026', pestanas: ['VENTAS 2026'] }),
    leerValores: async () => [
      ['Fecha de pedido', 'Cliente', 'Plataforma', 'Fecha de entrega', 'Distrito', 'Producto', 'Cantidad', 'Precio unitario', 'Delivery', 'Estado', 'Detalles'],
      ['5/9/2026', 'Acme SAC', 'WhatsApp', '20/9/2026', 'San Isidro', 'Dock 3 en 1', 30, 80, 0, 'Entregado', 'Logo grabado'],
      ['6/9/2026', 'Ana', 'Instagram', '', 'Miraflores', 'Tabla Roma', 1, 'S/.85.00', 10, 'Pendiente', ''],
      ['1/10/2026', 'Acme SAC', 'WhatsApp', '', 'San Isidro', 'Posacelular', 40, 28, 0, 'Pendiente', ''],
    ],
  };
  const con = await levantar({ google });
  t.after(con.cerrar);
  assert.equal((await con.api('/fuentes')).datos.correo_servicio, 'priora@demo.iam.gserviceaccount.com');
  assert.equal((await con.api('/config')).datos.correo_servicio, 'priora@demo.iam.gserviceaccount.com');
  const nueva = (await con.api('/fuentes', { method: 'POST', body: { url: 'https://drive.google.com/drive/folders/1CarpetaDeDrive123', tipo: 'ventas' } })).datos;
  await new Promise((r) => setTimeout(r, 20));
  const leida = (await con.api('/fuentes')).datos.fuentes.find((x) => x.id === nueva.id);
  assert.equal(leida.estado, 'ok', leida.error);
  assert.equal(leida.filas, 3);
  assert.equal(con.almacen.datos.ventas[1].monto, 95, '85 + 10 de delivery');
  const seg = Object.fromEntries((await con.api('/segmentos')).datos.map((x) => [x.id, x.clientes]));
  assert.equal(seg.empresas_recurrentes, 1, 'Acme SAC con 2 pedidos');
  assert.equal(seg.personas_una_compra, 1);
});

test('almacén en Sheets: guarda cada pestaña y al reiniciar recupera los pedidos', async () => {
  const hojas = {};
  const persistencia = {
    nombre: 'sheets',
    leer: async (hoja) => hojas[hoja] || null,
    escribir: async (hoja, encabezado, filas) => { hojas[hoja] = [encabezado, ...filas]; },
  };
  const s = await levantar({ persistencia });
  const r = await correrEscenario(s.chat, ESCENARIOS[0]);
  await s.api('/config', { method: 'PATCH', body: { asistente: 'Roble' } });
  await s.almacen.vaciar();
  await s.cerrar();
  assert.deepEqual(hojas.Pedidos[0], TABLAS.pedidos.columnas);
  assert.ok(hojas.Pedidos.some((f) => f[0] === r.pedido_id));
  for (const t of ['Config', 'Catalogo', 'Clientes', 'Notificaciones', 'Conversaciones', 'Ventas']) assert.ok(hojas[t], `pestaña ${t}`);

  const otra = await levantar({ persistencia });
  const p = (await otra.api(`/pedidos/${r.pedido_id}`)).datos;
  assert.equal(p.cliente.empresa, 'Grupo Miraflores SAC');
  assert.equal(p.productos[0].producto_id, 'PR-4D655976');
  assert.equal(p.prioridad, 'alta');
  assert.equal((await otra.api('/config')).datos.asistente, 'Roble');
  await otra.cerrar();
});

test('filas de la hoja: ida y vuelta de pedidos y config', () => {
  const pedido = { id: 'PED-0001', creado_en: '2026-10-17T10:00:00.000Z', estado: 'nuevo', cliente: { nombre: null, empresa: 'Acme SAC', telefono: '999111222', correo: null, tipo: 'empresa', ya_compro_antes: true }, ocasion: 'Navidad', cantidad_total: 30, fecha_requerida: '2026-12-15', productos: [{ producto_id: 'PR-1', nombre: 'Dock', cantidad: 30, precio_unitario: 80 }], personalizacion: 'Logo', entrega: null, flags: {}, resumen: 'x', conversacion_id: 'c-1', ejemplo: false };
  const [vuelta] = deFilas('pedidos', aFilas('pedidos', [pedido]));
  assert.deepEqual(vuelta, pedido);
  const config = deFilas('config', aFilas('config', { asistente: 'Mermín', reglas: { umbral_alta: 30 } }));
  assert.deepEqual(config, { asistente: 'Mermín', reglas: { umbral_alta: 30 } });
});

test('fuentes datos y subida de archivos Excel/CSV (ventas, pedidos, clientes, catálogo)', async (t) => {
  const s = await levantar();
  t.after(s.cerrar);

  const ventasIni = await s.api('/ventas');
  assert.equal(ventasIni.status, 200);
  assert.equal(ventasIni.datos.length, 264);

  // Subir hoja de pedidos por CSV en Datos
  const csvPedidos = [
    'id,fecha,cliente,tipo (empresa/persona),producto,cantidad,fecha requerida,personalización,estado',
    'PED-H01,10/10/2026,Constructora Sol SAC,empresa,Dock 3 en 1,35,20/12/2026,Logo grabado,nuevo',
  ].join('\n');
  const subPed = await s.subir('/fuentes/archivo?tipo=pedidos', 'pedidos_oct.csv', Buffer.from(csvPedidos));
  assert.equal(subPed.status, 201);
  assert.equal(subPed.datos.estado, 'ok');
  assert.equal(subPed.datos.filas, 1);

  // Consultar filas de la fuente recién subida
  const datosPed = await s.api(`/fuentes/${subPed.datos.id}/datos`);
  assert.equal(datosPed.status, 200);
  assert.equal(datosPed.datos.tipo, 'pedidos');
  assert.equal(datosPed.datos.filas.length, 1);
  assert.equal(datosPed.datos.filas[0].id, 'PED-H01');
  assert.equal(datosPed.datos.filas[0].cliente.empresa, 'Constructora Sol SAC');

  // El pedido importado también aparece en GET /pedidos
  const pImportado = await s.api('/pedidos/PED-H01');
  assert.equal(pImportado.status, 200);
  assert.equal(pImportado.datos.prioridad, 'alta');

  // Subir hoja de clientes por CSV en Datos
  const csvClientes = [
    'cliente,tipo (empresa/persona),teléfono,correo,distrito',
    'Minera Norte SAC,empresa,987654321,compras@mineranorte.pe,San Isidro',
    'Lucía Pérez,persona,912345678,lucia@example.com,Miraflores',
  ].join('\n');
  const subCli = await s.subir('/fuentes/archivo?tipo=clientes', 'clientes.csv', Buffer.from(csvClientes));
  assert.equal(subCli.status, 201);
  assert.equal(subCli.datos.filas, 2);
  const datosCli = await s.api(`/fuentes/${subCli.datos.id}/datos`);
  assert.equal(datosCli.status, 200);
  assert.equal(datosCli.datos.filas.length, 2);
  assert.equal(datosCli.datos.filas[0].cliente, 'Minera Norte SAC');
  assert.equal(datosCli.datos.filas[0].distrito, 'San Isidro');
});

