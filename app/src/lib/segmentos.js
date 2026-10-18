// Segmentos de postventa con reglas simples sobre el histórico anonimizado.
// No se segmenta por edad ni generación: no tenemos ese dato ni el consentimiento.
import { diasRestantes, hoyISO, formatoSoles } from './format.js';

export const DIAS_INACTIVO = 60; // [SUPUESTO]

export function agruparClientes(ventas) {
  const mapa = new Map();
  for (const v of ventas) {
    const c = mapa.get(v.cliente) || { alias: v.cliente, pedidos: 0, monto: 0, ultima: null, empresa: false, productos: {} };
    c.pedidos += 1;
    c.monto += v.monto || 0;
    const fecha = v.fecha_pedido || v.fecha_entrega;
    if (fecha && (!c.ultima || fecha > c.ultima)) c.ultima = fecha;
    if (v.tipo === 'empresa') c.empresa = true;
    c.productos[v.producto] = (c.productos[v.producto] || 0) + (v.cantidad || 1);
    mapa.set(v.cliente, c);
  }
  return [...mapa.values()];
}

const DEFINICIONES = [
  {
    id: 'empresas_recurrentes', nombre: 'Empresas recurrentes', descripcion: 'Empresas con 2 o más pedidos.',
    filtro: (c) => c.empresa && c.pedidos >= 2,
    canal: 'WhatsApp directo', campana: 'Mensaje personal de la dueña con el pedido del año pasado listo para repetir.',
  },
  {
    id: 'empresas_un_pedido', nombre: 'Empresas de un solo pedido', descripcion: 'Para reactivar antes de la próxima temporada.',
    filtro: (c) => c.empresa && c.pedidos === 1,
    canal: 'WhatsApp directo', campana: 'Recordatorio de temporada con la propuesta corporativa y el grabado de logo.',
  },
  {
    id: 'personas_recurrentes', nombre: 'Personas recurrentes', descripcion: 'Personas que ya compraron 2 o más veces.',
    filtro: (c) => !c.empresa && c.pedidos >= 2,
    canal: 'Pauta segmentada en Instagram / TikTok + WhatsApp', campana: 'Público personalizado con novedades y fechas especiales.',
  },
  {
    id: 'personas_una_compra', nombre: 'Personas de una sola compra', descripcion: 'Compraron una vez: el reto es la segunda.',
    filtro: (c) => !c.empresa && c.pedidos === 1,
    canal: 'Pauta segmentada en Instagram / TikTok', campana: 'Anuncio de “regalo personalizado” para la próxima fecha especial.',
  },
  {
    id: 'inactivos', nombre: 'Inactivos', descripcion: `Sin compras hace más de ${DIAS_INACTIVO} días.`,
    filtro: (c, hoy) => c.ultima && -diasRestantes(c.ultima, hoy) > DIAS_INACTIVO,
    canal: 'Correo para empresas · pauta para personas', campana: 'Novedades de temporada con fotos de trabajos grabados.',
  },
];

export function calcularSegmentos(ventas, hoy = hoyISO()) {
  const clientes = agruparClientes(ventas);
  return DEFINICIONES.map((d) => {
    const lista = clientes.filter((c) => d.filtro(c, hoy)).sort((a, b) => b.monto - a.monto);
    const productos = {};
    for (const c of lista) for (const [p, n] of Object.entries(c.productos)) productos[p] = (productos[p] || 0) + n;
    return {
      id: d.id, nombre: d.nombre, descripcion: d.descripcion, canal: d.canal, campana: d.campana,
      tamano: lista.length,
      monto: lista.reduce((a, c) => a + c.monto, 0),
      ultima: lista.reduce((a, c) => (c.ultima && (!a || c.ultima > a) ? c.ultima : a), null),
      top_productos: Object.entries(productos).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([nombre, unidades]) => ({ nombre, unidades })),
      clientes: lista.map(({ alias, pedidos, monto, ultima }) => ({ alias, pedidos, monto, ultima })),
    };
  });
}

