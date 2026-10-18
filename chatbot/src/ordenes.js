'use strict';

// Confirmación de órdenes y cotizaciones a proveedores.
// Cuando el equipo confirma una orden (formulario de atención o API), se eligen los proveedores de la pestaña
// PROVEEDORES que atienden ese producto y se les manda la plantilla de WhatsApp para pedir cotización.
// Cuando un proveedor responde, su mensaje se guarda como respuesta de la cotización y no pasa por el bot de clientes.
// Sin dependencias: se usa en los nodos Code de n8n y en el simulador.

const PLANTILLA_COTIZACION = 'itswood_solicitud_cotizacion|es';
const ESTADOS_CONTACTADO = ['ENVIADA', 'SIMULADA', 'RESPONDIDA'];
const COLUMNAS_PROVEEDOR = ['proveedor_id', 'nombre', 'whatsapp', 'rubro', 'productos', 'contacto', 'activo', 'notas'];
const COLUMNAS_COTIZACION = [
  'cotizacion_id', 'solicitud_id', 'proveedor_id', 'proveedor_nombre', 'wa_proveedor', 'producto', 'cantidad',
  'enviado_en', 'estado', 'mensaje_id', 'respuesta', 'respondido_en', 'detalle',
];

function v(x) { return x === undefined || x === null ? '' : String(x).trim(); }
function n(x) { return v(x).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }

// Números de Perú con 9 dígitos se completan con 51; el resto se usa tal cual (solo dígitos).
function normalizarWhatsapp(x) {
  const d = v(x).replace(/\D/g, '');
  if (/^9\d{8}$/.test(d)) return `51${d}`;
  return d.length >= 10 ? d : '';
}

// Meta no acepta saltos de línea, tabuladores ni más de 4 espacios seguidos en los parámetros de una plantilla.
function parametroPlantilla(x, max) {
  const s = v(x).replace(/\s+/g, ' ').trim();
  return (s.length > (max || 200) ? s.slice(0, max || 200) : s) || '-';
}

function fechaVisible(x) {
  const s = v(x);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : s;
}

function leerProveedores(filas) {
  return (filas || []).map(f => ({
    proveedor_id: v(f.proveedor_id),
    nombre: v(f.nombre),
    whatsapp: normalizarWhatsapp(f.whatsapp),
    // "TODOS" atiende cualquier producto; si no, nombres internos separados por coma o punto y coma.
    productos: v(f.productos).split(/[;,]/).map(n).filter(Boolean),
    activo: n(f.activo) !== 'no',
  })).filter(p => p.proveedor_id && p.nombre && p.activo);
}

function proveedoresPara(nombreInterno, proveedores) {
  const clave = n(nombreInterno);
  return proveedores.filter(p => p.whatsapp && (p.productos.includes('todos') || (clave && p.productos.includes(clave))));
}

