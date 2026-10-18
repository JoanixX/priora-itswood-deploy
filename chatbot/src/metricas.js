'use strict';

// Las 5 métricas clave del plan Mermín, calculadas sobre las pestañas del libro. Funciones puras: las usan
// GET /metricas y los resúmenes diario y semanal. Sin dependencias: nodos Code de n8n y simulador.
//   1. Tiempo de primera respuesta: antes (línea base de BOT_CONFIG) vs. después (mediana en BOT_EVENTOS).
//   2. % de consultas que terminan en pedido: solicitudes confirmadas ÷ conversaciones del período.
//   3. Pedidos corporativos del mes, comparados con el mes anterior.
//   4. Ticket promedio por pedido (BOT_VENTAS; si no hay ventas, el total referencial de las solicitudes).
//   5. Clientes registrados: únicos por teléfono en BOT_CLIENTES ∪ BOT_CLIENTES_FUENTE, por segmento.

const ZONA_METRICAS = 'America/Lima';
const DIAS_PERIODO = 30;
const SALIDAS_RESPUESTA = ['ENVIADO', 'SIMULADO', 'API'];

function metTexto(v) { return v === undefined || v === null ? '' : String(v).trim(); }
function metNumero(v) { const n = Number(metTexto(v).replace(',', '.')); return metTexto(v) !== '' && Number.isFinite(n) ? n : null; }
function metRedondeo(n, d = 2) { const f = 10 ** d; return Math.round(n * f) / f; }

// Fecha ISO (o YYYY-MM-DD) -> día en Lima, YYYY-MM-DD.
function diaLocal(v) {
  const s = metTexto(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return '';
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_METRICAS, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(t));
  const p = tipo => partes.find(x => x.type === tipo).value;
  return `${p('year')}-${p('month')}-${p('day')}`;
}
function sumarDiasMet(ymd, dias) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}
function mesAnterior(mes) {
  const [y, m] = mes.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}
function variacion(actual, anterior) { return anterior ? metRedondeo(((actual - anterior) / anterior) * 100, 1) : null; }
function mediana(valores) {
  if (!valores.length) return null;
  const o = [...valores].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}
function telefonoMet(v) {
  const d = metTexto(v).replace(/\D/g, '');
  if (/^9\d{8}$/.test(d)) return `51${d}`;
  return d.length >= 10 ? d : '';
}

// Período { desde, hasta } en días de Lima. Por defecto, los últimos 30 días hasta hoy.
function periodo(desde, hasta, ahora) {
  const fin = metTexto(hasta) || diaLocal(ahora || new Date().toISOString());
  const inicio = metTexto(desde) || sumarDiasMet(fin, -(DIAS_PERIODO - 1));
  return { desde: inicio, hasta: fin };
}
const enPeriodo = (dia, p) => !!dia && dia >= p.desde && dia <= p.hasta;

// Una solicitud cuenta como pedido cuando el equipo la confirma (flujo [6]) o la marca como vendida o entregada.
function esPedido(solicitud) {
  const estado = metTexto(solicitud.estado).toUpperCase();
  return estado === 'ORDEN_CONFIRMADA' || /ENTREGAD|PAGAD|VENDID|FACTURAD/.test(estado);
}

// 1. Mediana de minutos entre el primer mensaje del cliente y la primera respuesta, por conversación.
function tiempoPrimeraRespuesta(eventos, config, p) {
  const porConversacion = {};
  for (const e of eventos || []) {
    const id = metTexto(e.conversacion_id);
    const t = Date.parse(metTexto(e.fecha));
    if (!id || !Number.isFinite(t)) continue;
    const c = (porConversacion[id] = porConversacion[id] || { entrada: null, salida: null });
    const dir = metTexto(e.direccion).toUpperCase();
    if (dir === 'ENTRADA' && (c.entrada === null || t < c.entrada)) c.entrada = t;
    if ((dir === 'SALIDA' || dir === 'SALIDA_HUMANO') && SALIDAS_RESPUESTA.includes(metTexto(e.resultado).toUpperCase()) && (c.salida === null || t < c.salida)) c.salida = t;
  }
  const minutos = Object.values(porConversacion)
    .filter(c => c.entrada !== null && c.salida !== null && c.salida >= c.entrada && enPeriodo(diaLocal(new Date(c.entrada).toISOString()), p))
    .map(c => (c.salida - c.entrada) / 60000);
  const antes = metNumero(config.tfr_antes_minutos);
  const despues = mediana(minutos);
  return {
    antes_minutos: antes,
    despues_minutos: despues === null ? null : metRedondeo(despues, 1),
    mejora_pct: antes && despues !== null ? metRedondeo(((antes - despues) / antes) * 100, 1) : null,
    conversaciones_medidas: minutos.length,
  };
}

