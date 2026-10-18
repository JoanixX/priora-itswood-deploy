'use strict';

// Motor conversacional del bot de ITS WOOD.
// No tiene dependencias: el mismo archivo se ejecuta en las pruebas de Node y dentro del nodo Code de n8n.
// Recibe un mensaje normalizado, la fila de la conversación leída de Sheets y el catálogo; devuelve la fila
// a guardar, las respuestas a enviar y, cuando corresponde, la solicitud y el cliente a registrar.
// No escribe nada: quien lo llama guarda primero y envía después.

// En n8n, config.js va concatenado antes de este archivo; en Node se carga con require.
const CONFIG_BOT = typeof leerConfig === 'function' ? { leerConfig, render, mensajeBienvenida, urlConUtm, fraseWeb, numeroConfig } : require('./config');

const ZONA_HORARIA = 'America/Lima';
const MAX_INTENTOS = 3;
const MAX_TEXTO = 1000;
const MAX_CANDIDATOS = 5;

const MODO = { BOT: 'BOT', PENDIENTE: 'PENDIENTE_HUMANO', HUMANO: 'HUMANO', CERRADO: 'CERRADO' };

// Columnas que escribe el bot. "responsable" y "notas" pertenecen al equipo y el bot nunca las escribe.
const COLUMNAS_CONVERSACION = [
  'wa_id', 'telefono', 'nombre_perfil', 'conversacion_id', 'modo', 'paso', 'segmento', 'empresa', 'nombre',
  'ocasion', 'producto_id', 'producto_nombre', 'precio_unitario', 'cantidad', 'personalizacion', 'logo_media_id',
  'fecha_deseada', 'direccion', 'horario_entrega', 'candidatos', 'intentos', 'motivo_derivacion', 'resumen',
  'solicitud_id', 'ultima_entrada', 'creado_en', 'actualizado_en',
  'intencion', 'puntaje_intencion', 'senales_intencion',
];
const COLUMNAS_EQUIPO_CONVERSACION = ['responsable', 'notas'];
const COLUMNAS_SOLICITUD = [
  'solicitud_id', 'fecha_registro', 'wa_id', 'telefono', 'conversacion_id', 'segmento', 'empresa', 'nombre',
  'ocasion', 'producto_id', 'producto_nombre', 'precio_unitario_ref', 'cantidad', 'total_referencial',
  'personalizacion', 'logo_media_id', 'fecha_deseada', 'fecha_confirmada', 'direccion', 'horario_entrega',
  'motivo', 'resumen', 'estado', 'intencion', 'puntaje_intencion',
  'valor_estimado', 'ganancia_estimada', 'prioridad', 'puntaje_prioridad',
];
const COLUMNAS_CLIENTE = ['wa_id', 'telefono', 'nombre', 'nombre_perfil', 'segmento', 'empresa', 'ultima_solicitud', 'actualizado_en'];
const COLUMNAS_EVENTO = ['mensaje_id', 'fecha', 'wa_id', 'conversacion_id', 'direccion', 'tipo', 'texto', 'media_id', 'resultado', 'estado_entrega', 'detalle'];

// Orden de las preguntas por camino. El siguiente paso es siempre el primer campo vacío,
// así los datos válidos se conservan si el cliente cambia de camino o corrige algo.
const SECUENCIAS = {
  EMPRESA: ['empresa', 'nombre', 'ocasion', 'producto_id', 'cantidad', 'personalizacion', 'fecha_deseada', 'direccion', 'horario_entrega'],
  PERSONA: ['producto_id', 'cantidad', 'personalizacion', 'fecha_deseada', 'nombre', 'direccion', 'horario_entrega'],
};
const PASO_DE_CAMPO = {
  empresa: 'P_EMPRESA', nombre: 'P_NOMBRE', ocasion: 'P_OCASION', producto_id: 'P_PRODUCTO', cantidad: 'P_CANTIDAD',
  personalizacion: 'P_PERSONALIZACION', fecha_deseada: 'P_FECHA', direccion: 'P_DIRECCION', horario_entrega: 'P_HORARIO',
};
const CAMPO_DE_PASO = {};
for (const campo of Object.keys(PASO_DE_CAMPO)) CAMPO_DE_PASO[PASO_DE_CAMPO[campo]] = campo;

const ETIQUETAS = {
  empresa: 'Empresa', nombre: 'Nombre', ocasion: 'Ocasión', producto_id: 'Producto', cantidad: 'Cantidad',
  personalizacion: 'Personalización', fecha_deseada: 'Fecha deseada', direccion: 'Dirección de entrega',
  horario_entrega: 'Horario de entrega',
};
const DEPENDIENTES = { producto_id: ['producto_nombre', 'precio_unitario', 'candidatos'], personalizacion: ['logo_media_id'] };
// Datos del pedido en curso. Empresa y nombre se conservan al cancelar o al reabrir una conversación cerrada.
const CAMPOS_PEDIDO = [
  'ocasion', 'producto_id', 'producto_nombre', 'precio_unitario', 'cantidad', 'personalizacion', 'logo_media_id',
  'fecha_deseada', 'direccion', 'horario_entrega', 'candidatos',
];

const PALABRAS_VACIAS = new Set([
  'de', 'del', 'la', 'el', 'lo', 'los', 'las', 'un', 'una', 'uno', 'unos', 'unas', 'para', 'con', 'y', 'o', 'en', 'mi',
  'me', 'te', 'que', 'por', 'favor', 'hola', 'quiero', 'quisiera', 'busco', 'buscando', 'necesito', 'tienen', 'tiene',
  'tienes', 'hay', 'algo', 'info', 'informacion', 'precio', 'cuanto', 'cuesta', 'madera', 'modelo', 'interesa',
  'personalizado', 'personalizada', 'ver', 'sobre', 'como', 'al', 'su', 'sus', 'es',
]);
// Equivalencias de búsqueda, aplicadas por igual a la consulta y al nombre del producto (ya sin plural).
const SINONIMOS = {
  navidad: 'navideno', navidena: 'navideno', telefono: 'celular', movil: 'celular', cel: 'celular',
  computadora: 'laptop', pc: 'laptop', queso: 'quesera', parrilla: 'parrillera', parrillero: 'parrillera',
  asado: 'parrillera', bbq: 'parrillera', foto: 'portarretrato', cuadro: 'portarretrato', retrato: 'portarretrato',
  marco: 'portarretrato', vela: 'portavela', incienso: 'portaincienso', llav: 'portallav', llavero: 'portallav',
  bautizo: 'sacramento', bautismo: 'sacramento', comunion: 'sacramento', confirmacion: 'sacramento',
  matrimonio: 'boda', corcho: 'portacorcho',
};
const MESES = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9,
  octubre: 10, noviembre: 11, diciembre: 12,
};
const NUMEROS_EN_LETRAS = { uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 };

