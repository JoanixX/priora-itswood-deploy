// Convierte las ventas anonimizadas y los pedidos de Mermín a una sola forma
// para la tabla de Pedidos.

const ESTADOS_MERMIN = { nuevo: 'Nuevo', derivado: 'Derivado', confirmado: 'Confirmado' };

export function ventasAPedidos(ventas) {
  const vistos = new Set();
  const ordenadas = [...ventas].sort((a, b) => (a.fecha_pedido || '0').localeCompare(b.fecha_pedido || '0'));
  const yaCompro = new Map();
  for (const v of ordenadas) {
    yaCompro.set(v.id, vistos.has(v.cliente));
    vistos.add(v.cliente);
  }
  return ventas.map((v) => ({
    id: v.id,
    origen: 'historico',
    cliente: v.cliente,
    tipo: v.tipo,
    ya_compro_antes: yaCompro.get(v.id),
    producto: v.producto,
    cantidad: v.cantidad || 0,
    monto: v.monto,
    fecha_pedido: v.fecha_pedido,
    fecha_entrega: v.fecha_entrega,
    canal: v.plataforma,
    estado: v.estado,
    personalizacion: v.grabado ? 'Sí (grabado)' : null,
  }));
}

/** Pedido del contrato (/pedidos) → forma de la tabla. */
export function pedidoMermin(p, { desdeBackend = false } = {}) {
  const productos = p.productos || [];
  const monto = p.monto ?? productos.reduce((a, x) => a + x.cantidad * x.precio_unitario, 0);
  return {
    id: p.id,
    origen: 'mermin',
    ejemplo: Boolean(p.ejemplo),
    cliente: p.cliente?.empresa || p.cliente?.nombre || 'Cliente',
    contacto: p.cliente?.nombre || null,
    tipo: p.cliente?.tipo || 'persona',
    ya_compro_antes: Boolean(p.cliente?.ya_compro_antes),
    producto: productos.map((x) => x.nombre).join(', ') || '—',
    productos,
    cantidad: p.cantidad_total ?? productos.reduce((a, x) => a + x.cantidad, 0),
    monto,
    fecha_pedido: (p.creado_en || '').slice(0, 10) || null,
    creado_en: p.creado_en,
    fecha_entrega: p.fecha_requerida || null,
    canal: 'WhatsApp',
    estado: ESTADOS_MERMIN[p.estado] || p.estado || 'Nuevo',
    estado_api: p.estado,
    ocasion: p.ocasion || null,
    personalizacion: p.personalizacion || null,
    resumen: p.resumen || null,
    flags: p.flags || null,
    prioridad_backend: desdeBackend ? p.prioridad || null : null,
    motivo_backend: p.motivo_prioridad || null,
  };
}
