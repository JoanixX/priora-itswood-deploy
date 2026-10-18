// Catálogo: validación de la subida (.xlsx o .csv), plantilla y conversión a Producto. Mismas reglas que
// app/src/lib/catalogo.js para que la vista previa del frontend y la del backend coincidan.
import { leerXlsx, escribirXlsx } from './xlsx.js';
import { parseMonto, claveColumna } from './formato.js';

export const COLUMNAS_CATALOGO = ['producto', 'categoria', 'precio', 'stock', 'descripcion'];
const MAX_FILAS = 2000;

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

/** CSV con comas o punto y coma (Excel en español), comillas y BOM. */
export function leerCsv(texto) {
  const t = texto.replace(/^﻿/, '');
  const primera = t.split(/\r?\n/, 1)[0] || '';
  const sep = (primera.match(/;/g) || []).length > (primera.match(/,/g) || []).length ? ';' : ',';
  const filas = [];
  let fila = [];
  let celda = '';
  let comillas = false;
  for (let i = 0; i < t.length; i += 1) {
    const ch = t[i];
    if (comillas) {
      if (ch === '"' && t[i + 1] === '"') { celda += '"'; i += 1; } else if (ch === '"') comillas = false; else celda += ch;
    } else if (ch === '"') comillas = true;
    else if (ch === sep) { fila.push(celda); celda = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i += 1;
      fila.push(celda); filas.push(fila); fila = []; celda = '';
    } else celda += ch;
  }
  if (celda !== '' || fila.length) { fila.push(celda); filas.push(fila); }
  return filas;
}

/** Matriz (encabezado + filas) → objetos con claves en minúscula y sin tildes. */
export function aObjetos(matriz) {
  const [encabezado = [], ...resto] = matriz;
  const claves = encabezado.map(claveColumna);
  return resto
    .filter((f) => f.some((v) => String(v ?? '').trim() !== ''))
    .map((f) => Object.fromEntries(claves.map((k, i) => [k, f[i] ?? ''])));
}

/** Archivo subido → filas. Detecta xlsx por la firma del zip, no por la extensión. */
export function leerArchivo(nombre, buf) {
  const esZip = buf.length > 4 && buf.readUInt32LE(0) === 0x04034b50;
  if (esZip) return aObjetos(leerXlsx(buf));
  if (/\.xlsx?$/i.test(nombre || '')) throw new Error('No pude leer el Excel. Guárdalo como .xlsx o .csv y vuelve a subirlo.');
  return aObjetos(leerCsv(buf.toString('utf8')));
}

export function catalogoDesdeFilas(filas) {
  return filas
    .filter((f) => String(f.producto || f.nombre || '').trim())
    .map((f, i) => {
      const nombre = String(f.producto || f.nombre).trim();
      const stockTexto = String(f.stock ?? '').trim();
      const stock = stockTexto === '' ? null : Number(stockTexto);
      return {
        id: String(f.id || '').trim() || `PR-${String(i + 1).padStart(4, '0')}`,
        nombre,
        categoria: String(f.categoria || '').trim() || categoriaDe(nombre),
        precio: parseMonto(f.precio) ?? 0,
        stock: Number.isFinite(stock) ? stock : null,
        descripcion: String(f.descripcion || '').trim(),
        imagen_url: String(f.imagen_url || '').trim() || null,
      };
    });
}

export function validarCatalogo(filas) {
  if (!filas.length) return { valido: false, filas: 0, errores: ['El archivo no tiene filas.'], vista_previa: [] };
  const errores = [];
  if (filas.length > MAX_FILAS) errores.push(`El catálogo admite hasta ${MAX_FILAS} productos.`);
  const faltan = COLUMNAS_CATALOGO.filter((c) => !(c in filas[0]));
  if (faltan.length) errores.push(`Faltan columnas: ${faltan.join(', ')}. Descarga la plantilla para ver el formato.`);
  filas.forEach((f, i) => {
    const n = i + 2; // la fila 1 es el encabezado
    if (!String(f.producto || '').trim()) errores.push(`Fila ${n}: falta el nombre del producto`);
    if (parseMonto(f.precio) === null) errores.push(`Fila ${n}: precio no es un número`);
    if (String(f.stock ?? '').trim() !== '' && !Number.isInteger(Number(f.stock))) errores.push(`Fila ${n}: stock debe ser un número entero o quedar vacío`);
  });
  return { valido: errores.length === 0, filas: filas.length, errores: errores.slice(0, 100), vista_previa: catalogoDesdeFilas(filas.slice(0, 10)) };
}

export function plantilla() {
  return escribirXlsx([COLUMNAS_CATALOGO, ['Posacelular TRAPECIO', 'Oficina', 28, 12, 'Posacelular de madera con grabado']], 'Catalogo');
}