// Complementos por familia de producto (catálogo de ITS WOOD).
const COMPLEMENTOS = [
  [/tabla|quesera/i, 'Tablas', 'Cuchillo para queso o Toppers para copas'],
  [/posa ?cel|posacelular/i, 'Posacelulares', 'Dock 3 en 1 o Soporte para laptop'],
  [/cruz|bendici|sacramento/i, 'Cruces y recuerdos', 'Portavelas de madera'],
  [/vela|incienso/i, 'Portavelas', 'Cruz bendición de puerta o Portaincienso'],
  [/posa ?taza|posataza|posavaso/i, 'Posatazas', 'Box de posataza con taza'],
  [/retrato|joyero|espejo/i, 'Portarretratos y joyeros', 'Joyero corazón o Espejo Aura'],
  [/picnic|copas|vino/i, 'Mesas de picnic', 'Toppers para copas o Portacorchos'],
  [/dock|laptop|ecodesk|reloj/i, 'Escritorio', 'Porta post-it o Posacelular con logo'],
];

const CANALES = { empresas_recurrentes: 'whatsapp', empresas_un_pedido: 'whatsapp', personas_recurrentes: 'pauta', personas_una_compra: 'pauta', inactivos: 'correo' };
export const canalCorto = (id) => CANALES[id] || 'whatsapp';

/** Mismas reglas que GET /segmentos/{id}/recomendaciones, para el modo ejemplo. */
export function recomendaciones(seg, negocio = 'ITS WOOD') {
  const r = [];
  const top = seg.top_productos[0]?.nombre;
  const esEmpresa = seg.id.startsWith('empresas') || seg.id === 'inactivos';
  if (esEmpresa && top) {
    r.push({ titulo: `Escríbeles 3 semanas antes de Navidad con ${top}`, motivo: `Es lo que más compró este segmento (${seg.top_productos[0].unidades} u.). Llegar antes que la competencia asegura el pedido de fin de año.` });
  }
  if (seg.id.endsWith('recurrentes')) {
    r.push({ titulo: 'Ofrece repetir el pedido anterior con un clic', motivo: `Estos ${seg.tamano} clientes ya compraron 2 o más veces: repetir es más fácil que decidir de cero.` });
  }
  const comp = top && COMPLEMENTOS.find(([re]) => re.test(top));
  if (comp) {
    r.push({ titulo: `Sugiere el complemento: compró ${comp[1]} → ofrece ${comp[2]}`, motivo: `${top} es su producto principal; el complemento sube el ticket sin bajar precio.` });
  }
  if (seg.id === 'personas_una_compra') {
    r.push({ titulo: 'Pide una foto del regalo y ofrece grabar la próxima fecha especial', motivo: 'La segunda compra llega cuando el cliente recuerda la experiencia; la foto también sirve para redes.' });
  }
  if (seg.id === 'inactivos') {
    r.push({ titulo: 'Reactívalos con lo nuevo de temporada, no con descuento', motivo: `No compran hace más de ${DIAS_INACTIVO} días. ${negocio} es premium: la novedad y la personalización valen más que una rebaja.` });
  }
  if (seg.id === 'empresas_un_pedido') {
    r.push({ titulo: 'Manda una propuesta corporativa armada con su logo', motivo: `Compraron una vez (${formatoSoles(seg.monto / Math.max(seg.tamano, 1))} en promedio): una propuesta lista reduce el esfuerzo de volver a pedir.` });
  }
  return r;
}

export function borradores(seg, negocio = 'ITS WOOD') {
  const top = seg.top_productos[0]?.nombre || 'tu pedido';
  const empresa = seg.id.startsWith('empresas') || seg.id === 'inactivos';
  const principal = empresa
    ? `Hola [nombre], te saluda ${negocio}. Se acerca fin de año y queríamos ofrecerte repetir tu pedido de ${top}, con el grabado de tu logo. ¿Te armo una propuesta para tu equipo?`
    : `Hola [nombre], te saluda ${negocio}. ¿Se viene alguna fecha especial? Podemos grabar un regalo único como tu ${top}. Te paso ideas cuando quieras.`;
  return {
    principal,
    secuencia: [
      { paso: 'Gracias', cuando: '1 día después de la entrega', texto: `¡Gracias por elegir ${negocio}, [nombre]! Esperamos que tu ${top} haya llegado perfecto.` },
      { paso: '¿Cómo te fue?', cuando: '1 semana después', texto: `Hola [nombre], ¿qué tal les pareció el regalo? Si tienes una foto, nos encantaría verla.` },
      { paso: 'Próxima ocasión', cuando: '3 semanas antes de la siguiente fecha', texto: empresa ? `Hola [nombre], ya estamos tomando pedidos corporativos para fin de año. ¿Repetimos con tu logo?` : `Hola [nombre], se acerca una fecha especial. ¿Te ayudamos con un regalo grabado?` },
    ],
  };
}
