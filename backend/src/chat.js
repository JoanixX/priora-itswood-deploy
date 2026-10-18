// POST /chat: el chat guiado de Mermín. Es el mismo flujo de botones que app/src/services/demo/chatSim.js, para que
// los escenarios de la demo (empresa 30 u., persona 1 u., empresa 150 u.) den lo mismo con y sin backend. Aquí el
// pedido se guarda de verdad (pestaña Pedidos), se calcula la prioridad y se avisa a la dueña.
import { calcularPrioridad } from './prioridad.js';
import { formatoSoles, formatoFecha, hoyISO, sumarDias } from './formato.js';
import { crearPedido, avisarPedido, agregarNotificacion, yaComproAntes } from './pedidos.js';

const SUGERIDOS = {
  empresa: ['PR-4D655976', 'PR-43BDD2E6', 'PR-4B75357B'],
  empresaNavidad: ['PR-48A95AE5', 'PR-42A68EA5', 'PR-4D655976'],
  persona: ['PR-4257E8A7', 'PR-496A7867', 'PR-4BD3A29A'],
};
const MAX_BOTONES = 3;

const frase = (tono) => ({
  cercano: { ok: '¡Genial!', eleccion: '¡Buena elección!', listo: '¡Listo! 🙌', gracias: '¡Gracias!' },
  formal: { ok: 'Perfecto.', eleccion: 'Muy bien.', listo: 'Listo.', gracias: 'Muchas gracias.' },
  premium: { ok: 'Con gusto.', eleccion: 'Excelente elección.', listo: 'Todo listo ✨', gracias: 'Gracias por elegirnos.' },
}[tono] || { ok: '¡Perfecto!', eleccion: '¡Buena elección!', listo: '¡Listo!', gracias: '¡Gracias!' });

const boton = (id, texto) => ({ id, texto });

export function mensajeBienvenida(config) {
  const b = config.bienvenida || {};
  return {
    texto: `${config.textos.saludo} ${b.mensaje || ''}`.trim(),
    enlace: { url: b.url_tienda || 'https://itswood.pe', texto: b.texto_boton || 'Ir a la tienda' },
    promo: b.promo_activa && b.promo_texto ? b.promo_texto : null,
  };
}

const preguntaInicial = () => ({
  texto: '¿En qué te ayudo hoy?',
  botones: [boton('empresa', 'Regalos para empresa'), boton('persona', 'Regalo personal'), boton('duena', 'Hablar con la dueña')],
});

function numero(texto) {
  const m = String(texto || '').match(/\d+/);
  return m ? Number(m[0]) : null;
}

function fechaDesde(entrada) {
  const hoy = hoyISO();
  const t = String(entrada || '').toLowerCase();
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
  return [
    `Ocasión: ${b.ocasion}`,
    ...b.productos.map((p) => `${p.cantidad} × ${p.nombre}: ${formatoSoles(p.cantidad * p.precio_unitario)}`),
    `Entrega: ${formatoFecha(b.fecha_requerida)}`,
    `Personalización: ${b.personalizacion || 'No'}`,
    `Total referencial: ${formatoSoles(total)} (sin delivery)`,
  ].join('\n');
}

class Flujo {
  constructor(almacen, conv) {
    this.almacen = almacen;
    this.conv = conv;
    this.config = almacen.datos.config;
    this.f = frase(this.config.tono);
  }

  producto(id) { return this.almacen.datos.catalogo.find((p) => p.id === id); }

  derivar(motivo, titulo) {
    this.conv.paso = 'derivado';
    if (this.config.notificaciones?.pedido_derivado !== false) agregarNotificacion(this.almacen, { tipo: 'pedido_derivado', titulo, texto: motivo, enlace: '/app/pedidos' });
    return [{ texto: `Entiendo. Le paso tu caso a la dueña de ${this.config.negocio} y te escribe muy pronto por aquí. ${this.f.gracias}` }];
  }

