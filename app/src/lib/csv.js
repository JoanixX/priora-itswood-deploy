const celda = (v) => {
  const t = String(v ?? '');
  return /[",\n;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

export function aCsv(filas) {
  if (!filas.length) return '';
  const cols = Object.keys(filas[0]);
  return [cols.join(','), ...filas.map((f) => cols.map((c) => celda(f[c])).join(','))].join('\n');
}

export function descargarCsv(nombre, filas) {
  // BOM para que Excel lea bien las tildes.
  const blob = new Blob(['﻿' + aCsv(filas)], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(a.href);
}
