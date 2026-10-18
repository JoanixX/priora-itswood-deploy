'use strict';

// Textos de los reportes al negocio (flujo [10]): resumen diario y semanal. Funciones puras; n8n solo los envía.
// El aviso inmediato de un lead ALTA lo arma el motor al derivar (avisoLeadAlta) y sale por el flujo [1].
// En n8n se concatenan antes config.js, metricas.js y fidelizacion.js; en Node se cargan con require.

const REPORTE_DEPS = typeof calcularMetricas === 'function'
  ? { leerConfig, calcularMetricas, diaLocal, sumarDiasMet, esPedido, aQuienLeToca, SEGMENTOS_FIDELIZACION }
  : { ...require('./config'), ...require('./metricas'), ...require('./fidelizacion') };

const ZONA_REPORTES = 'America/Lima';

function repTexto(v) { return v === undefined || v === null ? '' : String(v).trim(); }
function repNumero(v) { const n = Number(repTexto(v)); return repTexto(v) !== '' && Number.isFinite(n) ? n : null; }
function soles(n) {
  if (n === null || n === undefined) return '—';
  const [e, d] = Number(n).toFixed(2).split('.');
  return `S/ ${e.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${d}`;
}
function diaVisible(ymd) { return `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}`; }
function valorOGuion(v, sufijo) { return v === null || v === undefined ? '—' : `${v}${sufijo || ''}`; }

// Hora de Lima (0-23) de una fecha ISO.
function horaLocal(iso) {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: ZONA_REPORTES, hour: '2-digit', hour12: false }).format(new Date(iso))) % 24;
}

// El flujo corre cada hora: el resumen diario sale solo en la hora de BOT_CONFIG.hora_resumen_diario.
function tocaResumenDiario(config, ahora) {
  const hora = parseInt(repTexto(config.hora_resumen_diario).split(':')[0], 10);
  return Number.isFinite(hora) && horaLocal(ahora || new Date().toISOString()) === hora;
}

function lineasMetricas(m, anterior) {
  const comparar = (previo, formato) => (anterior ? ` (semana anterior: ${formato(previo)})` : '');
  const t = m.tiempo_primera_respuesta;
  const c = m.conversion;
  const corp = m.pedidos_corporativos;
  const tk = m.ticket_promedio;
  const cl = m.clientes_registrados;
  const a = anterior || {};
  return [
    `1. Tiempo de primera respuesta: ${valorOGuion(t.antes_minutos, ' min')} antes → ${valorOGuion(t.despues_minutos, ' min')} con el bot`
      + `${t.mejora_pct === null ? '' : ` (${t.mejora_pct}% menos)`}${comparar(a.tiempo_primera_respuesta, x => valorOGuion(x && x.despues_minutos, ' min'))}`,
    `2. Consultas que terminan en pedido: ${valorOGuion(c.porcentaje, '%')} (${c.pedidos} de ${c.conversaciones})${comparar(a.conversion, x => valorOGuion(x && x.porcentaje, '%'))}`,
    `3. Pedidos corporativos del mes: ${corp.mes_actual} (mes anterior: ${corp.mes_anterior})`,
    `4. Ticket promedio: ${soles(tk.valor)} (${tk.pedidos} pedidos)${comparar(a.ticket_promedio, x => soles(x && x.valor))}`,
    `5. Clientes registrados: ${cl.total} (EMPRESA ${cl.por_segmento.EMPRESA} · PERSONA ${cl.por_segmento.PERSONA})`,
  ];
}

function enRango(dia, desde, hasta) { return !!dia && dia >= desde && dia <= hasta; }

// Leads (solicitudes) y ventas de un rango de días.
function actividad(d, desde, hasta) {
  const leads = (d.solicitudes || []).filter(s => enRango(REPORTE_DEPS.diaLocal(s.fecha_registro), desde, hasta));
  const porNivel = { ALTA: 0, MEDIA: 0, BAJA: 0 };
  for (const s of leads) if (porNivel[repTexto(s.prioridad).toUpperCase()] !== undefined) porNivel[repTexto(s.prioridad).toUpperCase()] += 1;
  const altas = leads.filter(s => repTexto(s.prioridad).toUpperCase() === 'ALTA')
    .sort((a, b) => (repNumero(b.puntaje_prioridad) || 0) - (repNumero(a.puntaje_prioridad) || 0)).slice(0, 5);
  const pedidos = leads.filter(REPORTE_DEPS.esPedido).length;
  const ventas = (d.ventas || []).filter(v => enRango(REPORTE_DEPS.diaLocal(v.fecha), desde, hasta));
  const idsVenta = new Set(ventas.map(v => repTexto(v.pedido_id)));
  const totalVentas = ventas.reduce((s, v) => s + (repNumero(v.total) || 0), 0);
  return { leads: leads.length, porNivel, altas, pedidos, pedidosVenta: idsVenta.size, totalVentas };
}

