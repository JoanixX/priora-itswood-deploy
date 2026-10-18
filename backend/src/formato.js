// Fechas y montos con las mismas reglas que app/src/lib/format.js. El proceso corre con TZ=America/Lima
// (lo fija src/index.js), así "hoy" es el mismo día que ve la dueña.

const soles = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export const formatoSoles = (n) => (n === null || n === undefined || Number.isNaN(n) ? '—' : `S/ ${soles.format(n)}`);

export function formatoFecha(iso) {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MESES[m - 1]}${a !== new Date().getFullYear() ? ` ${a}` : ''}`;
}

export function hoyISO(fecha = new Date()) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

export function sumarDias(iso, dias) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return hoyISO(d);
}

/** Días desde hoy hasta la fecha (negativo si ya pasó). */
export function diasRestantes(iso, hoy = hoyISO()) {
  if (!iso) return null;
  return Math.round((new Date(`${iso.slice(0, 10)}T12:00:00`) - new Date(`${hoy}T12:00:00`)) / 86400000);
}

/** "S/.1,180.00" → 1180. null si no hay número. */
export function parseMonto(valor) {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  const limpio = String(valor).replace(/S\/\.?/gi, '').replace(/,/g, '').replace(/\s/g, '');
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

/** "5/9/2026" (d/m/aaaa) o "2026-09-05" → "2026-09-05". null si no es fecha. */
export function parseFecha(valor) {
  if (!valor) return null;
  const s = String(valor).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mes, a] = m.map(Number);
  if (mes < 1 || mes > 12 || d < 1 || d > 31) return null;
  return `${a}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export const sinTildes = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
/** Encabezado de hoja → clave comparable: "Fecha de Pedido " → "fecha de pedido". */
export const claveColumna = (s) => sinTildes(s).trim().toLowerCase().replace(/\s+/g, ' ');
