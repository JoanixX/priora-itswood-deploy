// GET /metricas?periodo=2026-09 (un mes) o periodo=2026 (todo el año). Forma de docs/API_CONTRATO.md.
// Tiempo de respuesta y conversión salen de las conversaciones de Mermín; el resto, de Ventas y Pedidos.

export function validarPeriodo(periodo) {
  const p = String(periodo || '').trim() || String(new Date().getFullYear());
  return /^\d{4}(-\d{2})?$/.test(p) ? p : null;
}

const enPeriodo = (fecha, periodo) => Boolean(fecha) && String(fecha).startsWith(periodo);
const redondeo = (n, d = 1) => (n === null ? null : Math.round(n * 10 ** d) / 10 ** d);
const promedio = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const fechaLocal = (iso) => (iso ? new Date(iso).toLocaleDateString('en-CA') : null);

export function calcularMetricas(datos, periodo) {
  const { conversaciones, pedidos, ventas, clientes, config } = datos;
  const convs = conversaciones.filter((c) => c.inicio && enPeriodo(fechaLocal(new Date(Number(c.inicio)).toISOString()), periodo));
  const tiempos = convs.map((c) => c.primera_respuesta_seg).filter((x) => typeof x === 'number');
  const conPedido = convs.filter((c) => c.pedido_id).length;

  // Pedidos corporativos por mes: ventas de empresa + pedidos de empresa de Mermín.
  const porMes = {};
  for (const v of ventas) if (v.tipo === 'empresa' && v.fecha_pedido && enPeriodo(v.fecha_pedido, periodo.slice(0, 4))) porMes[v.fecha_pedido.slice(0, 7)] = (porMes[v.fecha_pedido.slice(0, 7)] || 0) + 1;
  for (const p of pedidos) {
    const mes = fechaLocal(p.creado_en)?.slice(0, 7);
    if (!p.ejemplo && p.cliente?.tipo === 'empresa' && mes && enPeriodo(mes, periodo.slice(0, 4))) porMes[mes] = (porMes[mes] || 0) + 1;
  }
  // Con un mes se muestran los meses del año hasta ese mes (para comparar); con un año, todos.
  const meses = Object.keys(porMes).sort().filter((m) => periodo.length === 4 || m <= periodo);

  const vendidas = ventas.filter((v) => enPeriodo(v.fecha_pedido, periodo) && Number(v.monto) > 0);
  const ticket = (lista) => redondeo(promedio(lista.map((v) => Number(v.monto))), 0);
  const nombres = new Set([...ventas.map((v) => v.cliente), ...clientes.map((c) => c.empresa || c.nombre)].filter(Boolean));
  const compras = {};
  for (const v of ventas) if (v.cliente) compras[v.cliente] = (compras[v.cliente] || 0) + 1;

  return {
    periodo,
    tiempo_primera_respuesta: {
      antes_min: config.metricas?.tiempo_respuesta_antes_min ?? null,
      despues_min: tiempos.length ? redondeo(promedio(tiempos) / 60, 2) : null,
      fuente: 'registros de Mermín',
    },
    conversion_consultas: { consultas: convs.length, pedidos: conPedido, porcentaje: convs.length ? redondeo((conPedido / convs.length) * 100) : null },
    pedidos_corporativos_mes: meses.map((mes) => ({ mes, pedidos: porMes[mes] })),
    ticket_promedio: {
      total: ticket(vendidas),
      empresa: ticket(vendidas.filter((v) => v.tipo === 'empresa')),
      persona: ticket(vendidas.filter((v) => v.tipo !== 'empresa')),
    },
    clientes_registrados: { total: nombres.size, recurrentes: Object.values(compras).filter((n) => n >= 2).length },
  };
}
