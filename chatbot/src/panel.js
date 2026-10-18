'use strict';

// Respuestas de las rutas del dashboard que se calculan con las pestañas del libro (métricas, configuración,
// segmentos...). El flujo [7] lee las pestañas y llama a responderPanel; el simulador hace lo mismo.
// En n8n se concatenan antes config.js, metricas.js y fidelizacion.js; en Node se cargan con require.

const PANEL_DEPS = typeof calcularMetricas === 'function'
  ? {
    leerConfig, validarCambiosConfig, DESCRIPCIONES_CONFIG, CLAVES_SOLO_LECTURA, calcularMetricas,
    segmentar, conteoSegmentos, leerReglas, validarReglas, recomendarPara, audiencia, aQuienLeToca,
  }
  : { ...require('./config'), ...require('./metricas'), ...require('./fidelizacion') };

// Lo que el dashboard muestra de cada cliente segmentado (sin las listas internas).
// PUT /config y PUT /fidelizacion: cambios del dashboard -> filas a guardar (appendOrUpdate) y respuesta.
function cambiosPanel(peticion) {
  const r = peticion.ruta === 'config-put'
    ? PANEL_DEPS.validarCambiosConfig(peticion.cambios)
    : PANEL_DEPS.validarReglas(peticion.cambios);
  if (!r.ok) return { ok: false, filas: [], status: 400, cuerpo: { ok: false, error: r.error } };
  const clave = peticion.ruta === 'config-put' ? 'clave' : 'segmento';
  return { ok: true, filas: r.filas, status: 200, cuerpo: { ok: true, ruta: peticion.ruta.replace(/-put$/, ''), guardados: r.filas.map(f => f[clave]) } };
}

function clientePanel(c) {
  const { fechas_pedidos, skus_comprados, ...visible } = c;
  return visible;
}

function panelFilas(filas) {
  return (filas || []).filter(x => x && Object.keys(x).some(k => k !== 'row_number' && String(x[k] ?? '').trim() !== ''));
}

// peticion: salida de validarPeticion. datos: { config, eventos, solicitudes, conversaciones, ventas, clientes,
// clientesFuente, productos, fidelizacion } con las filas de cada pestaña.
function responderPanel(peticion, datos, ahora) {
  const d = {};
  for (const k of Object.keys(datos || {})) d[k] = panelFilas(datos[k]);
  const config = PANEL_DEPS.leerConfig(d.config);
  const ahoraIso = ahora || new Date().toISOString();
  // Los segmentos se recalculan en cada consulta: así reflejan la última sincronización aunque el día haya cambiado.
  const segmentados = () => PANEL_DEPS.segmentar({ clientes: d.clientesFuente, ventas: d.ventas, ahora: ahoraIso });
  const reglas = () => PANEL_DEPS.leerReglas(d.fidelizacion);
  const recomendar = (cliente, r) => PANEL_DEPS.recomendarPara(cliente, { productos: d.productos, ventas: d.ventas, reglas: r, config, ahora: ahoraIso });
  switch (peticion.ruta) {
    case 'config':
      return {
        status: 200,
        cuerpo: { ok: true, ruta: 'config', config, descripciones: PANEL_DEPS.DESCRIPCIONES_CONFIG, solo_lectura: PANEL_DEPS.CLAVES_SOLO_LECTURA },
      };
    case 'fidelizacion': {
      const r = reglas();
      return { status: 200, cuerpo: { ok: true, ruta: 'fidelizacion', reglas: Object.keys(r).map(s => r[s]) } };
    }
    case 'segmentos': {
      const lista = segmentados();
      const r = reglas();
      const conteo = PANEL_DEPS.conteoSegmentos(lista);
      const segmentos = Object.keys(conteo).map(s => ({
        segmento: s, clientes: conteo[s],
        con_permiso_marketing: lista.filter(c => c.segmento === s && c.acepta_marketing === 'SI').length,
        canal: r[s] ? r[s].canal : '', oferta: r[s] ? r[s].oferta : '', activo: r[s] ? r[s].activo : '',
      }));
      return { status: 200, cuerpo: { ok: true, ruta: 'segmentos', total_clientes: lista.length, ultima_sync: config.ultima_sync, segmentos } };
    }
    case 'segmento-clientes': {
      const r = reglas();
      const clientes = segmentados().filter(c => c.segmento === peticion.segmento)
        .sort((a, b) => b.total_comprado - a.total_comprado)
        .slice(0, peticion.limite || 100)
        .map(c => ({ ...clientePanel(c), recomendacion: recomendar(c, r) }));
      return { status: 200, cuerpo: { ok: true, ruta: 'segmento-clientes', segmento: peticion.segmento, total: clientes.length, clientes } };
    }
    case 'recomendacion': {
      const cliente = segmentados().find(c => c.cliente_id.toUpperCase() === String(peticion.cliente_id).toUpperCase());
      if (!cliente) return { status: 404, cuerpo: { ok: false, error: `No hay un cliente ${peticion.cliente_id} en BOT_CLIENTES_FUENTE.` } };
      return { status: 200, cuerpo: { ok: true, ruta: 'recomendacion', cliente: clientePanel(cliente), ...recomendar(cliente, reglas()) } };
    }
    case 'campana-preview': {
      const r = PANEL_DEPS.aQuienLeToca({
        segmento: peticion.segmento, clientes: d.clientesFuente, ventas: d.ventas, productos: d.productos,
        fidelizacion: d.fidelizacion, campanas: d.campanas, config, ahora: ahoraIso,
      });
      if (!r.ok) return { status: r.status, cuerpo: { ok: false, error: r.error } };
      return { status: 200, cuerpo: { ok: true, ruta: 'campana-preview', ...r, total: r.destinatarios.length } };
    }
    case 'audiencia': {
      const a = PANEL_DEPS.audiencia(segmentados(), peticion.segmento);
      // Respuesta de texto: el flujo la devuelve como archivo CSV.
      return { status: 200, csv: a.csv, archivo: `audiencia_${a.segmento.toLowerCase()}.csv`, total: a.total };
    }
    case 'metricas': {
      const metricas = PANEL_DEPS.calcularMetricas({
        config, eventos: d.eventos, solicitudes: d.solicitudes, conversaciones: d.conversaciones, ventas: d.ventas,
        clientesBot: d.clientes, clientesFuente: d.clientesFuente, desde: peticion.desde, hasta: peticion.hasta, ahora: ahoraIso,
      });
      return { status: 200, cuerpo: { ok: true, ruta: 'metricas', ...metricas } };
    }
    default:
      return { status: 404, cuerpo: { ok: false, error: `Ruta sin respuesta de panel: ${peticion.ruta}.` } };
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { responderPanel, cambiosPanel };
