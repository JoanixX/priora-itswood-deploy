// Conversión de textos del Excel de ventas a datos limpios.
// Lo usan el script de anonimización, la subida de catálogo y las pruebas.

/** "S/.1,180.00" → 1180. Devuelve null si no hay número. */
export function parseMonto(valor) {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  const limpio = String(valor).replace(/S\/\.?/gi, '').replace(/,/g, '').replace(/\s/g, '');
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

/** "5/9/2026" (d/m/aaaa) → "2026-09-05". Devuelve null si no es fecha. */
export function parseFecha(valor) {
  if (!valor) return null;
  const m = String(valor).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mes, a] = m.map(Number);
  if (mes < 1 || mes > 12 || d < 1 || d > 31) return null;
  return `${a}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Cantidad entera o null ("listo" → null). */
export function parseCantidad(valor) {
  const n = Number(String(valor ?? '').trim());
  return Number.isInteger(n) && n > 0 ? n : null;
}

const quitarTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

export function normalizarPlataforma(valor) {
  const v = quitarTildes(String(valor || '').trim().toUpperCase());
  if (!v) return 'Otro';
  if (v.includes('WHATSAPP')) return 'WhatsApp';
  if (v.startsWith('PAUTA') || v.startsWith('PUBLICIDAD')) return 'Pauta';
  if (v.includes('TIKTOK')) return 'TikTok';
  if (v.includes('INSTAGRAM')) return 'Instagram';
  if (v === 'WEB') return 'Web';
  if (v.startsWith('CLIENTE A')) return 'Cliente antiguo';
  if (v.includes('ORGANICO')) return 'Orgánico';
  return 'Otro';
}

export function normalizarEstado(valor) {
  const v = String(valor || '').trim().toUpperCase();
  if (v === 'ENTREGADO') return 'Entregado';
  if (v === 'NUEVA OT') return 'Nueva OT';
  if (v === 'CANTIDAD COMPLETA') return 'Cantidad completa';
  if (v === 'ENVIADO') return 'Enviado';
  return 'Pendiente';
}

const RAZON_SOCIAL = /\b(S\.?A\.?C|S\.?R\.?L|E\.?I\.?R\.?L|S\.?A\.?A|S\.A\.)\b|\b\d{11}\b/i;

/** empresa si el nombre parece razón social o si pidió 12 o más unidades. */
export function deducirTipo(nombre, cantidad, minimoEmpresa = 12) {
  if (RAZON_SOCIAL.test(String(nombre || ''))) return 'empresa';
  return (cantidad || 0) >= minimoEmpresa ? 'empresa' : 'persona';
}

const GRABADO = /grab|nombre|logo|frase|texto|letra|inicial|dedica|personaliz|"|“|para [a-záéíóú]/i;
export function huboGrabado(detalles) {
  return GRABADO.test(String(detalles || ''));
}

export function normalizarTelefono(valor) {
  const d = String(valor || '').replace(/\D/g, '');
  return d.length >= 9 ? d.slice(-9) : null;
}

export function normalizarNombre(valor) {
  return quitarTildes(String(valor || '').trim().toLowerCase()).replace(/\s+/g, ' ');
}

export function tituloBonito(valor) {
  return String(valor || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

const PARECE_DIRECCION = /\d|\b(av|avenida|calle|jr|jiron|psje|pasaje|mz|lote|urb)\b\.?/i;

/** Deja solo el distrito. Si alguien escribió una dirección completa, se queda con la parte sin números. */
export function limpiarDistrito(valor) {
  const partes = String(valor || '').split(',').map((p) => p.trim()).filter(Boolean);
  const distrito = partes.find((p) => !PARECE_DIRECCION.test(p) && p.length >= 3);
  return distrito ? tituloBonito(distrito) : null;
}