function lineasActividad(a) {
  const lineas = [`Leads: ${a.leads} (🔴 ALTA ${a.porNivel.ALTA} · MEDIA ${a.porNivel.MEDIA} · BAJA ${a.porNivel.BAJA})`];
  for (const s of a.altas) {
    const cliente = repTexto(s.empresa) || repTexto(s.nombre) || `+${repTexto(s.wa_id)}`;
    lineas.push(`  🔴 ${cliente} — ${repTexto(s.producto_nombre) || 'producto por definir'} × ${repTexto(s.cantidad) || '?'} — ${soles(repNumero(s.valor_estimado))} (ganancia ${soles(repNumero(s.ganancia_estimada))})`);
  }
  lineas.push(`Pedidos confirmados: ${a.pedidos}`);
  lineas.push(`Ventas registradas: ${a.pedidosVenta} pedido(s) · ${soles(a.totalVentas)}`);
  return lineas;
}

function metricasDe(d, config, desde, hasta, ahora) {
  return REPORTE_DEPS.calcularMetricas({
    config, eventos: d.eventos, solicitudes: d.solicitudes, conversaciones: d.conversaciones, ventas: d.ventas,
    clientesBot: d.clientes, clientesFuente: d.clientesFuente, desde, hasta, ahora,
  });
}

// d: filas de las pestañas (las mismas que lee el panel). Devuelve { asunto, texto, destinos }.
function resumenDiario(d, ahora) {
  const ahoraIso = ahora || new Date().toISOString();
  const config = REPORTE_DEPS.leerConfig(d.config);
  const hoy = REPORTE_DEPS.diaLocal(ahoraIso);
  const negocio = config.nombre_negocio;
  // Las métricas del día no alcanzan para el ticket y la conversión: se informan las de los últimos 30 días.
  const m = metricasDe(d, config, '', hoy, ahoraIso);
  const texto = [
    `Resumen del día — ${negocio} (${diaVisible(hoy)})`,
    '',
    ...lineasActividad(actividad(d, hoy, hoy)),
    '',
    `Métricas clave (${diaVisible(m.periodo.desde)} al ${diaVisible(m.periodo.hasta)})`,
    ...lineasMetricas(m),
  ].join('\n');
  return { tipo: 'diario', asunto: `${config.nombre_bot} · Resumen del día ${diaVisible(hoy)}`, texto, destinos: destinosEmail(config) };
}

// Semana de lunes a domingo anterior a "ahora", comparada con la previa, y segmentos con más clientes por activar.
function resumenSemanal(d, ahora) {
  const ahoraIso = ahora || new Date().toISOString();
  const config = REPORTE_DEPS.leerConfig(d.config);
  const hoy = REPORTE_DEPS.diaLocal(ahoraIso);
  const diaSemana = (new Date(`${hoy}T12:00:00Z`).getUTCDay() + 6) % 7; // lunes = 0
  const lunes = REPORTE_DEPS.sumarDiasMet(hoy, -diaSemana - 7);
  const domingo = REPORTE_DEPS.sumarDiasMet(lunes, 6);
  const lunesPrevio = REPORTE_DEPS.sumarDiasMet(lunes, -7);
  const domingoPrevio = REPORTE_DEPS.sumarDiasMet(lunes, -1);
  const m = metricasDe(d, config, lunes, domingo, ahoraIso);
  const previa = metricasDe(d, config, lunesPrevio, domingoPrevio, ahoraIso);
  const porActivar = REPORTE_DEPS.SEGMENTOS_FIDELIZACION.map(segmento => {
    const r = REPORTE_DEPS.aQuienLeToca({ segmento, clientes: d.clientesFuente, ventas: d.ventas, productos: d.productos, fidelizacion: d.fidelizacion, campanas: d.campanas, config, ahora: ahoraIso });
    return { segmento, clientes: r.ok ? r.destinatarios.length : 0 };
  }).filter(s => s.clientes > 0).sort((a, b) => b.clientes - a.clientes);
  const texto = [
    `Resumen semanal — ${config.nombre_negocio} (${diaVisible(lunes)} al ${diaVisible(domingo)})`,
    '',
    ...lineasActividad(actividad(d, lunes, domingo)),
    '',
    'Métricas clave',
    ...lineasMetricas(m, previa),
    '',
    'Segmentos con más clientes por activar',
    ...(porActivar.length ? porActivar.map(s => `  ${s.segmento}: ${s.clientes} cliente(s) — POST /campanas/${s.segmento}/preview`) : ['  Ninguno: todos los segmentos están al día.']),
  ].join('\n');
  return { tipo: 'semanal', asunto: `${config.nombre_bot} · Resumen semanal ${diaVisible(lunes)}–${diaVisible(domingo)}`, texto, destinos: destinosEmail(config), por_activar: porActivar };
}

function destinosEmail(config) {
  return repTexto(config.avisos_email).split(/[,;\s]+/).filter(x => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)).join(',');
}

if (typeof module !== 'undefined' && module.exports) module.exports = { resumenDiario, resumenSemanal, tocaResumenDiario, horaLocal };
