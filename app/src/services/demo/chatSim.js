// Chat guiado de Mermín para el modo ejemplo. Responde con la misma forma que
// POST /chat y agrega `borrador` (el pedido armándose), que es una propuesta del frontend.
import { demo, agregarNotificacion } from './store.js';
import { crearPedidoDemo } from '../pedidos.js';
import { calcularPrioridad } from '../../lib/prioridad.js';
import { formatoSoles, hoyISO, sumarDias, formatoFecha } from '../../lib/format.js';

const WEB_TIENDA = import.meta.env.VITE_WEB_TIENDA_URL || 'https://itswood.pe';
const conversaciones = new Map();

const SUGERIDOS = {
  empresa: ['PR-4D655976', 'PR-43BDD2E6', 'PR-4B75357B'],
  empresaNavidad: ['PR-48A95AE5', 'PR-42A68EA5', 'PR-4D655976'],
  persona: ['PR-4257E8A7', 'PR-496A7867', 'PR-4BD3A29A'],
};

const frase = (tono) => ({
  cercano: { ok: '¡Genial!', eleccion: '¡Buena elección!', listo: '¡Listo! 🙌', gracias: '¡Gracias!' },
  formal: { ok: 'Perfecto.', eleccion: 'Muy bien.', listo: 'Listo.', gracias: 'Muchas gracias.' },
  premium: { ok: 'Con gusto.', eleccion: 'Excelente elección.', listo: 'Todo listo ✨', gracias: 'Gracias por elegirnos.' },
}[tono] || { ok: '¡Perfecto!', eleccion: '¡Buena elección!', listo: '¡Listo!', gracias: '¡Gracias!' });

const producto = (id) => demo.catalogo.find((p) => p.id === id);
const boton = (id, texto) => ({ id, texto });

export function mensajeBienvenida(config) {
  const b = config.bienvenida || {};
  return {
    texto: `${config.textos.saludo} ${b.mensaje || ''}`.trim(),
    enlace: { url: b.url_tienda || WEB_TIENDA, texto: b.texto_boton || 'Ir a la tienda' },
    promo: b.promo_activa && b.promo_texto ? b.promo_texto : null,
  };
}

const preguntaInicial = () => ({
  texto: '¿En qué te ayudo hoy?',
  botones: [boton('empresa', 'Regalos para empresa'), boton('persona', 'Regalo personal'), boton('duena', 'Hablar con la dueña')],
});

function nuevaConversacion() {
  const id = `c-demo-${Date.now().toString(36)}`;
  const conv = {
    id, paso: 'inicio', inicio: null, primera_respuesta_seg: null, pedido_id: null,
    borrador: { tipo: null, ocasion: null, cantidad: null, fecha_requerida: null, productos: [], personalizacion: null, cliente: null, flags: {} },
  };
  conversaciones.set(id, conv);
  demo.conversaciones.push(conv);
  return conv;
}

function numero(texto) {
  const m = String(texto || '').match(/\d+/);
  return m ? Number(m[0]) : null;
}

