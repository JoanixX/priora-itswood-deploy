// Reglas de prioridad del contrato (docs/API_CONTRATO.md), iguales a app/src/lib/prioridad.js: el tablero muestra
// lo mismo venga la etiqueta del backend o la calcule la app.
import { diasRestantes, formatoSoles, hoyISO } from './formato.js';

const RANGO = { derivado: 0, alta: 0, media: 1, automatico: 2 };

/** pedido: { tipo, cantidad, monto, fecha_entrega, ya_compro_antes, flags, estado } */
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
  if (pedido.estado === 'derivado') return { prioridad: 'derivado', motivo: 'Marcado como derivado' };
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
  if (esEmpresa) return { prioridad: cantidad >= r.umbral_alta || cercana || pedido.ya_compro_antes || valorAlto ? 'alta' : 'media', motivo };
  if (valorAlto) return { prioridad: 'alta', motivo };
  if (cercana) return { prioridad: 'media', motivo };
  return { prioridad: 'automatico', motivo };
}

export const montoPedido = (p) => (p.productos || []).reduce((a, x) => a + (x.cantidad || 0) * (x.precio_unitario || 0), 0);

/** Pedido guardado → Pedido del contrato con prioridad recalculada con la config actual. */
export function conPrioridad(p, config, hoy = hoyISO()) {
  const { prioridad, motivo } = calcularPrioridad({
    tipo: p.cliente?.tipo, cantidad: p.cantidad_total, monto: montoPedido(p), fecha_entrega: p.fecha_requerida,
    ya_compro_antes: p.cliente?.ya_compro_antes, flags: p.flags, estado: p.estado,
  }, config, hoy);
  return { ...p, prioridad, motivo_prioridad: motivo, monto: montoPedido(p) };
}

/** Derivado y alta primero, luego media, luego automático; dentro, por fecha_requerida ascendente. */
export function ordenar(pedidos) {
  return [...pedidos].sort((a, b) => {
    const ra = RANGO[a.prioridad] ?? 9;
    const rb = RANGO[b.prioridad] ?? 9;
    if (ra !== rb) return ra - rb;
    const fa = a.fecha_requerida || '9999';
    const fb = b.fecha_requerida || '9999';
    if (fa !== fb) return fa < fb ? -1 : 1;
    return (b.monto || 0) - (a.monto || 0);
  });
}