// ---------- utilidades ----------

function str(v) { return v === undefined || v === null ? '' : String(v); }
function recortar(v, max) { const s = str(v); return s.length > (max || MAX_TEXTO) ? s.slice(0, max || MAX_TEXTO) : s; }
function norm(v) { return str(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }
function palabras(v) { return norm(v).replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean); }
function numero(v) {
  const s = str(v).trim().replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function entero(v) { const n = numero(v); return n === null ? null : Math.floor(n); }
function dinero(n) {
  const [e, d] = Number(n).toFixed(2).split('.');
  return 'S/ ' + e.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + d;
}
function fechaLocal(iso) {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(iso));
  const p = t => partes.find(x => x.type === t).value;
  return `${p('year')}-${p('month')}-${p('day')}`;
}
function construirFecha(y, m, d) {
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return t.toISOString().slice(0, 10);
}
function sumarDias(ymd, dias) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}
function fechaVisible(v) { return /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}` : v; }
function precioTexto(precio) { return precio === null || precio === undefined || precio === '' ? 'precio a confirmar' : dinero(precio); }

// ---------- catálogo ----------

function claveInterna(v) { return norm(v).replace(/\s+/g, ' '); }

// Stock de la pestaña INVENTARIO del equipo (cabecera "ITEM " / "UNIDADES ").
// Número = unidades; "SIN STOCK" = 0; "DESCONTINUADO" = el bot no ofrece el producto; vacío = no informado.
function leerInventario(filas) {
  const inventario = {};
  for (const f of filas || []) {
    const valores = {};
    for (const k of Object.keys(f || {})) valores[norm(k)] = f[k];
    const item = claveInterna(valores.item);
    if (!item) continue;
    const unidades = norm(valores.unidades);
    if (unidades === 'descontinuado') inventario[item] = { descontinuado: true, stock: null };
    else if (unidades === 'sin stock') inventario[item] = { descontinuado: false, stock: 0 };
    else inventario[item] = { descontinuado: false, stock: entero(valores.unidades) };
  }
  return inventario;
}

function leerCatalogo(filas, filasInventario) {
  const inventario = leerInventario(filasInventario);
  return (filas || []).map(f => {
    const nombreInterno = str(f.nombre_interno);
    const inv = inventario[claveInterna(nombreInterno)];
    return {
      id: str(f.id).trim(),
      nombre: str(f.nombre).trim(),
      nombre_interno: nombreInterno,
      precio: numero(f.precio_unitario_web_S !== undefined ? f.precio_unitario_web_S : f.precio),
      // Si el producto está en INVENTARIO manda su stock; si no, el de la propia fila del catálogo.
      stock: inv ? inv.stock : entero(f.stock),
      minimo: entero(f.minimo),
      activo: norm(f.activo) !== 'no' && !(inv && inv.descontinuado),
    };
  }).filter(p => p.id && p.nombre && p.activo);
}

function raiz(t) {
  if (t.length > 5 && t.endsWith('es')) t = t.slice(0, -2);
  else if (t.length > 3 && t.endsWith('s')) t = t.slice(0, -1);
  return SINONIMOS[t] || t;
}

function buscarProductos(consulta, productos) {
  const q = palabras(consulta).filter(t => !PALABRAS_VACIAS.has(t)).map(raiz);
  if (!q.length) return [];
  let mejor = 0;
  const puntuados = [];
  for (const p of productos) {
    const nombre = palabras(p.nombre).map(raiz);
    const puntos = q.filter(t => nombre.some(n => n === t || (t.length >= 4 && n.includes(t)) || (n.length >= 4 && t.startsWith(n)))).length;
    if (puntos > 0) { puntuados.push({ p, puntos }); mejor = Math.max(mejor, puntos); }
  }
  return puntuados.filter(x => x.puntos === mejor).map(x => x.p);
}

function productoDe(conv, ctx) {
  const p = ctx.productos.find(x => x.id === conv.producto_id);
  if (p) return p;
  if (!conv.producto_id) return null;
  return { id: conv.producto_id, nombre: conv.producto_nombre, precio: numero(conv.precio_unitario), stock: null, minimo: null };
}

function leerCandidatos(conv) {
  try { const v = JSON.parse(conv.candidatos || '[]'); return Array.isArray(v) ? v.map(str) : []; } catch (e) { return []; }
}

// ---------- intención de compra ----------
// Reglas, sin IA: suma por cada dato que el cliente ya definió y por frases de compra; resta si dice que solo
// está mirando. ALTA >= 60, MEDIA >= 30, BAJA < 30. Las BAJA no generan prospecto en PAUTAS.

const PUNTOS_INTENCION = {
  producto: 20, cantidad: 15, volumen: 10, fecha: 10, fecha_cercana: 10, urgente: 20, personalizacion: 5,
  nombre: 5, direccion: 10, confirmo: 20, compra: 10, explorando: -25,
};
const UMBRAL_ALTA = 60;
const UMBRAL_MEDIA = 30;
const FRASE_COMPRA = /(quiero|quisiera|deseo|necesito|me gustaria|queremos|necesitamos) (comprar|pedir|encargar|hacer un pedido|cotizar|una cotizacion)|\bcotizacion\b|\bcotizar\b|hacer un pedido|para (mi|nuestra|la) (empresa|evento|boda)/;
const FRASE_EXPLORANDO = /solo (estoy |estamos )?(viendo|mirando|averiguando|consultando|curioseando)|solo (queria|quiero|queriamos) (saber|ver|preguntar)|mas adelante|por ahora no|no por ahora|lo (voy a )?pienso|lo voy a pensar|(despues|luego) (te |les )?(escribo|aviso)/;

function leerSenales(conv) { return new Set(str(conv.senales_intencion).split(',').map(s => s.trim()).filter(Boolean)); }

// Actualiza las señales de texto con el mensaje actual. La última intención expresada manda.
function detectarSenales(conv, n) {
  const senales = leerSenales(conv);
  if (FRASE_COMPRA.test(n)) { senales.add('compra'); senales.delete('explorando'); }
  if (FRASE_EXPLORANDO.test(n)) { senales.add('explorando'); senales.delete('compra'); }
  conv.senales_intencion = [...senales].join(',');
  return senales;
}

function calcularIntencion(conv, ctx, confirmo) {
  const senales = leerSenales(conv);
  const usados = [];
  const sumar = clave => usados.push(clave);
  if (str(conv.producto_id)) sumar('producto');
  const cantidad = entero(conv.cantidad);
  if (cantidad) sumar('cantidad');
  if ((cantidad && cantidad >= 12) || conv.segmento === 'EMPRESA') sumar('volumen');
  if (/^\d{4}-\d{2}-\d{2}$/.test(conv.fecha_deseada)) {
    sumar('fecha');
    if (conv.fecha_deseada <= sumarDias(fechaLocal(ctx.ahoraIso), 45)) sumar('fecha_cercana');
  } else if (conv.fecha_deseada === 'Lo antes posible') sumar('urgente');
  if (str(conv.personalizacion) && conv.personalizacion !== 'Sin personalización') sumar('personalizacion');
  if (str(conv.nombre)) sumar('nombre');
  if (str(conv.direccion)) sumar('direccion');
  if (confirmo) sumar('confirmo');
  if (senales.has('compra')) sumar('compra');
  if (senales.has('explorando')) sumar('explorando');
  const puntaje = Math.max(0, Math.min(100, usados.reduce((s, k) => s + PUNTOS_INTENCION[k], 0)));
  const nivel = puntaje >= UMBRAL_ALTA ? 'ALTA' : puntaje >= UMBRAL_MEDIA ? 'MEDIA' : 'BAJA';
  conv.intencion = nivel;
  conv.puntaje_intencion = String(puntaje);
  return { nivel, puntaje, senales: usados };
}

// ---------- prioridad del lead ----------
// Por cantidad, valor y ganancia (sección 4 del plan). El costo sale de BOT_PRODUCTOS (la hoja fuente del negocio);
// sin costo se usa margen_por_defecto. Cada parte se normaliza contra un tope de BOT_CONFIG y se recorta a 1:
//   puntaje = (0.45·ganancia + 0.35·valor + 0.20·cantidad) × 100;  ALTA ≥ umbral_alta, MEDIA ≥ umbral_media.

const PESOS_PRIORIDAD = { ganancia: 0.45, valor: 0.35, cantidad: 0.20 };

function costoDe(conv, ctx) {
  const fila = ctx.productosFuente.find(p => str(p.sku).trim() === conv.producto_id)
    || ctx.productosFuente.find(p => norm(p.nombre) && norm(p.nombre) === norm(conv.producto_nombre));
  return fila ? numero(fila.costo) : null;
}

function calcularPrioridad(conv, ctx) {
  const c = ctx.config;
  const cfg = clave => CONFIG_BOT.numeroConfig(c, clave);
  const precio = numero(conv.precio_unitario);
  const cantidad = entero(conv.cantidad) || 0;
  const costo = costoDe(conv, ctx);
  const valor = precio === null ? 0 : precio * cantidad;
  const unitaria = precio === null ? 0 : costo !== null ? Math.max(0, precio - costo) : precio * cfg('margen_por_defecto');
  const ganancia = unitaria * cantidad;
  const parte = (v, tope) => (tope > 0 ? Math.min(1, Math.max(0, v / tope)) : 0);
  const puntaje = Math.round(100 * (
    PESOS_PRIORIDAD.ganancia * parte(ganancia, cfg('tope_ganancia'))
    + PESOS_PRIORIDAD.valor * parte(valor, cfg('tope_valor'))
    + PESOS_PRIORIDAD.cantidad * parte(cantidad, cfg('tope_cantidad'))));
  const nivel = puntaje >= cfg('umbral_prioridad_alta') ? 'ALTA' : puntaje >= cfg('umbral_prioridad_media') ? 'MEDIA' : 'BAJA';
  const redondeo = n => Math.round(n * 100) / 100;
  return { nivel, puntaje, valor: redondeo(valor), ganancia: redondeo(ganancia), con_costo: costo !== null };
}

// ---------- textos ----------

function menu() {
  return [
    '¿Qué tipo de pedido quieres hacer?',
    '1️⃣ Para una empresa (regalos corporativos o por volumen)',
    '2️⃣ Personal (un regalo o algo para ti)',
    '3️⃣ Hablar con una persona del equipo',
    '',
    'Responde con el número. En cualquier momento puedes escribir ASESOR para hablar con una persona.',
  ].join('\n');
}

function negocio(ctx) { return ctx.config.nombre_negocio; }

// Conversación nueva: bienvenida con la redirección a la web (BOT_CONFIG.mensaje_bienvenida).
function bienvenida(conv, ctx) { return CONFIG_BOT.mensajeBienvenida(ctx.config, conv.nombre); }

// Conversación existente que vuelve al bot: saludo corto, sin repetir la promoción de la web.
function saludo(conv, ctx) {
  const hola = conv.nombre ? `¡Hola de nuevo, ${conv.nombre}! 👋` : '¡Hola! 👋';
  return CONFIG_BOT.render('{hola} Soy {nombre_bot} {emoji_bot}, el asistente de {nombre_negocio}. Te ayudo a armar tu pedido y se lo paso al equipo.', { ...ctx.config, hola });
}

function pregunta(campo, conv, ctx) {
  switch (campo) {
    case 'empresa': return '¿Cuál es el nombre de tu empresa?';
    case 'nombre': return conv.segmento === 'EMPRESA' ? '¿Con quién tengo el gusto? Escríbeme el nombre de la persona de contacto.' : '¿Cuál es tu nombre?';
    case 'ocasion': return '¿Para qué ocasión son los regalos? Por ejemplo: fin de año, aniversario, bienvenida de colaboradores o un evento.';
    case 'producto_id': return '¿Qué producto te interesa? Escríbelo con tus palabras, por ejemplo: tabla quesera, tabla parrillera, posataza, mesa picnic, portarretrato o recuerdos para sacramentos.';
    case 'cantidad': {
      const p = productoDe(conv, ctx);
      return `¿Cuántas unidades${p ? ` de ${p.nombre}` : ''} necesitas? Escribe la cantidad exacta (por ejemplo: 60).`;
    }
    case 'personalizacion': return '¿Quieres personalizarlo con un nombre, frase o logo? Escribe NO o cuéntame qué te gustaría. Si es un logo, puedes enviarlo como imagen.';
    case 'fecha_deseada': return '¿Para qué fecha lo necesitas? Escríbela como día/mes/año (por ejemplo: 20/12/2026). Si aún no tienes fecha, escribe SIN FECHA.';
    case 'direccion': return '¿A qué dirección y distrito sería la entrega?';
    case 'horario_entrega': return '¿En qué horario se puede recibir el pedido? Por ejemplo: lunes a viernes de 9 a. m. a 6 p. m.';
    default: return '';
  }
}

function preguntaActual(conv, ctx) {
  if (conv.paso === 'RESUMEN') return opcionesResumen();
  if (conv.paso === 'CORREGIR') return opcionesCorregir(conv);
  const campo = CAMPO_DE_PASO[conv.paso];
  return campo ? pregunta(campo, conv, ctx) : menu();
}

function totalReferencial(conv) {
  const precio = numero(conv.precio_unitario);
  const cantidad = entero(conv.cantidad);
  return precio !== null && cantidad ? Math.round(precio * cantidad * 100) / 100 : null;
}

function valorVisible(campo, conv) {
  const v = str(conv[campo]);
  if (campo === 'producto_id') return v ? `${conv.producto_nombre} (${precioTexto(numero(conv.precio_unitario))} c/u)` : '';
  if (campo === 'fecha_deseada') return v ? `${fechaVisible(v)} (por confirmar)` : '';
  return v;
}

function opcionesResumen() {
  return '1️⃣ Confirmar y enviar al equipo\n2️⃣ Corregir un dato\n3️⃣ Cancelar';
}

function resumenCliente(conv, ctx) {
  const lineas = ['📋 Resumen de tu solicitud', `• Tipo: ${conv.segmento === 'EMPRESA' ? 'Empresa' : 'Personal'}`];
  for (const campo of SECUENCIAS[conv.segmento]) {
    lineas.push(`• ${ETIQUETAS[campo]}: ${valorVisible(campo, conv)}`);
    if (campo === 'cantidad') {
      const total = totalReferencial(conv);
      lineas.push(`• Total referencial: ${total === null ? 'a confirmar' : dinero(total)}`);
    }
  }
  lineas.push('');
  lineas.push(`El total es referencial y se calcula con el precio web. El precio final (personalización, volumen y envío), la fecha y la disponibilidad las confirma el equipo de ${negocio(ctx)}.`);
  lineas.push('');
  lineas.push(opcionesResumen());
  return lineas.join('\n');
}

function opcionesCorregir(conv) {
  const campos = SECUENCIAS[conv.segmento] || [];
  return ['¿Qué dato quieres corregir?', ...campos.map((c, i) => `${i + 1}. ${ETIQUETAS[c]}`), '', 'Escribe el número o VOLVER para ver el resumen.'].join('\n');
}

function resumenInterno(conv, motivo, textoCliente) {
  const partes = [`[${conv.segmento || 'SIN_SEGMENTO'}]`];
  for (const campo of SECUENCIAS[conv.segmento] || ['nombre', 'empresa']) {
    if (str(conv[campo])) partes.push(`${ETIQUETAS[campo]}: ${valorVisible(campo, conv)}`);
  }
  const total = totalReferencial(conv);
  if (total !== null) partes.push(`Total ref.: ${dinero(total)}`);
  partes.push(`Motivo: ${motivo}`);
  if (textoCliente && motivo !== 'SOLICITUD_COMPLETA') partes.push(`Último mensaje: ${recortar(textoCliente, 300)}`);
  return partes.join(' | ');
}

// ---------- validaciones por campo ----------
// Cada una devuelve {ok:true, cambios, nota}, {ok:false, error} o {pendiente:true, respuesta, cambios}.

function validarTextoLibre(t, min, max, error) {
  if (t.length < min || !/[a-z0-9]/i.test(norm(t))) return { ok: false, error };
  return { ok: true, valor: recortar(t, max) };
}

const VALIDAR = {
  empresa(t) {
    const r = validarTextoLibre(t, 2, 150, 'No logré leer el nombre de la empresa.');
    return r.ok ? { ok: true, cambios: { empresa: r.valor } } : r;
  },

  nombre(t) {
    if (!/[a-zñ]/.test(norm(t)) || t.length < 2 || t.length > 80) return { ok: false, error: 'No logré leer el nombre.' };
    return { ok: true, cambios: { nombre: t } };
  },

  ocasion(t) {
    const r = validarTextoLibre(t, 2, 200, 'No logré leer la ocasión.');
    return r.ok ? { ok: true, cambios: { ocasion: r.valor } } : r;
  },

  producto_id(t, n, m, conv, ctx) {
    const candidatos = leerCandidatos(conv);
    let elegido = null;
    if (/^\d{1,2}$/.test(n) && candidatos.length) {
      const i = parseInt(n, 10) - 1;
      if (i >= 0 && i < candidatos.length) elegido = ctx.productos.find(p => p.id === candidatos[i]) || null;
      if (!elegido) return { ok: false, error: `Elige un número entre 1 y ${candidatos.length}, o escribe otra palabra para buscar.` };
    }
    if (!elegido) elegido = ctx.productos.find(p => p.id.toLowerCase() === n) || null;
    if (elegido) {
      return {
        ok: true,
        cambios: { producto_id: elegido.id, producto_nombre: elegido.nombre, precio_unitario: elegido.precio === null ? '' : String(elegido.precio), candidatos: '' },
        nota: `Elegiste ${elegido.nombre} (${precioTexto(elegido.precio)} c/u, precio web referencial).`,
      };
    }
    const encontrados = buscarProductos(t, ctx.productos);
    if (!encontrados.length) {
      return { ok: false, error: 'No encontré productos con esa descripción. Prueba con otra palabra (por ejemplo: tabla, posataza, mesa, portarretrato, box) o escribe ASESOR.' };
    }
    const lista = encontrados.slice(0, MAX_CANDIDATOS);
    const lineas = ['Encontré estas opciones:', ...lista.map((p, i) => `${i + 1}. ${p.nombre} — ${precioTexto(p.precio)}`), ''];
    if (encontrados.length > MAX_CANDIDATOS) lineas.push(`Hay ${encontrados.length} coincidencias; si no ves la tuya, escribe algo más específico.`);
    lineas.push('Responde con el número del producto o escribe otra palabra para buscar.');
    return { pendiente: true, respuesta: lineas.join('\n'), cambios: { candidatos: JSON.stringify(lista.map(p => p.id)) } };
  },

  cantidad(t, n, m, conv, ctx) {
    const s = n.replace(/(\d)[.,](\d{3})(?!\d)/g, '$1$2');
    const exacta = 'Necesito la cantidad exacta para cotizar, por ejemplo: 60 (no "50 o más").';
    if (/\d\s*\+|\+\s*\d|mas de|menos de|o mas|aprox|alrededor|entre |unos |unas |como |hasta /.test(s + ' ')) return { ok: false, error: exacta };
    const numeros = s.match(/\d+/g) || [];
    let c = null;
    if (/docena/.test(s)) c = /media docena/.test(s) ? 6 : 12 * (numeros.length === 1 ? parseInt(numeros[0], 10) : 1);
    else if (numeros.length === 1) c = parseInt(numeros[0], 10);
    else if (!numeros.length) {
      const enLetras = palabras(s).map(w => NUMEROS_EN_LETRAS[w]).filter(Boolean);
      if (enLetras.length === 1) c = enLetras[0];
    }
    if (c === null) return { ok: false, error: exacta };
    if (c < 1 || c > 100000) return { ok: false, error: 'Escribe una cantidad entre 1 y 100000.' };
    const p = productoDe(conv, ctx);
    if (p && p.minimo && c < p.minimo) return { ok: false, error: `El mínimo para ${p.nombre} es de ${p.minimo} unidades.` };
    let nota = '';
    if (p && p.stock !== null && c > p.stock) {
      nota = p.stock > 0
        ? `Hoy hay ${p.stock} unidad(es) en stock; el resto depende de producción y el equipo confirmará el plazo.`
        : 'Hoy no hay unidades en stock: se fabrica a pedido y el equipo confirmará el plazo.';
    }
    return { ok: true, cambios: { cantidad: String(c) }, nota };
  },

  personalizacion(t, n, m) {
    const nota = 'Anotado. La personalización queda registrada como solicitud: el equipo confirmará si es posible y su costo.';
    if ((m.tipo === 'image' || m.tipo === 'document') && m.media_id) {
      return {
        ok: true,
        cambios: { logo_media_id: str(m.media_id), personalizacion: `Imagen/logo enviado${t ? `: ${recortar(t, 400)}` : ''}` },
        nota: `Recibí la imagen 👍 ${nota.replace('Anotado. ', '')}`,
      };
    }
    if (/^(no|nop|ninguna|ninguno|nada|sin|sin personalizacion|no gracias|no, gracias|no deseo|no quiero)$/.test(n)) {
      return { ok: true, cambios: { personalizacion: 'Sin personalización', logo_media_id: '' } };
    }
    const r = validarTextoLibre(t, 2, 500, 'No logré leer la personalización.');
    return r.ok ? { ok: true, cambios: { personalizacion: r.valor }, nota } : r;
  },

  fecha_deseada(t, n, m, conv, ctx) {
    if (/^(sin fecha|no se|no lo se|no tengo( fecha)?|aun no|todavia no|por definir)$/.test(n)) return { ok: true, cambios: { fecha_deseada: 'Sin fecha definida' } };
    if (/(lo antes posible|cuanto antes|urgente|lo mas pronto)/.test(n)) return { ok: true, cambios: { fecha_deseada: 'Lo antes posible' } };
    const hoy = fechaLocal(ctx.ahoraIso);
    const anioActual = parseInt(hoy.slice(0, 4), 10);
    let fecha = null;
    let conAnio = true;
    let g;
    if (/^pasado manana$/.test(n)) fecha = sumarDias(hoy, 2);
    else if (/^manana$/.test(n)) fecha = sumarDias(hoy, 1);
    else if ((g = n.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/))) {
      conAnio = !!g[3];
      const y = g[3] ? (g[3].length === 2 ? 2000 + parseInt(g[3], 10) : parseInt(g[3], 10)) : anioActual;
      fecha = construirFecha(y, parseInt(g[2], 10), parseInt(g[1], 10));
    } else if ((g = n.match(/^(?:el )?(\d{1,2}) de ([a-z]+)(?: (?:de|del) (\d{4}))?$/)) && MESES[g[2]]) {
      conAnio = !!g[3];
      fecha = construirFecha(g[3] ? parseInt(g[3], 10) : anioActual, MESES[g[2]], parseInt(g[1], 10));
    }
    if (!fecha) return { ok: false, error: 'No reconocí la fecha. Escríbela como día/mes/año, por ejemplo 20/12/2026.' };
    if (!conAnio && fecha <= hoy) fecha = construirFecha(parseInt(fecha.slice(0, 4), 10) + 1, parseInt(fecha.slice(5, 7), 10), parseInt(fecha.slice(8, 10), 10));
    if (!fecha || fecha <= hoy) return { ok: false, error: 'Esa fecha ya pasó o es hoy. Indícame una fecha desde mañana.' };
    if (fecha > sumarDias(hoy, 730)) return { ok: false, error: 'Esa fecha está muy lejos. Indícame una fecha dentro de los próximos dos años.' };
    return {
      ok: true,
      cambios: { fecha_deseada: fecha },
      nota: `Anoté el ${fechaVisible(fecha)}. La fecha queda sujeta a confirmación de producción.`,
    };
  },

  direccion(t, n, m) {
    if (m.tipo === 'location' && (m.latitud || m.texto)) {
      const lugar = [m.texto, m.latitud && m.longitud ? `(${m.latitud}, ${m.longitud})` : ''].filter(Boolean).join(' ');
      return { ok: true, cambios: { direccion: recortar(`Ubicación compartida: ${lugar}`, 300) } };
    }
    const r = validarTextoLibre(t, 5, 300, 'Necesito la dirección con distrito, por ejemplo: Av. Larco 123, Miraflores.');
    return r.ok ? { ok: true, cambios: { direccion: r.valor } } : r;
  },

  horario_entrega(t) {
    const r = validarTextoLibre(t, 3, 200, 'No logré leer el horario.');
    return r.ok ? { ok: true, cambios: { horario_entrega: r.valor } } : r;
  },
};

const ACEPTA_SIN_TEXTO = { personalizacion: ['image', 'document'], direccion: ['location'] };

// ---------- conversación ----------

function idConversacion(waId, ahoraIso) { return `CONV-${waId}-${Date.parse(ahoraIso).toString(36).toUpperCase()}`; }

function nuevaConversacion(m, ahoraIso) {
  return {
    wa_id: str(m.wa_id), telefono: str(m.telefono || m.wa_id), nombre_perfil: str(m.nombre_perfil),
    conversacion_id: idConversacion(str(m.wa_id), ahoraIso), modo: MODO.BOT, paso: 'SEGMENTO', intentos: '0', creado_en: ahoraIso,
  };
}

function copiarFila(fila) {
  const conv = {};
  for (const c of COLUMNAS_CONVERSACION) conv[c] = str(fila[c]);
  return conv;
}

function limpiarPedido(conv) {
  for (const c of CAMPOS_PEDIDO) conv[c] = '';
  conv.intentos = '0';
}

function reabrir(conv, ahoraIso) {
  limpiarPedido(conv);
  Object.assign(conv, {
    segmento: '', modo: MODO.BOT, paso: 'SEGMENTO', motivo_derivacion: '', resumen: '', solicitud_id: '',
    intencion: '', puntaje_intencion: '', senales_intencion: '',
    conversacion_id: idConversacion(conv.wa_id, ahoraIso), creado_en: ahoraIso,
  });
}

function pideAsesor(n) {
  return /\b(asesor|asesora|asesoria|humano|humana|agente|operador|operadora|vendedor|vendedora|ejecutivo|ejecutiva)\b/.test(n)
    || /hablar con (alguien|una persona|un asesor|una asesora|el equipo|la duena|el dueno)/.test(n);
}

function siguienteCampo(conv) {
  return (SECUENCIAS[conv.segmento] || []).find(c => !str(conv[c]).trim()) || null;
}

function avanzar(conv, ctx, nota) {
  const prefijo = nota ? `${nota}\n\n` : '';
  const falta = siguienteCampo(conv);
  conv.intentos = '0';
  if (!falta) {
    conv.paso = 'RESUMEN';
    ctx.respuestas.push(prefijo + resumenCliente(conv, ctx));
    return;
  }
  conv.paso = PASO_DE_CAMPO[falta];
  ctx.respuestas.push(prefijo + pregunta(falta, conv, ctx));
}

function fallo(conv, ctx, error, textoCliente) {
  const intentos = (parseInt(conv.intentos, 10) || 0) + 1;
  conv.intentos = String(intentos);
  if (intentos >= MAX_INTENTOS) { derivar(conv, ctx, 'NO_ENTENDIDO', textoCliente); return; }
  ctx.respuestas.push(`${error}\n\n${preguntaActual(conv, ctx)}`);
}

function crearSolicitud(conv, ctx, motivo, textoCliente, prioridad) {
  const hoy = fechaLocal(ctx.ahoraIso).replace(/-/g, '');
  const sufijo = Date.parse(ctx.ahoraIso).toString(36).toUpperCase().slice(-4);
  const precio = numero(conv.precio_unitario);
  const cantidad = entero(conv.cantidad);
  const total = totalReferencial(conv);
  return {
    solicitud_id: `SOL-${hoy}-${conv.wa_id.slice(-4)}-${sufijo}`,
    fecha_registro: ctx.ahoraIso,
    wa_id: conv.wa_id,
    telefono: conv.telefono,
    conversacion_id: conv.conversacion_id,
    segmento: conv.segmento,
    empresa: conv.empresa,
    nombre: conv.nombre,
    ocasion: conv.ocasion,
    producto_id: conv.producto_id,
    producto_nombre: conv.producto_nombre,
    precio_unitario_ref: precio === null ? '' : precio,
    cantidad: cantidad === null ? '' : cantidad,
    total_referencial: total === null ? '' : total,
    personalizacion: conv.personalizacion,
    logo_media_id: conv.logo_media_id,
    fecha_deseada: conv.fecha_deseada,
    fecha_confirmada: 'PENDIENTE',
    direccion: conv.direccion,
    horario_entrega: conv.horario_entrega,
    motivo,
    // Las derivaciones ALTA se marcan con 🔴 para que el equipo las vea primero.
    resumen: `${prioridad.nivel === 'ALTA' ? '🔴 ' : ''}${resumenInterno(conv, motivo, textoCliente)}`,
    estado: MODO.PENDIENTE,
    intencion: conv.intencion,
    puntaje_intencion: entero(conv.puntaje_intencion) === null ? '' : entero(conv.puntaje_intencion),
    valor_estimado: prioridad.valor,
    ganancia_estimada: prioridad.ganancia,
    prioridad: prioridad.nivel,
    puntaje_prioridad: prioridad.puntaje,
  };
}

// Aviso inmediato al negocio por un lead ALTA (sección 6 del plan).
function avisoLeadAlta(conv, ctx, solicitud, prioridad) {
  const cliente = conv.empresa ? `${conv.empresa}${conv.nombre ? ` (${conv.nombre})` : ''}` : conv.nombre || conv.nombre_perfil || 'Cliente';
  return [
    `🔴 Lead ALTA ${negocio(ctx)} (${prioridad.puntaje}/100)`,
    `Cliente: ${cliente} · +${conv.wa_id}`,
    `Producto: ${conv.producto_nombre || 'por definir'} × ${conv.cantidad || '?'}`,
    `Valor estimado: ${dinero(prioridad.valor)} · Ganancia estimada: ${dinero(prioridad.ganancia)}${prioridad.con_costo ? '' : ' (margen por defecto)'}`,
    `Solicitud: ${solicitud.solicitud_id}`,
    `Conversación: https://wa.me/${conv.wa_id}`,
    'Tómalo en el formulario de atención humana.',
  ].join('\n');
}

