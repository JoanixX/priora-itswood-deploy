import * as XLSX from 'xlsx';
import { parseMonto } from './parse.js';

export const COLUMNAS_CATALOGO = ['producto', 'categoria', 'precio', 'stock', 'descripcion'];

export function categoriaDe(nombre) {
  const n = nombre.toLowerCase();
  if (/sacramento|cruz|bendici/.test(n)) return 'Sacramentos';
  if (/navide|navidad|tree/.test(n)) return 'Navidad';
  if (/tabla|cuchillo|plato|parriller/.test(n)) return 'Cocina y parrilla';
  if (/picnic|copas|vino|corcho/.test(n)) return 'Picnic y vino';
  if (/laptop|dock|post-it|ecodesk|reloj|parlante|posacelular|llaves/.test(n)) return 'Oficina';
  if (/posataza|taza|posavaso/.test(n)) return 'Café y té';
  if (/portarretrato|portavela|joyero|espejo/.test(n)) return 'Hogar y regalo';
  return 'Otros';
}

/** Filas del CSV del catálogo de ITS WOOD → Producto del contrato. */
export function catalogoDesdeFilas(filas) {
  return filas
    .filter((f) => f.nombre || f.producto)
    .map((f, i) => {
      const nombre = String(f.nombre || f.producto).trim();
      const stock = f.stock === '' || f.stock === undefined || f.stock === null ? null : Number(f.stock);
      return {
        id: f.id || `PR-LOCAL-${i + 1}`,
        nombre,
        categoria: f.categoria || categoriaDe(nombre),
        precio: parseMonto(f.precio_unitario_web_S ?? f.precio) ?? 0,
        stock: Number.isFinite(stock) ? stock : null,
        descripcion: f.descripcion || '',
        imagen_url: null,
      };
    });
}

/** Lee un .xlsx o .csv subido y devuelve filas como objetos con las claves en minúscula. */
export async function leerArchivo(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const hoja = wb.Sheets[wb.SheetNames[0]];
  const filas = XLSX.utils.sheet_to_json(hoja, { defval: '', raw: false });
  return filas.map((f) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k.trim().toLowerCase(), v])));
}

/** Misma validación que POST /catalogo/validar, para el modo ejemplo. */
export function validarCatalogo(filas) {
  const errores = [];
  if (!filas.length) return { valido: false, filas: 0, errores: ['El archivo no tiene filas.'], vista_previa: [] };
  const faltan = COLUMNAS_CATALOGO.filter((c) => !(c in filas[0]));
  if (faltan.length) errores.push(`Faltan columnas: ${faltan.join(', ')}. Descarga la plantilla para ver el formato.`);
  filas.forEach((f, i) => {
    const n = i + 2; // fila 1 es el encabezado
    if (!String(f.producto || '').trim()) errores.push(`Fila ${n}: falta el nombre del producto`);
    if (parseMonto(f.precio) === null) errores.push(`Fila ${n}: precio no es un número`);
    if (String(f.stock ?? '').trim() !== '' && !Number.isInteger(Number(f.stock))) errores.push(`Fila ${n}: stock debe ser un número entero o quedar vacío`);
  });
  return {
    valido: errores.length === 0,
    filas: filas.length,
    errores,
    vista_previa: catalogoDesdeFilas(filas.slice(0, 10)),
  };
}

export function descargarPlantilla() {
  const ws = XLSX.utils.aoa_to_sheet([COLUMNAS_CATALOGO, ['Posacelular TRAPECIO', 'Oficina', 28, 12, 'Posacelular de madera con grabado']]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Catalogo');
  XLSX.writeFile(wb, 'plantilla_catalogo_priora.xlsx');
}
