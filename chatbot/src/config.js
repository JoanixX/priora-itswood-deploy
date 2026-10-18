'use strict';

// Configuración editable del bot: pestaña BOT_CONFIG con las columnas clave | valor | descripcion.
// El dashboard la cambia por la API y el bot la lee en cada mensaje. Una clave vacía o ausente toma el valor
// por defecto. Sin dependencias: se usa en los nodos Code de n8n y en el simulador.

const CONFIG_POR_DEFECTO = {
  nombre_bot: 'Mermín',
  nombre_negocio: 'ITS WOOD',
  tono: 'cercano',
  emoji_bot: '🌳',
  url_web: '',
  codigo_descuento_web: 'WEB10',
  porcentaje_descuento_web: '10',
  // Vacío: se usa la plantilla del tono elegido (ver plantillaBienvenida).
  mensaje_bienvenida: '',
  drive_folder_id: '',
  sheet_fuente_id: '',
  ultima_sync: '',
  margen_por_defecto: '0.40',
  umbral_prioridad_alta: '70',
  umbral_prioridad_media: '40',
  // Topes con los que se normalizan valor, ganancia y cantidad en la prioridad (recortados a 1).
  tope_valor: '3000',
  tope_ganancia: '1200',
  tope_cantidad: '50',
  tfr_antes_minutos: '180',
  avisos_whatsapp: '',
  avisos_email: '',
  hora_resumen_diario: '19:00',
};

const DESCRIPCIONES_CONFIG = {
  nombre_bot: 'Nombre con el que se presenta el bot.',
  nombre_negocio: 'Nombre del negocio en los mensajes.',
  tono: 'cercano (tutea) o formal (trata de usted).',
  emoji_bot: 'Emoji que acompaña al nombre del bot.',
  url_web: 'Tienda web a la que se redirige en el primer mensaje. Vacío = sin enlace.',
  codigo_descuento_web: 'Código de descuento para comprar en la web.',
  porcentaje_descuento_web: 'Porcentaje del descuento web (solo el número).',
  mensaje_bienvenida: 'Plantilla del primer mensaje: {hola}, {nombre_bot}, {emoji_bot}, {nombre_negocio}, {porcentaje}, {codigo}, {url}. Vacío = plantilla del tono.',
  drive_folder_id: 'Carpeta de Drive con la hoja MERMIN_FUENTE. Se llena desde el dashboard.',
  sheet_fuente_id: 'Hoja fuente detectada por la sincronización.',
  ultima_sync: 'Fecha de la última sincronización correcta.',
  margen_por_defecto: 'Margen para productos sin costo (0.40 = 40 %).',
  umbral_prioridad_alta: 'Puntaje desde el que un lead es ALTA.',
  umbral_prioridad_media: 'Puntaje desde el que un lead es MEDIA.',
  tope_valor: 'Valor (S/) que cuenta como 100 % en la prioridad.',
  tope_ganancia: 'Ganancia (S/) que cuenta como 100 % en la prioridad.',
  tope_cantidad: 'Unidades que cuentan como 100 % en la prioridad.',
  tfr_antes_minutos: 'Tiempo de primera respuesta antes del bot, en minutos (línea base manual).',
  avisos_whatsapp: 'WhatsApp que recibe los avisos de leads ALTA (con código de país).',
  avisos_email: 'Correos que reciben los resúmenes, separados por coma.',
  hora_resumen_diario: 'Hora del resumen diario (HH:MM, hora de Lima).',
};

// Claves que el dashboard no edita con PUT /config: las escribe la sincronización o POST /config/drive.
const CLAVES_SOLO_LECTURA = ['sheet_fuente_id', 'ultima_sync', 'drive_folder_id'];

const PLANTILLAS_BIENVENIDA = {
  cercano: '{hola} Soy {nombre_bot} {emoji_bot}, el asistente de {nombre_negocio}. {web}\n¿Prefieres que te ayude por aquí? Cuéntame si es para tu *empresa* o para *ti*.',
  formal: '{hola} Soy {nombre_bot} {emoji_bot}, el asistente de {nombre_negocio}. {web}\n¿Prefiere que le ayude por aquí? Indíqueme si es para su *empresa* o para *usted*.',
};

function cfgTexto(v) { return v === undefined || v === null ? '' : String(v).trim(); }

// Filas de BOT_CONFIG -> objeto con todas las claves (las desconocidas también se conservan).
function leerConfig(filas) {
  const config = { ...CONFIG_POR_DEFECTO };
  for (const f of filas || []) {
    const clave = cfgTexto(f && f.clave);
    const valor = cfgTexto(f && f.valor);
    if (clave && valor !== '') config[clave] = valor;
  }
  config.tono = config.tono.toLowerCase() === 'formal' ? 'formal' : 'cercano';
  return config;
}

function numeroConfig(config, clave) {
  const n = Number(cfgTexto(config[clave]).replace(',', '.'));
  return Number.isFinite(n) ? n : Number(CONFIG_POR_DEFECTO[clave]);
}

