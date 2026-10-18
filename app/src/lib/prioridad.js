import { diasRestantes, formatoSoles, hoyISO } from './format.js';

export const PRIORIDADES = {
  derivado: { texto: 'Derivado', rango: 0 },
  alta: { texto: 'Alta', rango: 0 },
  media: { texto: 'Media', rango: 1 },
  automatico: { texto: 'Automático', rango: 2 },
};

/**
 * Calcula la prioridad con las reglas de /config. Se usa cuando el backend
 * no manda la etiqueta (modo ejemplo o histórico).
 */
export function calcularPrioridad(pedido, config, hoy = hoyISO()) {
  const r = config.reglas;
  const d = config.derivar || {};
  const p = config.prioridad || {};
  const montoAlta = p.peso_valor === false ? Infinity : (p.monto_alta ?? Infinity);
  const cantidad = pedido.cantidad || 0;
  const monto = pedido.monto || 0;
  const flags = pedido.flags || {};
  const esEmpresa = pedido.tipo === 'empresa';

  if (flags.reclamo && d.reclamos) return { prioridad: 'derivado', motivo: 'Reclamo: lo atiende la dueña' };
  if (flags.descuento && d.descuentos) return { prioridad: 'derivado', motivo: 'Pide descuento' };
  if (flags.diseno_especial && d.disenos_especiales) return { prioridad: 'derivado', motivo: 'Diseño especial' };
  if (flags.pide_persona && d.pide_persona) return { prioridad: 'derivado', motivo: 'Pidió hablar con una persona' };
  if (pedido.estado_api === 'derivado') return { prioridad: 'derivado', motivo: pedido.motivo_derivado || 'Marcado como derivado' };
  if (cantidad > r.maximo_sin_derivar) {
    return { prioridad: 'derivado', motivo: `${esEmpresa ? 'Empresa' : 'Persona'} · ${cantidad} u. · más de ${r.maximo_sin_derivar}, lo negocias tú` };
  }
  if (esEmpresa && cantidad > 0 && cantidad < r.minimo_empresa) {
    return { prioridad: 'derivado', motivo: `Empresa · ${cantidad} u. · menos del mínimo (${r.minimo_empresa})` };
  }

  const dias = diasRestantes(pedido.fecha_entrega, hoy);
  const cercana = dias !== null && dias >= 0 && dias <= r.dias_fecha_cercana;
  const valorAlto = monto >= montoAlta;
  const partes = [esEmpresa ? 'Empresa' : 'Persona', `${cantidad} u.`];
  if (valorAlto) partes.push(formatoSoles(monto));
  if (cercana) partes.push(dias === 0 ? 'entrega hoy' : `entrega en ${dias} d`);
  if (pedido.ya_compro_antes) partes.push('ya compró antes');
  const motivo = partes.join(' · ');

  if (esEmpresa) {
    const alta = cantidad >= r.umbral_alta || cercana || pedido.ya_compro_antes || valorAlto;
    return { prioridad: alta ? 'alta' : 'media', motivo };
  }
  if (valorAlto) return { prioridad: 'alta', motivo };
  if (cercana) return { prioridad: 'media', motivo };
  return { prioridad: 'automatico', motivo };
}

/** Añade prioridad, motivo, ganancia y días restantes. Respeta la etiqueta del backend si viene. */
export function enriquecer(pedidos, config, hoy = hoyISO()) {
  const margen = config.prioridad?.margen_estimado ?? 0.5;
  return pedidos.map((p) => {
    const calc = p.prioridad_backend ? { prioridad: p.prioridad_backend, motivo: p.motivo_backend } : calcularPrioridad(p, config, hoy);
    return {
      ...p,
      prioridad: calc.prioridad,
      motivo: calc.motivo,
      ganancia: Math.round((p.monto || 0) * margen),
      dias: diasRestantes(p.fecha_entrega, hoy),
    };
  });
}

const CERRADOS = new Set(['Entregado', 'Enviado']);
export const estaCerrado = (p) => CERRADOS.has(p.estado);

/**
 * Derivado y alta primero, luego media, luego automático; dentro, por fecha y luego por valor.
 * Los pedidos vivos de Mermín van antes que el histórico de la hoja, y lo ya
 * entregado o enviado va al final para no tapar lo que falta atender.
 */
