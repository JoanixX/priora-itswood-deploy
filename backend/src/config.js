// Configuración del negocio (pestaña Config). Valores iniciales = app/src/data/configDemo.js, para que la app
// se vea igual con y sin backend. Todo lo marcado [SUPUESTO] espera confirmación de la dueña.

export const CONFIG_INICIAL = {
  negocio: 'ITS WOOD',
  asistente: 'Mermín',
  correo_negocio: 'hola@itswood.pe',
  marca: { colores: { marron_oscuro: '#50280a', marron_medio: '#784b32', verde: '#6e8264', coral: '#eb8278', naranja: '#f09646', crema: '#e6d7c3' } },
  textos: {
    saludo: '¡Hola! Soy Mermín, el asistente de ITS WOOD.',
    aviso_ia: 'Soy un asistente con IA. Si prefieres, te paso con la dueña.',
    no_sabe: 'Esa no la sé. Le paso tu consulta a la dueña y te responde pronto.',
  },
  tono: 'premium',
  bienvenida: {
    mensaje: 'Mira el catálogo completo en nuestra web 👉',
    url_tienda: 'https://itswood.pe',
    texto_boton: 'Ir a la tienda',
    promo_activa: false,
    promo_texto: '10 % de descuento comprando en la web', // [SUPUESTO]
  },
  derivar: { reclamos: true, descuentos: true, disenos_especiales: true, pide_persona: true },
  reglas: { minimo_empresa: 12, umbral_alta: 30, maximo_sin_derivar: 100, dias_fecha_cercana: 14 },
  prioridad: { peso_valor: true, monto_alta: 1000, margen_estimado: 0.5 }, // [SUPUESTO]
  notificaciones: { pedido_alta: true, pedido_derivado: true, resumen_diario: true, canal: 'app' },
  metricas: { tiempo_respuesta_antes_min: null },
};

// Campos que acepta PATCH /config (contrato + campos nuevos). Cualquier otro → 400.
const EDITABLES = ['asistente', 'textos', 'tono', 'reglas', 'derivar', 'bienvenida', 'prioridad', 'notificaciones', 'metricas', 'correo_negocio'];
const esObjeto = (v) => v && typeof v === 'object' && !Array.isArray(v);

/** Mezcla un nivel de profundidad (igual que la app): los objetos se combinan, el resto se reemplaza. */
export function mezclar(base, cambios) {
  const out = structuredClone(base);
  for (const [k, v] of Object.entries(cambios || {})) out[k] = esObjeto(v) && esObjeto(out[k]) ? { ...out[k], ...v } : v;
  return out;
}

/** Devuelve el mensaje de error del primer problema, o null. Mismas reglas que validarConfig de la app. */
export function validarConfig(c) {
  const r = c.reglas || {};
  for (const k of ['minimo_empresa', 'umbral_alta', 'maximo_sin_derivar', 'dias_fecha_cercana']) {
    if (!Number.isInteger(r[k]) || r[k] <= 0) return `${k} debe ser un número entero mayor que 0`;
  }
  if (r.minimo_empresa >= r.umbral_alta) return 'umbral_alta debe ser mayor que minimo_empresa';
  if (r.umbral_alta >= r.maximo_sin_derivar) return 'maximo_sin_derivar debe ser mayor que umbral_alta';
  if (r.dias_fecha_cercana < 1 || r.dias_fecha_cercana > 60) return 'dias_fecha_cercana debe estar entre 1 y 60';
  const nombre = String(c.asistente || '').trim();
  if (nombre.length < 1 || nombre.length > 20) return 'asistente debe tener entre 1 y 20 caracteres';
  const saludo = String(c.textos?.saludo || '').trim();
  if (saludo.length < 1 || saludo.length > 200) return 'saludo debe tener entre 1 y 200 caracteres';
  if (!['cercano', 'formal', 'premium'].includes(c.tono)) return 'tono debe ser cercano, formal o premium';
  const m = c.prioridad?.margen_estimado;
  if (typeof m !== 'number' || m <= 0 || m >= 1) return 'margen_estimado debe estar entre 0 y 1 (por ejemplo 0.5)';
  const ma = c.prioridad?.monto_alta;
  if (c.prioridad?.peso_valor !== false && (typeof ma !== 'number' || ma <= 0)) return 'monto_alta debe ser un monto mayor que 0';
  if (c.bienvenida?.url_tienda && !/^https?:\/\//.test(c.bienvenida.url_tienda)) return 'url_tienda debe empezar con https://';
  const antes = c.metricas?.tiempo_respuesta_antes_min;
  if (antes !== null && antes !== undefined && !(typeof antes === 'number' && antes >= 0)) return 'tiempo_respuesta_antes_min debe ser un número o null';
  return null;
}

/** PATCH /config: { ok, config } o { ok: false, error }. */
export function aplicarCambios(actual, cambios) {
  if (!esObjeto(cambios)) return { ok: false, error: 'El cuerpo debe ser un objeto JSON' };
  const otros = Object.keys(cambios).filter((k) => !EDITABLES.includes(k));
  if (otros.length) return { ok: false, error: `Campo no editable: ${otros.join(', ')}` };
  const nueva = mezclar(actual, cambios);
  const error = validarConfig(nueva);
  return error ? { ok: false, error } : { ok: true, config: nueva };
}