// 2. Conversaciones del período (por BOT_EVENTOS; sin eventos, por BOT_CONVERSACIONES.creado_en).
function conversion(eventos, conversaciones, solicitudes, p) {
  const ids = new Set();
  for (const e of eventos || []) {
    if (metTexto(e.direccion).toUpperCase() === 'ENTRADA' && metTexto(e.conversacion_id) && enPeriodo(diaLocal(e.fecha), p)) ids.add(metTexto(e.conversacion_id));
  }
  if (!ids.size) for (const c of conversaciones || []) if (metTexto(c.conversacion_id) && enPeriodo(diaLocal(c.creado_en), p)) ids.add(metTexto(c.conversacion_id));
  const pedidos = (solicitudes || []).filter(s => esPedido(s) && enPeriodo(diaLocal(s.fecha_registro), p)).length;
  return { conversaciones: ids.size, pedidos, porcentaje: ids.size ? metRedondeo((pedidos / ids.size) * 100, 1) : null };
}

// 3. Pedidos corporativos del mes de "hasta" y del mes anterior.
function pedidosCorporativos(solicitudes, p) {
  const mes = p.hasta.slice(0, 7);
  const anterior = mesAnterior(mes);
  const contar = m => (solicitudes || []).filter(s => esPedido(s) && metTexto(s.segmento).toUpperCase() === 'EMPRESA' && diaLocal(s.fecha_registro).slice(0, 7) === m).length;
  const actual = contar(mes);
  const previo = contar(anterior);
  return { mes, mes_actual: actual, mes_anterior: previo, variacion_pct: variacion(actual, previo) };
}

// 4. Ticket promedio: total por pedido_id en BOT_VENTAS; si no hay ventas, las solicitudes confirmadas.
function ticketPromedio(ventas, solicitudes, p) {
  const pedidos = {};
  for (const v of ventas || []) {
    const id = metTexto(v.pedido_id);
    const total = metNumero(v.total);
    if (!id || total === null || !enPeriodo(diaLocal(v.fecha), p)) continue;
    pedidos[id] = (pedidos[id] || 0) + total;
  }
  let totales = Object.values(pedidos);
  let fuente = 'BOT_VENTAS';
  if (!totales.length) {
    totales = (solicitudes || []).filter(s => esPedido(s) && enPeriodo(diaLocal(s.fecha_registro), p)).map(s => metNumero(s.total_referencial)).filter(n => n !== null);
    fuente = 'BOT_SOLICITUDES';
  }
  const suma = totales.reduce((a, b) => a + b, 0);
  return { valor: totales.length ? metRedondeo(suma / totales.length) : null, pedidos: totales.length, total_vendido: metRedondeo(suma), fuente };
}

// 5. Clientes únicos por teléfono. El segmento es EMPRESA o PERSONA (tipo de la fuente o segmento del bot).
function clientesRegistrados(clientesBot, clientesFuente) {
  const porTelefono = {};
  const agregar = (telefono, segmento, origen) => {
    const tel = telefonoMet(telefono);
    if (!tel) return;
    const c = (porTelefono[tel] = porTelefono[tel] || { segmento: '', origenes: new Set() });
    if (!c.segmento && segmento) c.segmento = segmento;
    c.origenes.add(origen);
  };
  for (const c of clientesFuente || []) agregar(c.telefono, metTexto(c.tipo).toUpperCase(), 'fuente');
  for (const c of clientesBot || []) agregar(c.telefono || c.wa_id, metTexto(c.segmento).toUpperCase(), 'bot');
  const lista = Object.values(porTelefono);
  const porSegmento = { EMPRESA: 0, PERSONA: 0, SIN_SEGMENTO: 0 };
  for (const c of lista) porSegmento[['EMPRESA', 'PERSONA'].includes(c.segmento) ? c.segmento : 'SIN_SEGMENTO'] += 1;
  return {
    total: lista.length,
    por_segmento: porSegmento,
    solo_bot: lista.filter(c => c.origenes.size === 1 && c.origenes.has('bot')).length,
    en_ambas: lista.filter(c => c.origenes.size === 2).length,
  };
}

function calcularMetricas({ config, eventos, solicitudes, conversaciones, ventas, clientesBot, clientesFuente, desde, hasta, ahora }) {
  const p = periodo(desde, hasta, ahora);
  return {
    periodo: p,
    tiempo_primera_respuesta: tiempoPrimeraRespuesta(eventos, config || {}, p),
    conversion: conversion(eventos, conversaciones, solicitudes, p),
    pedidos_corporativos: pedidosCorporativos(solicitudes, p),
    ticket_promedio: ticketPromedio(ventas, solicitudes, p),
    clientes_registrados: clientesRegistrados(clientesBot, clientesFuente),
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { calcularMetricas, periodo, diaLocal, sumarDiasMet, esPedido, mediana };
}