// Reemplaza {clave} por su valor; las claves sin valor quedan vacías.
function render(plantilla, valores) {
  return cfgTexto(plantilla).replace(/\{(\w+)\}/g, (_, k) => cfgTexto((valores || {})[k]));
}

function slug(v) {
  return cfgTexto(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// URL de la web con UTM: así se mide qué ventas web vinieron del bot.
function urlConUtm(config) {
  const url = cfgTexto(config.url_web);
  if (!url) return '';
  return `${url}${url.includes('?') ? '&' : '?'}utm_source=whatsapp&utm_campaign=${slug(config.nombre_bot) || 'bot'}`;
}

function valoresPlantilla(config, extra) {
  return {
    ...config,
    porcentaje: config.porcentaje_descuento_web,
    codigo: config.codigo_descuento_web,
    url: urlConUtm(config),
    ...(extra || {}),
  };
}

// Frase de la web con el descuento, o vacía si no hay URL.
function fraseWeb(config) {
  const url = urlConUtm(config);
  if (!url) return '';
  const compra = config.tono === 'formal' ? 'Compre' : 'Compra';
  const lleva = config.tono === 'formal' ? 'llévese' : 'llévate';
  const codigo = cfgTexto(config.codigo_descuento_web);
  const pct = cfgTexto(config.porcentaje_descuento_web);
  const descuento = pct && codigo ? ` y ${lleva} *${pct}% de descuento* con el código *${codigo}*` : '';
  return `*${compra} en nuestra web*${descuento} 👉 ${url}`;
}

function plantillaBienvenida(config) {
  return cfgTexto(config.mensaje_bienvenida) || PLANTILLAS_BIENVENIDA[config.tono] || PLANTILLAS_BIENVENIDA.cercano;
}

function mensajeBienvenida(config, nombre) {
  const formal = config.tono === 'formal';
  const hola = nombre ? `¡Hola de nuevo, ${nombre}!` : formal ? '¡Buen día!' : '¡Hola!';
  const texto = render(plantillaBienvenida(config), valoresPlantilla(config, { hola, web: fraseWeb(config) }));
  // Sin URL la frase de la web queda vacía: se limpian los espacios que deja.
  return texto.replace(/[ \t]+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').trim();
}

// Cambios pedidos por el dashboard ({ clave: valor }) -> filas a guardar, o error.
function validarCambiosConfig(cambios) {
  if (!cambios || typeof cambios !== 'object' || Array.isArray(cambios)) return { ok: false, error: 'El cuerpo debe ser un objeto { clave: valor }.' };
  const filas = [];
  for (const [clave, bruto] of Object.entries(cambios)) {
    if (!(clave in CONFIG_POR_DEFECTO)) return { ok: false, error: `Clave desconocida: ${clave}.` };
    if (CLAVES_SOLO_LECTURA.includes(clave)) return { ok: false, error: `${clave} no se edita con PUT /config.` };
    const valor = cfgTexto(bruto);
    if (valor.length > 1000) return { ok: false, error: `${clave} admite hasta 1000 caracteres.` };
    if (clave === 'tono' && valor && !['cercano', 'formal'].includes(valor.toLowerCase())) return { ok: false, error: 'tono debe ser cercano o formal.' };
    if (clave === 'hora_resumen_diario' && valor && !/^([01]?\d|2[0-3]):[0-5]\d$/.test(valor)) return { ok: false, error: 'hora_resumen_diario debe ser HH:MM.' };
    if (clave === 'url_web' && valor && !/^https?:\/\/\S+$/.test(valor)) return { ok: false, error: 'url_web debe empezar por http:// o https://.' };
    const numericas = ['margen_por_defecto', 'umbral_prioridad_alta', 'umbral_prioridad_media', 'tope_valor', 'tope_ganancia', 'tope_cantidad', 'tfr_antes_minutos', 'porcentaje_descuento_web'];
    if (numericas.includes(clave) && valor && !(Number(valor.replace(',', '.')) >= 0)) return { ok: false, error: `${clave} debe ser un número.` };
    filas.push({ clave, valor, descripcion: DESCRIPCIONES_CONFIG[clave] || '' });
  }
  if (!filas.length) return { ok: false, error: 'No hay cambios.' };
  return { ok: true, filas };
}

// Filas iniciales de BOT_CONFIG (plantilla de la hoja).
function filasConfigIniciales() {
  return Object.keys(CONFIG_POR_DEFECTO).map(clave => ({ clave, valor: CONFIG_POR_DEFECTO[clave], descripcion: DESCRIPCIONES_CONFIG[clave] || '' }));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    leerConfig, render, numeroConfig, urlConUtm, fraseWeb, mensajeBienvenida, valoresPlantilla, validarCambiosConfig,
    filasConfigIniciales, CONFIG_POR_DEFECTO, DESCRIPCIONES_CONFIG, CLAVES_SOLO_LECTURA, COLUMNAS_CONFIG: ['clave', 'valor', 'descripcion'],
  };
}