function fechaDesde(textoOBoton) {
  const hoy = hoyISO();
  const t = String(textoOBoton || '').toLowerCase();
  if (t === 'f2s' || t.includes('2 semanas')) return sumarDias(hoy, 14);
  if (t === 'f1m' || t.includes('1 mes') || t.includes('un mes')) return sumarDias(hoy, 30);
  if (t === 'fnav' || t.includes('navidad')) return `${hoy.slice(0, 4)}-12-15`;
  const m = t.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
  if (m) {
    const anio = m[3] || hoy.slice(0, 4);
    const iso = `${anio}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return iso < hoy ? `${Number(anio) + 1}${iso.slice(4)}` : iso;
  }
  return null;
}

function resumen(b) {
  const total = b.productos.reduce((a, p) => a + p.cantidad * p.precio_unitario, 0);
  const lineas = b.productos.map((p) => `${p.cantidad} × ${p.nombre}: ${formatoSoles(p.cantidad * p.precio_unitario)}`);
  return [
    `Ocasión: ${b.ocasion}`,
    ...lineas,
    `Entrega: ${formatoFecha(b.fecha_requerida)}`,
    `Personalización: ${b.personalizacion || 'No'}`,
    `Total referencial: ${formatoSoles(total)} (sin delivery)`,
  ].join('\n');
}

function derivar(conv, config, motivo, titulo) {
  conv.paso = 'derivado';
  if (config.notificaciones?.pedido_derivado !== false) {
    agregarNotificacion({ tipo: 'pedido_derivado', titulo, texto: motivo, enlace: '/app/pedidos' });
  }
  return [{ texto: `Entiendo. Le paso tu caso a la dueña de ${config.negocio} y te escribe muy pronto por aquí. ${frase(config.tono).gracias}` }];
}

function cerrarPedido(conv, config) {
  const b = conv.borrador;
  const esEmpresa = b.tipo === 'empresa';
  const pedido = crearPedidoDemo({
    cliente: { nombre: esEmpresa ? null : b.cliente, empresa: esEmpresa ? b.cliente : null, tipo: b.tipo, ya_compro_antes: false },
    ocasion: b.ocasion,
    cantidad_total: b.cantidad,
    fecha_requerida: b.fecha_requerida,
    productos: b.productos,
    personalizacion: b.personalizacion,
    flags: b.flags,
    resumen: `Pedido cerrado por ${config.asistente}: ${b.cantidad} × ${b.productos[0]?.nombre} para ${b.ocasion}.`,
  });
  conv.pedido_id = pedido.id;
  conv.paso = 'cerrado';
  const monto = b.productos.reduce((a, p) => a + p.cantidad * p.precio_unitario, 0);
  const { prioridad, motivo } = calcularPrioridad({ ...b, monto, cantidad: b.cantidad, fecha_entrega: b.fecha_requerida }, config);
  conv.prioridad = { prioridad, motivo };

  const aviso = {
    alta: { tipo: 'pedido_alta', titulo: 'Nuevo pedido de prioridad alta', activo: config.notificaciones?.pedido_alta !== false },
    derivado: { tipo: 'pedido_derivado', titulo: 'Pedido derivado: lo negocias tú', activo: config.notificaciones?.pedido_derivado !== false },
  }[prioridad] || { tipo: 'pedido', titulo: `Nuevo pedido resuelto por ${config.asistente}`, activo: true };
  if (aviso.activo) {
    agregarNotificacion({ tipo: aviso.tipo, titulo: aviso.titulo, texto: `${b.cliente} · ${b.cantidad} u. · ${formatoSoles(monto)}`, enlace: `/app/pedidos?id=${pedido.id}` });
  }

  const f = frase(config.tono);
  const cierre = prioridad === 'derivado'
    ? `${f.listo} Registré tu pedido. Por el volumen, la dueña te escribe hoy con una propuesta a medida.`
    : `${f.listo} Tu pedido quedó registrado. La dueña lo confirma y te escribe con el pago y la entrega.`;
  return [{ texto: cierre }];
}

/** Lógica del flujo guiado. Devuelve los mensajes de Mermín. */
function avanzar(conv, entrada, config) {
  const b = conv.borrador;
  const texto = (entrada.texto || '').trim();
  const id = entrada.boton_id;
  const t = texto.toLowerCase();
  const f = frase(config.tono);

  // Reglas de derivación que aplican en cualquier paso.
  if (/reclamo|llegó (roto|mal|rayad)|queja|devoluci/.test(t) && config.derivar.reclamos) {
    b.flags.reclamo = true;
    return derivar(conv, config, `Reclamo: “${texto.slice(0, 60)}”`, 'Pedido derivado: reclamo');
  }
  if (/descuento|rebaja|precio especial/.test(t) && config.derivar.descuentos) {
    b.flags.descuento = true;
    return derivar(conv, config, 'Pide descuento', 'Consulta derivada: descuento');
  }
  if (id === 'duena' || (/hablar con|persona real|humano|la dueña/.test(t) && config.derivar.pide_persona)) {
    b.flags.pide_persona = true;
    return derivar(conv, config, 'Pidió hablar con una persona', 'Pidió hablar contigo');
  }

  switch (conv.paso) {
    case 'inicio': {
      const tipo = id === 'empresa' || /empresa|equipo|colaborador|corporativ/.test(t) ? 'empresa'
        : id === 'persona' || /regalo|cumple|mamá|novi/.test(t) ? 'persona' : null;
      if (!tipo) return [config.textos.no_sabe ? { texto: config.textos.no_sabe } : null, preguntaInicial()].filter(Boolean);
      b.tipo = tipo;
      conv.paso = 'ocasion';
      return [{
        texto: tipo === 'empresa' ? `${f.ok} ¿Para qué ocasión son los regalos?` : `${f.ok} ¿Para qué ocasión es el regalo?`,
        botones: tipo === 'empresa'
          ? [boton('Navidad', 'Navidad'), boton('Aniversario', 'Aniversario'), boton('Bienvenida', 'Bienvenida de equipo')]
          : [boton('Cumpleaños', 'Cumpleaños'), boton('Aniversario', 'Aniversario'), boton('Día de la madre', 'Día de la madre')],
      }];
    }
    case 'ocasion': {
      b.ocasion = id || texto || 'Otra';
      conv.paso = 'cantidad';
      return [{
        texto: '¿Cuántas unidades necesitas?',
        botones: b.tipo === 'empresa' ? [boton('12', '12'), boton('30', '30'), boton('50', '50')] : [boton('1', '1'), boton('2', '2'), boton('5', '5')],
      }];
    }
    case 'cantidad': {
      const n = numero(id || texto);
      if (!n) return [{ texto: 'No entendí la cantidad. Escríbeme solo el número, por ejemplo 30.' }];
      b.cantidad = n;
      if (n >= config.reglas.minimo_empresa) b.tipo = 'empresa';
      conv.paso = 'fecha';
      const extra = n > config.reglas.maximo_sin_derivar ? ` Para más de ${config.reglas.maximo_sin_derivar} unidades la dueña te arma una propuesta; igual tomo tus datos.` : '';
      return [{ texto: `${n} unidades, anotado.${extra} ¿Para qué fecha los necesitas?`, botones: [boton('f2s', 'En 2 semanas'), boton('f1m', 'En 1 mes'), boton('fnav', 'Para Navidad (15 dic)')] }];
    }
    case 'fecha': {
      const fecha = fechaDesde(id || texto);
      if (!fecha) return [{ texto: 'Dime la fecha como día/mes, por ejemplo 15/12.' }];
      b.fecha_requerida = fecha;
      conv.paso = 'producto';
      const lista = b.tipo === 'empresa' ? (/navidad/i.test(b.ocasion) ? SUGERIDOS.empresaNavidad : SUGERIDOS.empresa) : SUGERIDOS.persona;
      return [{
        texto: `Para ${formatoFecha(fecha)} te recomiendo estos. Precios por unidad:`,
        botones: lista.map(producto).filter(Boolean).map((p) => boton(`prod:${p.id}`, `${p.nombre} · ${formatoSoles(p.precio)}`)),
      }];
    }
    case 'producto': {
      let p = id?.startsWith('prod:') ? producto(id.slice(5)) : null;
      if (!p && texto) p = demo.catalogo.find((x) => x.nombre.toLowerCase().includes(t));
      if (!p) return [{ texto: 'No encontré ese producto. Elige uno de la lista o mira el catálogo en la web.' }];
      b.productos = [{ producto_id: p.id, nombre: p.nombre, cantidad: b.cantidad, precio_unitario: p.precio }];
      conv.paso = 'personalizacion';
      const stock = p.stock !== null && p.stock < b.cantidad ? ` Ojo: hoy quedan ${p.stock} en stock; la dueña confirma el plazo.` : '';
      return [{ texto: `${f.eleccion} ${p.nombre}.${stock} ¿Lo quieres personalizado con grabado?`, botones: [boton('si', 'Sí, con grabado'), boton('no', 'No, así está bien')] }];
    }
    case 'personalizacion': {
      if (id === 'no' || /^no\b/.test(t)) {
        b.personalizacion = null;
        conv.paso = 'nombre';
        return [{ texto: b.tipo === 'empresa' ? '¿A nombre de qué empresa va el pedido?' : '¿A nombre de quién va el pedido?' }];
      }
      if (id === 'si' || /^s[ií]\b/.test(t)) {
        conv.paso = 'grabado';
        return [{ texto: '¿Qué va grabado? Puede ser un nombre, una frase o el logo de la empresa.' }];
      }
      conv.paso = 'grabado';
      return avanzar(conv, entrada, config);
    }
    case 'grabado': {
      b.personalizacion = texto || 'Sí';
      if (/diseño (especial|propio)|ilustraci/.test(t)) b.flags.diseno_especial = true;
      conv.paso = 'nombre';
      return [{ texto: b.tipo === 'empresa' ? `Anotado. ¿A nombre de qué empresa va el pedido?` : 'Anotado. ¿A nombre de quién va el pedido?' }];
    }
    case 'nombre': {
      b.cliente = texto || 'Cliente';
      conv.paso = 'confirmar';
      return [{ texto: `Este es tu pedido:\n${resumen(b)}\n¿Lo confirmo?`, botones: [boton('confirmar', 'Confirmar pedido'), boton('cambiar', 'Cambiar algo')] }];
    }
    case 'confirmar': {
      if (id === 'cambiar' || /cambiar/.test(t)) {
        conv.paso = 'inicio';
        b.productos = [];
        return [{ texto: 'Claro, empecemos de nuevo.' }, ...avanzar(conv, { boton_id: b.tipo }, config)];
      }
      return cerrarPedido(conv, config);
    }
    default:
      return [{ texto: 'Tu consulta ya está con la dueña. Si quieres empezar otra, pulsa “Reiniciar conversación”.' }];
  }
}

export async function responderDemo({ conversacion_id, texto, boton_id }) {
  const config = demo.config;
  let conv = conversacion_id && conversaciones.get(conversacion_id);
  let mensajes;
  if (!conv) {
    conv = nuevaConversacion();
    mensajes = [mensajeBienvenida(config), preguntaInicial()];
    if (texto || boton_id) {
      conv.inicio = Date.now();
      mensajes = [...mensajes.slice(0, 1), ...avanzar(conv, { texto, boton_id }, config)];
    }
  } else {
    if (!conv.inicio) conv.inicio = Date.now();
    mensajes = avanzar(conv, { texto, boton_id }, config);
  }
  // Pequeña pausa para que se sienta como un chat real.
  await new Promise((r) => setTimeout(r, 450 + Math.random() * 400));
  if (conv.inicio && conv.primera_respuesta_seg === null) conv.primera_respuesta_seg = (Date.now() - conv.inicio) / 1000;
  return {
    conversacion_id: conv.id,
    mensajes,
    paso: conv.paso,
    pedido_id: conv.pedido_id,
    borrador: structuredClone(conv.borrador),
    prioridad: conv.prioridad || null,
  };
}