  cerrar() {
    const b = this.conv.borrador;
    const esEmpresa = b.tipo === 'empresa';
    const monto = b.productos.reduce((a, p) => a + p.cantidad * p.precio_unitario, 0);
    const ya = yaComproAntes(this.almacen, b.cliente);
    const pedido = crearPedido(this.almacen, {
      cliente: { nombre: esEmpresa ? null : b.cliente, empresa: esEmpresa ? b.cliente : null, telefono: null, correo: null, tipo: b.tipo, ya_compro_antes: ya },
      ocasion: b.ocasion, cantidad_total: b.cantidad, fecha_requerida: b.fecha_requerida, productos: b.productos,
      personalizacion: b.personalizacion, flags: b.flags, conversacion_id: this.conv.id,
      resumen: `Pedido cerrado por ${this.config.asistente}: ${b.cantidad} × ${b.productos[0]?.nombre} para ${b.ocasion}.`,
    });
    this.conv.pedido_id = pedido.id;
    this.conv.paso = 'cerrado';
    const { prioridad, motivo } = calcularPrioridad({ ...b, monto, fecha_entrega: b.fecha_requerida, ya_compro_antes: ya }, this.config);
    this.conv.prioridad = { prioridad, motivo };
    avisarPedido(this.almacen, pedido, prioridad);
    return [{
      texto: prioridad === 'derivado'
        ? `${this.f.listo} Registré tu pedido. Por el volumen, la dueña te escribe hoy con una propuesta a medida.`
        : `${this.f.listo} Tu pedido quedó registrado. La dueña lo confirma y te escribe con el pago y la entrega.`,
    }];
  }

  avanzar(entrada) {
    const { conv, config, f } = this;
    const b = conv.borrador;
    const texto = String(entrada.texto || '').trim();
    const id = entrada.boton_id || null;
    const t = texto.toLowerCase();

    // Derivaciones que aplican en cualquier paso.
    if (/reclamo|llegó (roto|mal|rayad)|queja|devoluci/.test(t) && config.derivar.reclamos) {
      b.flags.reclamo = true;
      return this.derivar(`Reclamo: “${texto.slice(0, 60)}”`, 'Pedido derivado: reclamo');
    }
    if (/descuento|rebaja|precio especial/.test(t) && config.derivar.descuentos) {
      b.flags.descuento = true;
      return this.derivar('Pide descuento', 'Consulta derivada: descuento');
    }
    if (id === 'duena' || (/hablar con|persona real|humano|la dueña/.test(t) && config.derivar.pide_persona)) {
      b.flags.pide_persona = true;
      return this.derivar('Pidió hablar con una persona', 'Pidió hablar contigo');
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
      case 'ocasion':
        b.ocasion = id || texto || 'Otra';
        conv.paso = 'cantidad';
        return [{ texto: '¿Cuántas unidades necesitas?', botones: b.tipo === 'empresa' ? [boton('12', '12'), boton('30', '30'), boton('50', '50')] : [boton('1', '1'), boton('2', '2'), boton('5', '5')] }];
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
        const ids = b.tipo === 'empresa' ? (/navidad/i.test(b.ocasion) ? SUGERIDOS.empresaNavidad : SUGERIDOS.empresa) : SUGERIDOS.persona;
        // Si la dueña subió otro catálogo y los sugeridos ya no están, se ofrecen los primeros con stock.
        let lista = ids.map((x) => this.producto(x)).filter(Boolean);
        if (!lista.length) lista = this.almacen.datos.catalogo.filter((p) => p.stock === null || p.stock > 0).slice(0, MAX_BOTONES);
        return [{ texto: `Para ${formatoFecha(fecha)} te recomiendo estos. Precios por unidad:`, botones: lista.slice(0, MAX_BOTONES).map((p) => boton(`prod:${p.id}`, `${p.nombre} · ${formatoSoles(p.precio)}`)) }];
      }
      case 'producto': {
        let p = id?.startsWith('prod:') ? this.producto(id.slice(5)) : null;
        if (!p && texto) p = this.almacen.datos.catalogo.find((x) => x.nombre.toLowerCase().includes(t));
        if (!p) return [{ texto: 'No encontré ese producto. Elige uno de la lista o mira el catálogo en la web.' }];
        b.productos = [{ producto_id: p.id, nombre: p.nombre, cantidad: b.cantidad, precio_unitario: p.precio }];
        conv.paso = 'personalizacion';
        const stock = p.stock !== null && p.stock < b.cantidad ? ` Ojo: hoy quedan ${p.stock} en stock; la dueña confirma el plazo.` : '';
        return [{ texto: `${f.eleccion} ${p.nombre}.${stock} ¿Lo quieres personalizado con grabado?`, botones: [boton('si', 'Sí, con grabado'), boton('no', 'No, así está bien')] }];
      }
      case 'personalizacion':
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
        return this.avanzar(entrada);
      case 'grabado':
        b.personalizacion = texto || 'Sí';
        if (/diseño (especial|propio)|ilustraci/.test(t)) b.flags.diseno_especial = true;
        conv.paso = 'nombre';
        return [{ texto: b.tipo === 'empresa' ? 'Anotado. ¿A nombre de qué empresa va el pedido?' : 'Anotado. ¿A nombre de quién va el pedido?' }];
      case 'nombre':
        b.cliente = texto || 'Cliente';
        conv.paso = 'confirmar';
        return [{ texto: `Este es tu pedido:\n${resumen(b)}\n¿Lo confirmo?`, botones: [boton('confirmar', 'Confirmar pedido'), boton('cambiar', 'Cambiar algo')] }];
      case 'confirmar':
        if (id === 'cambiar' || /cambiar/.test(t)) {
          conv.paso = 'inicio';
          b.productos = [];
          return [{ texto: 'Claro, empecemos de nuevo.' }, ...this.avanzar({ boton_id: b.tipo })];
        }
        return this.cerrar();
      default:
        return [{ texto: 'Tu consulta ya está con la dueña. Si quieres empezar otra, pulsa “Reiniciar conversación”.' }];
    }
  }
}