// Devuelve qué hacer al confirmar una orden: actualizar la solicitud y a qué proveedores escribir.
// Es idempotente: un proveedor ya contactado para esa solicitud no se vuelve a contactar.
function prepararCotizaciones({ solicitud, proveedores, cotizaciones, catalogo, ahora, simular, phoneNumberId }) {
  const ahoraIso = ahora || new Date().toISOString();
  const error = (texto, status) => ({ ok: false, status: status || 400, error: texto, envios: [] });
  if (!solicitud || !v(solicitud.solicitud_id)) return error('No existe esa solicitud.', 404);
  const solicitudId = v(solicitud.solicitud_id);
  const cantidad = parseInt(v(solicitud.cantidad), 10);
  if (!v(solicitud.producto_id) || !(cantidad > 0)) {
    return error(`La solicitud ${solicitudId} no tiene producto y cantidad; complétalos antes de confirmar la orden.`);
  }
  const producto = (catalogo || []).find(c => v(c.id) === v(solicitud.producto_id)) || {};
  const nombreInterno = v(producto.nombre_interno);
  const candidatos = proveedoresPara(nombreInterno, leerProveedores(proveedores));
  const yaContactados = new Set((cotizaciones || [])
    .filter(c => v(c.solicitud_id) === solicitudId && ESTADOS_CONTACTADO.includes(v(c.estado)))
    .map(c => v(c.proveedor_id)));

  const envios = candidatos.filter(p => !yaContactados.has(p.proveedor_id)).map(p => ({
    accion: simular ? 'registrar' : 'enviar',
    cotizacion_id: `COT-${solicitudId}-${p.proveedor_id}`,
    solicitud_id: solicitudId,
    proveedor_id: p.proveedor_id,
    proveedor_nombre: p.nombre,
    wa_proveedor: p.whatsapp,
    producto: v(solicitud.producto_nombre),
    cantidad,
    enviado_en: ahoraIso,
    estado: simular ? 'SIMULADA' : 'ENVIADA',
    phone_number_id: v(phoneNumberId),
    plantilla: PLANTILLA_COTIZACION,
    // Orden de {{1}}…{{6}} en la plantilla aprobada (ver docs/proveedores.md).
    parametros: [
      parametroPlantilla(p.nombre, 60),
      parametroPlantilla(solicitudId, 60),
      parametroPlantilla(solicitud.producto_nombre, 120),
      String(cantidad),
      parametroPlantilla(v(solicitud.personalizacion) || 'Sin personalización', 200),
      parametroPlantilla(fechaVisible(solicitud.fecha_deseada) || 'Por definir', 40),
    ],
  }));

  let resumen = `Orden ${solicitudId} confirmada.`;
  if (!nombreInterno) resumen += ' El producto no tiene nombre_interno en BOT_CATALOGO; solo se contactó a proveedores con TODOS.';
  if (!candidatos.length) resumen += ' No hay proveedores activos para este producto en PROVEEDORES.';
  else if (!envios.length) resumen += ' Todos los proveedores de este producto ya habían sido contactados.';
  else resumen += ` Se ${simular ? 'simuló el pedido' : 'pidió cotización'} a ${envios.length} proveedor(es): ${envios.map(e => e.proveedor_nombre).join(', ')}.`;

  return {
    ok: true,
    status: 200,
    solicitud_id: solicitudId,
    actualizar_solicitud: { solicitud_id: solicitudId, estado: 'ORDEN_CONFIRMADA' },
    ya_contactados: [...yaContactados],
    envios,
    resumen,
  };
}

// Mensaje entrante: si viene de un proveedor, se registra como respuesta de su cotización abierta más reciente.
function identificarProveedor(mensaje, proveedores) {
  const wa = normalizarWhatsapp(mensaje && mensaje.wa_id);
  const p = leerProveedores(proveedores).find(x => x.whatsapp && x.whatsapp === wa);
  return p ? { es_proveedor: true, proveedor_id: p.proveedor_id, proveedor_nombre: p.nombre } : { es_proveedor: false };
}

function registrarRespuestaProveedor({ mensaje, proveedor, cotizaciones, ahora }) {
  const abiertas = (cotizaciones || [])
    .filter(c => v(c.proveedor_id) === v(proveedor.proveedor_id) && ['ENVIADA', 'SIMULADA', 'RESPONDIDA'].includes(v(c.estado)))
    .sort((a, b) => v(b.enviado_en).localeCompare(v(a.enviado_en)));
  const cotizacion = abiertas[0];
  const texto = v(mensaje.texto) || (mensaje.media_id ? `[${v(mensaje.tipo)} ${v(mensaje.media_id)}]` : `[${v(mensaje.tipo)}]`);
  if (!cotizacion) return { actualizar: null, resultado: 'PROVEEDOR_SIN_COTIZACION_ABIERTA' };
  const previa = v(cotizacion.respuesta);
  const respuesta = (previa ? `${previa} | ${texto}` : texto).slice(0, 2000);
  return {
    actualizar: { cotizacion_id: v(cotizacion.cotizacion_id), estado: 'RESPONDIDA', respuesta, respondido_en: ahora || new Date().toISOString() },
    resultado: 'RESPUESTA_PROVEEDOR',
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    prepararCotizaciones, identificarProveedor, registrarRespuestaProveedor, normalizarWhatsapp,
    PLANTILLA_COTIZACION, COLUMNAS_PROVEEDOR, COLUMNAS_COTIZACION,
  };
}