// PAUTAS se escribe con USER_ENTERED para que las fechas queden como fechas, igual que las que llena el equipo.
// Por eso todo texto del cliente que Sheets podría leer como fórmula o número se antepone con un apóstrofo.
function textoLiteral(v) {
  const s = str(v);
  return /^[=+\-@']/.test(s) || /^\d[\d\s/.-]*$/.test(s) ? `'${s}` : s;
}

function numeroLocal(waId) { return /^51\d{9}$/.test(waId) ? waId.slice(2) : waId; }

// =DATE() da una fecha real que Sheets muestra con el formato regional (d/M/yyyy), igual que las filas del equipo.
function formulaFecha(ymd) { const [y, m, d] = ymd.split('-').map(Number); return `=DATE(${y},${m},${d})`; }
// Misma regla que la fórmula del equipo en PROXIMO SEGUIMIENTO (=IF(I2="","",I2+2)), sin depender del número de fila.
const FORMULA_SEGUIMIENTO = '=IF(INDIRECT("I"&ROW())="","",INDIRECT("I"&ROW())+2)';

function crearPauta(conv, ctx) {
  const hoy = formulaFecha(fechaLocal(ctx.ahoraIso));
  const p = productoDe(conv, ctx);
  const cliente = conv.empresa
    ? `${conv.empresa}${conv.nombre ? ` (${conv.nombre})` : ''}`
    : conv.nombre || conv.nombre_perfil || `WhatsApp ${conv.wa_id}`;
  const cantidad = entero(conv.cantidad);
  return {
    'FECHA MENSAJE': hoy,
    CLIENTE: textoLiteral(cliente),
    NUMERO: textoLiteral(numeroLocal(conv.wa_id)),
    CELEBRACION: textoLiteral(conv.ocasion),
    // La columna del equipo es texto ("NOVIEMBRE"...): la fecha va como texto dd/mm/aaaa.
    'FECHA EVENTO': textoLiteral(fechaVisible(conv.fecha_deseada)),
    // El nombre interno coincide con la lista de NOMBRES que valida la columna; si falta, va el nombre web.
    'LISTADO DE PRODUCTOS ': textoLiteral(p ? (p.nombre_interno || p.nombre) : ''),
    CANTIDAD: cantidad === null ? '' : cantidad,
    ESTADO: '',
    'ULTIMO CONTACTO': hoy,
    'PROXIMO SEGUIMIENTO': FORMULA_SEGUIMIENTO,
    'MOTIVO DE PERDIDA': '',
  };
}

function derivar(conv, ctx, motivo, textoCliente) {
  const intencion = calcularIntencion(conv, ctx, motivo === 'SOLICITUD_COMPLETA');
  const prioridad = calcularPrioridad(conv, ctx);
  const solicitud = crearSolicitud(conv, ctx, motivo, textoCliente, prioridad);
  ctx.solicitud = solicitud;
  ctx.cliente = {
    wa_id: conv.wa_id, telefono: conv.telefono, nombre: conv.nombre, nombre_perfil: conv.nombre_perfil,
    segmento: conv.segmento, empresa: conv.empresa, ultima_solicitud: solicitud.solicitud_id, actualizado_en: ctx.ahoraIso,
  };
  Object.assign(conv, {
    modo: MODO.PENDIENTE, paso: 'DERIVADO', intentos: '0', candidatos: '',
    motivo_derivacion: motivo, resumen: solicitud.resumen, solicitud_id: solicitud.solicitud_id,
  });

  // Prioridad BAJA en un pedido completo: el bot lo cierra con la web y el descuento (si hay web configurada).
  // Si el cliente pidió una persona o el bot no le entendió, se deriva igual.
  const web = CONFIG_BOT.fraseWeb(ctx.config);
  if (prioridad.nivel === 'BAJA' && motivo === 'SOLICITUD_COMPLETA' && web) {
    solicitud.estado = 'CERRADO_WEB';
    Object.assign(conv, { modo: MODO.CERRADO, paso: 'CERRADO_WEB' });
    ctx.pauta = null;
    ctx.respuestas.push(`¡Listo! Registré tu solicitud ${solicitud.solicitud_id} ✅\n\nPara un pedido así, lo más rápido es comprar en nuestra web: ${web}\n\nSi prefieres que una persona del equipo te atienda, escribe ASESOR.`);
    return;
  }

  // Filtro por intención: una BAJA se atiende igual (queda en BOT_SOLICITUDES), pero no entra a PAUTAS.
  ctx.pauta = intencion.nivel === 'BAJA' ? null : crearPauta(conv, ctx);
  ctx.aviso = prioridad.nivel === 'ALTA' ? avisoLeadAlta(conv, ctx, solicitud, prioridad) : [
    `🔔 Nueva atención ${negocio(ctx)}`,
    `Cliente: +${conv.wa_id}${conv.nombre || conv.nombre_perfil ? ` (${conv.nombre || conv.nombre_perfil})` : ''}`,
    `Solicitud: ${solicitud.solicitud_id}`,
    `Intención de compra: ${intencion.nivel} (${intencion.puntaje}/100) · Prioridad: ${prioridad.nivel} (${prioridad.puntaje}/100)`,
    solicitud.resumen,
    'Toma el caso en el formulario de atención humana para responder.',
  ].join('\n');
  if (motivo === 'SOLICITUD_COMPLETA') {
    ctx.respuestas.push(`¡Listo! Registré tu solicitud ${solicitud.solicitud_id} ✅\n\nUna persona del equipo de ${negocio(ctx)} te escribirá por este mismo chat para confirmar el precio final, la fecha y la forma de pago.`);
  } else if (motivo === 'NO_ENTENDIDO') {
    ctx.respuestas.push(`Parece que no te estoy entendiendo bien 🙈 Le pasé lo que conversamos a una persona del equipo de ${negocio(ctx)}; te escribirá por este mismo chat.`);
  } else {
    ctx.respuestas.push(`Te comunico con una persona del equipo de ${negocio(ctx)}. Le dejé el resumen de lo que conversamos y te escribirá por este mismo chat.`);
  }
}

function elegirSegmento(conv, ctx, n, t) {
  let segmento = null;
  if (n === '1' || /empresa|corporativ|negocio|colaborador|trabajador/.test(n)) segmento = 'EMPRESA';
  else if (n === '2' || /personal|para mi|regalo|persona\b/.test(n)) segmento = 'PERSONA';
  else if (n === '3') { derivar(conv, ctx, 'SOLICITUD_CLIENTE', t); return; }
  if (!segmento) { fallo(conv, ctx, 'Elige una opción con su número: 1, 2 o 3.', t); return; }
  conv.segmento = segmento;
  avanzar(conv, ctx, segmento === 'EMPRESA' ? '¡Genial! Te ayudo con un pedido para empresa.' : '¡Genial! Te ayudo con tu pedido.');
}

function responderResumen(conv, ctx, n, t) {
  if (/^(1|si|confirmar|confirmo|ok|dale|listo|correcto|de acuerdo|si,? confirmo)$/.test(n)) { derivar(conv, ctx, 'SOLICITUD_COMPLETA', t); return; }
  if (/^(2|no|corregir|cambiar|modificar)$/.test(n)) { conv.paso = 'CORREGIR'; conv.intentos = '0'; ctx.respuestas.push(opcionesCorregir(conv)); return; }
  if (n === '3') { cancelar(conv, ctx); return; }
  fallo(conv, ctx, 'Responde 1, 2 o 3.', t);
}

function responderCorregir(conv, ctx, n, t) {
  if (n === 'volver') { avanzar(conv, ctx); return; }
  const campos = SECUENCIAS[conv.segmento] || [];
  const i = /^\d{1,2}$/.test(n) ? parseInt(n, 10) - 1 : -1;
  if (i < 0 || i >= campos.length) { fallo(conv, ctx, `Elige un número entre 1 y ${campos.length}.`, t); return; }
  const campo = campos[i];
  conv[campo] = '';
  for (const d of DEPENDIENTES[campo] || []) conv[d] = '';
  conv.paso = PASO_DE_CAMPO[campo];
  conv.intentos = '0';
  ctx.respuestas.push(pregunta(campo, conv, ctx));
}

function cancelar(conv, ctx) {
  limpiarPedido(conv);
  conv.paso = 'SEGMENTO';
  ctx.respuestas.push(`Listo, cancelé la solicitud en curso.\n\n${menu()}`);
}

function responderCampo(conv, ctx, campo, t, n) {
  const m = ctx.mensaje;
  if (!SECUENCIAS[conv.segmento]) { conv.paso = 'SEGMENTO'; ctx.respuestas.push(menu()); return; }
  if (!t && !(ACEPTA_SIN_TEXTO[campo] || []).includes(m.tipo)) {
    const aviso = m.tipo === 'image' ? 'Recibí tu imagen y queda registrada para el equipo.' : 'Por ahora solo puedo leer mensajes de texto.';
    ctx.respuestas.push(`${aviso}\n\n${pregunta(campo, conv, ctx)}`);
    return;
  }
  const r = VALIDAR[campo](t, n, m, conv, ctx);
  if (r.pendiente) { Object.assign(conv, r.cambios || {}); conv.intentos = '0'; ctx.respuestas.push(r.respuesta); return; }
  if (!r.ok) { fallo(conv, ctx, r.error, t); return; }
  Object.assign(conv, r.cambios);
  avanzar(conv, ctx, r.nota);
}

function atender(conv, ctx, esInicio) {
  const m = ctx.mensaje;
  const t = recortar(str(m.texto).trim());
  const n = norm(t);

  if (m.tipo === 'reaction') { ctx.resultado = 'IGNORADO'; return; }
  const senales = n ? detectarSenales(conv, n) : leerSenales(conv);
  if (n && pideAsesor(n)) { derivar(conv, ctx, 'SOLICITUD_CLIENTE', t); return; }
  if (esInicio) {
    conv.paso = 'SEGMENTO';
    ctx.respuestas.push(`${bienvenida(conv, ctx)}\n\n${menu()}`);
    const url = CONFIG_BOT.urlConUtm(ctx.config);
    if (url) {
      // Se registra para medir después qué ventas web vinieron del bot (código y UTM).
      ctx.eventos.push({
        mensaje_id: `BIENV-${str(m.mensaje_id)}`, fecha: ctx.ahoraIso, wa_id: conv.wa_id, conversacion_id: conv.conversacion_id,
        direccion: 'SISTEMA', tipo: 'evento', texto: url, media_id: '', resultado: 'BIENVENIDA_WEB', estado_entrega: '',
        detalle: str(ctx.config.codigo_descuento_web),
      });
    }
    return;
  }
  if (m.tipo === 'audio') {
    ctx.respuestas.push(`Por ahora no puedo escuchar audios 🙏 ¿Me lo escribes? Si prefieres, escribe ASESOR y te atiende una persona.\n\n${preguntaActual(conv, ctx)}`);
    return;
  }
  if (/^(menu|inicio|volver al inicio|reiniciar)$/.test(n)) {
    conv.paso = 'SEGMENTO';
    conv.intentos = '0';
    ctx.respuestas.push(conv.producto_id || conv.nombre ? `Tus datos se conservan.\n\n${menu()}` : menu());
    return;
  }
  if (n === 'cancelar') { cancelar(conv, ctx); return; }

  if (conv.paso === 'SEGMENTO' && senales.has('explorando') && FRASE_EXPLORANDO.test(n) && !/^[123]$/.test(n)) {
    // Solo está mirando: no cuenta como respuesta inválida ni se le insiste.
    conv.intentos = '0';
    ctx.respuestas.push(`¡Claro, sin compromiso! Puedes contarme qué producto te interesa cuando quieras y te digo su precio.\n\n${menu()}`);
    return;
  }
  if (conv.paso === 'SEGMENTO') return elegirSegmento(conv, ctx, n, t);
  if (conv.paso === 'RESUMEN') return responderResumen(conv, ctx, n, t);
  if (conv.paso === 'CORREGIR') return responderCorregir(conv, ctx, n, t);
  const campo = CAMPO_DE_PASO[conv.paso];
  if (campo) return responderCampo(conv, ctx, campo, t, n);

  // Paso desconocido o la conversación volvió al bot después de una derivación.
  conv.paso = 'SEGMENTO';
  conv.intentos = '0';
  ctx.respuestas.push(`${saludo(conv, ctx)}\n\n${menu()}`);
}

// config: filas de BOT_CONFIG (o un objeto ya leído). Sin config se usan los valores por defecto.
// productosFuente: filas de BOT_PRODUCTOS (copia de la hoja del negocio), de donde sale el costo para la prioridad.
function procesar({ mensaje, conversacion, catalogo, inventario, config, productosFuente, ahora }) {
  const ahoraIso = ahora || new Date().toISOString();
  const leida = conversacion && str(conversacion.wa_id) ? conversacion : null;
  const modoLeido = leida ? str(leida.modo).trim().toUpperCase() : '';
  const ctx = {
    mensaje, productos: leerCatalogo(catalogo, inventario), ahoraIso, respuestas: [],
    config: Array.isArray(config) ? CONFIG_BOT.leerConfig(config) : { ...CONFIG_BOT.leerConfig([]), ...(config || {}) },
    productosFuente: (productosFuente || []).filter(p => p && str(p.sku).trim()),
    solicitud: null, pauta: null, cliente: null, aviso: null, eventos: [], resultado: 'PROCESADO',
  };

  const conv = leida ? copiarFila(leida) : nuevaConversacion(mensaje, ahoraIso);
  conv.ultima_entrada = str(mensaje.fecha_iso) || ahoraIso;
  if (mensaje.nombre_perfil) conv.nombre_perfil = str(mensaje.nombre_perfil);
  if (!conv.telefono) conv.telefono = str(mensaje.telefono || mensaje.wa_id);

  let esInicio = !leida;
  if (leida && modoLeido === MODO.CERRADO) { reabrir(conv, ahoraIso); esInicio = true; }
  else if (leida && modoLeido !== MODO.BOT && modoLeido !== '') {
    // PENDIENTE_HUMANO, HUMANO o un valor desconocido: se registra la entrada y el bot no responde.
    ctx.resultado = 'SIN_RESPUESTA_ATENCION_HUMANA';
  }
  if (ctx.resultado === 'PROCESADO') {
    conv.modo = MODO.BOT;
    atender(conv, ctx, esInicio);
    // Al derivar ya se calculó (incluida la confirmación); si no, se recalcula con lo reunido hasta ahora.
    if (!ctx.solicitud) calcularIntencion(conv, ctx, false);
  }
  conv.actualizado_en = ahoraIso;

  const fila = copiarFila(conv);
  return {
    wa_id: fila.wa_id,
    conversacion: fila,
    modo_leido: modoLeido,
    respuestas: ctx.respuestas,
    solicitud: ctx.solicitud,
    pauta: ctx.pauta,
    cliente: ctx.cliente,
    aviso: ctx.aviso,
    // Destino del aviso según BOT_CONFIG; vacío = el número de avisos de la configuración de n8n.
    aviso_destino: str(ctx.config.avisos_whatsapp).replace(/\D/g, ''),
    // Eventos extra para BOT_EVENTOS (por ahora, BIENVENIDA_WEB).
    eventos: ctx.eventos,
    resultado_evento: ctx.resultado,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    procesar, leerCatalogo, leerInventario, buscarProductos, calcularIntencion, calcularPrioridad, MODO, SECUENCIAS, MAX_TEXTO,
    COLUMNAS_CONVERSACION, COLUMNAS_EQUIPO_CONVERSACION, COLUMNAS_SOLICITUD, COLUMNAS_CLIENTE, COLUMNAS_EVENTO,
  };
}