function nuevaConversacion(almacen) {
  const conv = {
    id: `c-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, creado_en: new Date().toISOString(),
    inicio: null, primera_respuesta_seg: null, paso: 'inicio', pedido_id: null, prioridad: null,
    borrador: { tipo: null, ocasion: null, cantidad: null, fecha_requerida: null, productos: [], personalizacion: null, cliente: null, flags: {} },
  };
  almacen.datos.conversaciones.push(conv);
  return conv;
}

/** Valida el cuerpo de POST /chat. */
export function validarChat(cuerpo) {
  const c = cuerpo && typeof cuerpo === 'object' ? cuerpo : {};
  const texto = c.texto === null || c.texto === undefined ? null : String(c.texto);
  if (texto && texto.length > 1000) return { error: 'texto admite hasta 1000 caracteres' };
  return { conversacion_id: c.conversacion_id ? String(c.conversacion_id) : null, texto, boton_id: c.boton_id ? String(c.boton_id) : null };
}

export function responderChat(almacen, { conversacion_id, texto, boton_id }) {
  const recibido = Date.now();
  const config = almacen.datos.config;
  let conv = conversacion_id && almacen.datos.conversaciones.find((c) => c.id === conversacion_id);
  let mensajes;
  if (!conv) {
    conv = nuevaConversacion(almacen);
    mensajes = [mensajeBienvenida(config), preguntaInicial()];
    if (texto || boton_id) {
      conv.inicio = recibido;
      mensajes = [mensajes[0], ...new Flujo(almacen, conv).avanzar({ texto, boton_id })];
    }
  } else {
    if (!conv.inicio) conv.inicio = recibido;
    mensajes = new Flujo(almacen, conv).avanzar({ texto, boton_id });
  }
  // Tiempo de primera respuesta: del primer mensaje del cliente a la respuesta de Mermín (para /metricas).
  if (conv.inicio && conv.primera_respuesta_seg === null) conv.primera_respuesta_seg = Math.max(0, (Date.now() - conv.inicio) / 1000);
  almacen.guardar('conversaciones');
  return {
    conversacion_id: conv.id,
    mensajes: mensajes.map((m) => (m.botones ? { ...m, botones: m.botones.slice(0, MAX_BOTONES) } : m)),
    paso: conv.paso,
    pedido_id: conv.pedido_id,
    borrador: structuredClone(conv.borrador),
    prioridad: conv.prioridad || null,
  };
}