const bloque = (p) => (estaCerrado(p) ? 2 : p.origen === 'historico' ? 1 : 0);
export function ordenarPorPrioridad(pedidos) {
  return [...pedidos].sort((a, b) => {
    const ca = bloque(a);
    const cb = bloque(b);
    if (ca !== cb) return ca - cb;
    const ra = PRIORIDADES[a.prioridad]?.rango ?? 9;
    const rb = PRIORIDADES[b.prioridad]?.rango ?? 9;
    if (ra !== rb) return ra - rb;
    const fa = a.fecha_entrega || '9999';
    const fb = b.fecha_entrega || '9999';
    if (fa !== fb) return fa < fb ? -1 : 1;
    return (b.monto || 0) - (a.monto || 0);
  });
}

/** Valida las reglas de Ajustes. Devuelve un objeto { campo: mensaje }. */
export function validarConfig(c) {
  const e = {};
  const r = c.reglas || {};
  const enteros = ['minimo_empresa', 'umbral_alta', 'maximo_sin_derivar', 'dias_fecha_cercana'];
  for (const k of enteros) {
    if (!Number.isInteger(r[k]) || r[k] <= 0) e[k] = 'Debe ser un número entero mayor que 0';
  }
  if (!e.minimo_empresa && !e.umbral_alta && r.minimo_empresa >= r.umbral_alta) {
    e.umbral_alta = 'Debe ser mayor que el mínimo para empresa';
  }
  if (!e.umbral_alta && !e.maximo_sin_derivar && r.umbral_alta >= r.maximo_sin_derivar) {
    e.maximo_sin_derivar = 'Debe ser mayor que las unidades para prioridad alta';
  }
  if (!e.dias_fecha_cercana && (r.dias_fecha_cercana < 1 || r.dias_fecha_cercana > 60)) {
    e.dias_fecha_cercana = 'Entre 1 y 60 días';
  }
  const nombre = (c.asistente || '').trim();
  if (nombre.length < 1 || nombre.length > 20) e.asistente = 'Entre 1 y 20 caracteres';
  const saludo = (c.textos?.saludo || '').trim();
  if (saludo.length < 1 || saludo.length > 200) e.saludo = 'Entre 1 y 200 caracteres';
  if (!['cercano', 'formal', 'premium'].includes(c.tono)) e.tono = 'Elige un tono';
  const m = c.prioridad?.margen_estimado;
  if (typeof m !== 'number' || m <= 0 || m >= 1) e.margen_estimado = 'Entre 1 % y 99 %';
  const ma = c.prioridad?.monto_alta;
  if (c.prioridad?.peso_valor !== false && (typeof ma !== 'number' || ma <= 0)) e.monto_alta = 'Debe ser un monto mayor que 0';
  if (c.bienvenida?.url_tienda && !/^https?:\/\//.test(c.bienvenida.url_tienda)) e.url_tienda = 'Empieza con https://';
  return e;
}

const RECIEN_LLEGADO_MS = 24 * 60 * 60 * 1000;

/**
 * "Atiende primero": los pedidos de Mermín que acaban de llegar (alta o derivado,
 * sin confirmar, de las últimas 24 h) van arriba, del más nuevo al más antiguo.
 * Después, el resto de lo urgente en el orden por prioridad y fecha.
 * `pedidos` ya viene ordenado con ordenarPorPrioridad.
 */
export function ordenarBandeja(pedidos, limite = 5, ahora = Date.now()) {
  const urgentes = pedidos.filter((p) => ['alta', 'derivado'].includes(p.prioridad)
    && !estaCerrado(p) && p.estado_api !== 'confirmado' && (p.dias === null || p.dias >= 0));
  const esRecien = (p) => p.origen === 'mermin' && p.estado_api === 'nuevo' && p.creado_en
    && ahora - new Date(p.creado_en).getTime() <= RECIEN_LLEGADO_MS;
  const recientes = urgentes.filter(esRecien).sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en));
  const resto = urgentes.filter((p) => !esRecien(p));
  return [...recientes, ...resto].slice(0, limite);
}
