// Las 5 métricas y los 3 gráficos de Inicio, calculados sobre el histórico
// anonimizado. Período: 'todo' o 'aaaa-mm' (agrupa por fecha de pedido).

export function filtrarPeriodo(ventas, periodo) {
  if (!periodo || periodo === 'todo') return ventas;
  return ventas.filter((v) => (v.fecha_pedido || '').startsWith(periodo));
}

const suma = (arr) => arr.reduce((a, v) => a + (v.monto || 0), 0);
const promedio = (arr) => {
  const conMonto = arr.filter((v) => v.monto > 0);
  return conMonto.length ? suma(conMonto) / conMonto.length : null;
};

export function mesesDisponibles(ventas) {
  return [...new Set(ventas.map((v) => (v.fecha_pedido || '').slice(0, 7)).filter(Boolean))].sort();
}

export function esCorporativo(v, minimo = 12) {
  return v.tipo === 'empresa' || (v.cantidad || 0) >= minimo;
}

export function calcularMetricas(todas, periodo = 'todo', minimoEmpresa = 12) {
  const ventas = filtrarPeriodo(todas, periodo);
  const total = suma(ventas);
  const empresa = ventas.filter((v) => v.tipo === 'empresa');
  const persona = ventas.filter((v) => v.tipo === 'persona');
  const grandes = ventas.filter((v) => (v.cantidad || 0) >= minimoEmpresa);

  const porCliente = new Map();
  for (const v of ventas) porCliente.set(v.cliente, (porCliente.get(v.cliente) || 0) + 1);

  const meses = mesesDisponibles(todas);
  const corporativosPorMes = meses.map((mes) => ({
    mes,
    pedidos: todas.filter((v) => (v.fecha_pedido || '').startsWith(mes) && esCorporativo(v, minimoEmpresa)).length,
  }));
  const ventasPorMes = meses.map((mes) => ({
    mes,
    monto: suma(todas.filter((v) => (v.fecha_pedido || '').startsWith(mes))),
  }));

  const grupos = { WhatsApp: 'WhatsApp', Pauta: 'Pautas', TikTok: 'Redes', Instagram: 'Redes', Web: 'Web' };
  const canales = {};
  for (const v of ventas) {
    const g = grupos[v.plataforma] || 'Otros';
    canales[g] = (canales[g] || 0) + v.monto;
  }
  const porCanal = ['WhatsApp', 'Pautas', 'Redes', 'Web', 'Otros']
    .map((canal) => ({ canal, monto: canales[canal] || 0, pct: total ? (canales[canal] || 0) / total : 0 }));

  const corporativosPeriodo = ventas.filter((v) => esCorporativo(v, minimoEmpresa)).length;
  const mesesEnPeriodo = periodo === 'todo' ? meses.length : 1;

  return {
    registros: ventas.length,
    total,
    pctGrandes: total ? suma(grandes) / total : 0,
    montoGrandes: suma(grandes),
    montoChicos: total - suma(grandes),
    pedidosGrandes: grandes.length,
    ticket: promedio(ventas),
    ticketEmpresa: promedio(empresa),
    ticketPersona: promedio(persona),
    clientes: porCliente.size,
    recurrentes: [...porCliente.values()].filter((n) => n >= 2).length,
    corporativosMes: mesesEnPeriodo ? corporativosPeriodo / mesesEnPeriodo : 0,
    corporativosPorMes,
    ventasPorMes,
    porCanal,
  };
}
