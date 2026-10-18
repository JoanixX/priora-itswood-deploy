const soles = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const solesDec = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatoSoles = (n, decimales = false) =>
  n === null || n === undefined || Number.isNaN(n) ? '—' : `S/ ${(decimales ? solesDec : soles).format(n)}`;

export const formatoNumero = (n) => (n === null || n === undefined ? '—' : soles.format(n));
export const formatoPct = (x) => (x === null || x === undefined ? '—' : `${Math.round(x * 100)} %`);

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export const nombreMes = (yyyymm, largo = false) => {
  const [a, m] = yyyymm.split('-').map(Number);
  return largo ? `${MESES_LARGOS[m - 1]} ${a}` : MESES[m - 1];
};

export function formatoFecha(iso) {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MESES[m - 1]}${a !== new Date().getFullYear() ? ` ${a}` : ''}`;
}

export function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function sumarDias(iso, dias) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Días desde hoy hasta la fecha (negativo si ya pasó). */
export function diasRestantes(iso, hoy = hoyISO()) {
  if (!iso) return null;
  return Math.round((new Date(`${iso.slice(0, 10)}T12:00:00`) - new Date(`${hoy}T12:00:00`)) / 86400000);
}

export function textoDias(dias) {
  if (dias === null || dias === undefined) return '—';
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Mañana';
  if (dias < 0) return `Hace ${-dias} d`;
  return `${dias} días`;
}
