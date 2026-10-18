// Segmentos de postventa y recomendaciones: las mismas reglas que app/src/lib/segmentos.js (los ids coinciden, la
// app junta el resumen del backend con su lista local por id). Sobre las ventas de la pestaña Ventas: el histórico
// de ejemplo o la hoja de ventas que conecte la dueña en Datos. Sin edad ni generación.
import { diasRestantes, hoyISO, formatoSoles } from './formato.js';

export const DIAS_INACTIVO = 60; // [SUPUESTO]

export function agruparClientes(ventas) {
  const mapa = new Map();
  for (const v of ventas) {
    if (!v.cliente) continue;
    const c = mapa.get(v.cliente) || { alias: v.cliente, pedidos: 0, monto: 0, ultima: null, empresa: false, productos: {} };
    c.pedidos += 1;
    c.monto += Number(v.monto) || 0;
    const fecha = v.fecha_pedido || v.fecha_entrega;
    if (fecha && (!c.ultima || fecha > c.ultima)) c.ultima = fecha;
    if (v.tipo === 'empresa') c.empresa = true;
    c.productos[v.producto] = (c.productos[v.producto] || 0) + (Number(v.cantidad) || 1);
    mapa.set(v.cliente, c);
  }
  return [...mapa.values()];
}

const DEFINICIONES = [
  { id: 'empresas_recurrentes', nombre: 'Empresas recurrentes', filtro: (c) => c.empresa && c.pedidos >= 2 },
  { id: 'empresas_un_pedido', nombre: 'Empresas de un solo pedido', filtro: (c) => c.empresa && c.pedidos === 1 },
  { id: 'personas_recurrentes', nombre: 'Personas recurrentes', filtro: (c) => !c.empresa && c.pedidos >= 2 },
  { id: 'personas_una_compra', nombre: 'Personas de una sola compra', filtro: (c) => !c.empresa && c.pedidos === 1 },
  { id: 'inactivos', nombre: 'Inactivos', filtro: (c, hoy) => c.ultima && -diasRestantes(c.ultima, hoy) > DIAS_INACTIVO },
];
export const IDS_SEGMENTOS = DEFINICIONES.map((d) => d.id);

export function calcularSegmentos(ventas, hoy = hoyISO()) {
  const clientes = agruparClientes(ventas);
  return DEFINICIONES.map((d) => {
    const lista = clientes.filter((c) => d.filtro(c, hoy)).sort((a, b) => b.monto - a.monto);
    const productos = {};
    for (const c of lista) for (const [p, n] of Object.entries(c.productos)) productos[p] = (productos[p] || 0) + n;
    return {
      id: d.id, nombre: d.nombre, tamano: lista.length,
      monto: Math.round(lista.reduce((a, c) => a + c.monto, 0) * 100) / 100,
      ultima: lista.reduce((a, c) => (c.ultima && (!a || c.ultima > a) ? c.ultima : a), null),
      top_productos: Object.entries(productos).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([nombre, unidades]) => ({ nombre, unidades })),
      lista_clientes: lista.map(({ alias, pedidos, monto, ultima }) => ({ alias, pedidos, monto, ultima })),
    };
  });
}

/** GET /segmentos: resumen del contrato (más lista_clientes y top_productos para actualizar Fidelización al sincronizar). */
export const resumenSegmentos = (ventas) => calcularSegmentos(ventas).map((s) => ({
  id: s.id, nombre: s.nombre, clientes: s.tamano, monto: s.monto, ultima_compra: s.ultima,
  lista_clientes: s.lista_clientes, top_productos: s.top_productos,
}));

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

function recomendaciones(seg, negocio) {
  const r = [];
  const top = seg.top_productos[0]?.nombre;
  const esEmpresa = seg.id.startsWith('empresas') || seg.id === 'inactivos';
  if (esEmpresa && top) r.push({ titulo: `Escríbeles 3 semanas antes de Navidad con ${top}`, motivo: `Es lo que más compró este segmento (${seg.top_productos[0].unidades} u.). Llegar antes que la competencia asegura el pedido de fin de año.` });
  if (seg.id.endsWith('recurrentes')) r.push({ titulo: 'Ofrece repetir el pedido anterior con un clic', motivo: `Estos ${seg.tamano} clientes ya compraron 2 o más veces: repetir es más fácil que decidir de cero.` });
  const comp = top && COMPLEMENTOS.find(([re]) => re.test(top));
  if (comp) r.push({ titulo: `Sugiere el complemento: compró ${comp[1]} → ofrece ${comp[2]}`, motivo: `${top} es su producto principal; el complemento sube el ticket sin bajar precio.` });
  if (seg.id === 'personas_una_compra') r.push({ titulo: 'Pide una foto del regalo y ofrece grabar la próxima fecha especial', motivo: 'La segunda compra llega cuando el cliente recuerda la experiencia; la foto también sirve para redes.' });
  if (seg.id === 'inactivos') r.push({ titulo: 'Reactívalos con lo nuevo de temporada, no con descuento', motivo: `No compran hace más de ${DIAS_INACTIVO} días. ${negocio} es premium: la novedad y la personalización valen más que una rebaja.` });
  if (seg.id === 'empresas_un_pedido') r.push({ titulo: 'Manda una propuesta corporativa armada con su logo', motivo: `Compraron una vez (${formatoSoles(seg.monto / Math.max(seg.tamano, 1))} en promedio): una propuesta lista reduce el esfuerzo de volver a pedir.` });
  return r;
}

function borradores(seg, negocio) {
  const top = seg.top_productos[0]?.nombre || 'tu pedido';
  const empresa = seg.id.startsWith('empresas') || seg.id === 'inactivos';
  return {
    principal: empresa
      ? `Hola [nombre], te saluda ${negocio}. Se acerca fin de año y queríamos ofrecerte repetir tu pedido de ${top}, con el grabado de tu logo. ¿Te armo una propuesta para tu equipo?`
      : `Hola [nombre], te saluda ${negocio}. ¿Se viene alguna fecha especial? Podemos grabar un regalo único como tu ${top}. Te paso ideas cuando quieras.`,
    secuencia: [
      `¡Gracias por elegir ${negocio}, [nombre]! Esperamos que tu ${top} haya llegado perfecto.`,
      'Hola [nombre], ¿qué tal les pareció el regalo? Si tienes una foto, nos encantaría verla.',
      empresa ? 'Hola [nombre], ya estamos tomando pedidos corporativos para fin de año. ¿Repetimos con tu logo?' : 'Hola [nombre], se acerca una fecha especial. ¿Te ayudamos con un regalo grabado?',
    ],
  };
}

/** GET /segmentos/{id}/recomendaciones. null si el segmento no existe. Solo sugiere: no envía nada. */
export function recomendacionesDe(ventas, id, negocio = 'ITS WOOD') {
  const seg = calcularSegmentos(ventas).find((s) => s.id === id);
  if (!seg) return null;
  const b = borradores(seg, negocio);
  return {
    segmento: id,
    recomendaciones: recomendaciones(seg, negocio).map((r) => ({ ...r, canal: CANALES[id] || 'whatsapp', mensaje_borrador: b.principal })),
    secuencia_postventa: b.secuencia,
  };
}
