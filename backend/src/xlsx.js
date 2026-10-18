// Lectura y escritura mínima de .xlsx sin dependencias (un .xlsx es un zip con XML). Alcanza para la primera hoja
// de un catálogo: textos, números y booleanos. Las fórmulas se leen por su último valor calculado.
import { inflateRawSync } from 'node:zlib';

// ---------- zip ----------

function leerZip(buf) {
  let fin = buf.length - 22;
  while (fin >= 0 && buf.readUInt32LE(fin) !== 0x06054b50) fin -= 1;
  if (fin < 0) throw new Error('El archivo no es un .xlsx válido');
  const total = buf.readUInt16LE(fin + 10);
  let p = buf.readUInt32LE(fin + 16);
  const archivos = {};
  for (let i = 0; i < total; i += 1) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('El .xlsx está dañado');
    const metodo = buf.readUInt16LE(p + 10);
    const comprimido = buf.readUInt32LE(p + 20);
    const largoNombre = buf.readUInt16LE(p + 28);
    const largoExtra = buf.readUInt16LE(p + 30);
    const largoComentario = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const nombre = buf.toString('utf8', p + 46, p + 46 + largoNombre);
    const datos = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const crudo = buf.subarray(datos, datos + comprimido);
    archivos[nombre] = () => (metodo === 0 ? crudo : inflateRawSync(crudo));
    p += 46 + largoNombre + largoExtra + largoComentario;
  }
  return archivos;
}

const TABLA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Zip sin compresión (método 0): suficiente para una plantilla pequeña. */
function escribirZip(entradas) {
  const locales = [];
  const centrales = [];
  let desplazamiento = 0;
  for (const [nombre, texto] of entradas) {
    const datos = Buffer.from(texto, 'utf8');
    const n = Buffer.from(nombre, 'utf8');
    const crc = crc32(datos);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(datos.length, 18); local.writeUInt32LE(datos.length, 22); local.writeUInt16LE(n.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(datos.length, 20); central.writeUInt32LE(datos.length, 24); central.writeUInt16LE(n.length, 28);
    central.writeUInt32LE(desplazamiento, 42);
    locales.push(local, n, datos);
    centrales.push(central, n);
    desplazamiento += 30 + n.length + datos.length;
  }
  const dir = Buffer.concat(centrales);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(entradas.length, 8); fin.writeUInt16LE(entradas.length, 10);
  fin.writeUInt32LE(dir.length, 12); fin.writeUInt32LE(desplazamiento, 16);
  return Buffer.concat([...locales, dir, fin]);
}

// ---------- xml ----------

const desescapar = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&');
const escapar = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const textos = (xml) => [...xml.matchAll(/<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/g)].map((m) => desescapar(m[1])).join('');

function columna(ref) {
  let n = 0;
  for (const ch of ref.replace(/\d+$/, '')) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Primera hoja del .xlsx → matriz de valores (texto o número). */
export function leerXlsx(buf) {
  const zip = leerZip(buf);
  const texto = (nombre) => (zip[nombre] ? zip[nombre]().toString('utf8') : null);
  const compartidos = [...(texto('xl/sharedStrings.xml') || '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textos(m[1]));
  // Primera hoja según el libro; si no se encuentra, la primera worksheet del zip.
  let ruta = null;
  const libro = texto('xl/workbook.xml');
  const rels = texto('xl/_rels/workbook.xml.rels');
  const rid = libro && (libro.match(/<sheet\b[^>]*\br:id="([^"]+)"/) || [])[1];
  const destino = rid && rels && (rels.match(new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*Target="([^"]+)"`)) || rels.match(new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${rid}"`)) || [])[1];
  if (destino) ruta = destino.startsWith('/') ? destino.slice(1) : `xl/${destino.replace(/^\.\//, '')}`;
  if (!ruta || !zip[ruta]) ruta = Object.keys(zip).filter((k) => /^xl\/worksheets\/[^/]+\.xml$/.test(k)).sort()[0];
  if (!ruta) throw new Error('El .xlsx no tiene hojas');
  const hoja = texto(ruta);
  const filas = [];
  for (const [, atributosFila, contenido] of hoja.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const numero = Number((atributosFila.match(/\br="(\d+)"/) || [])[1] || filas.length + 1) - 1;
    const fila = [];
    for (const m of contenido.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = m[1];
      const cuerpo = m[2] || '';
      const ref = (attrs.match(/\br="([A-Z]+\d+)"/) || [])[1];
      const tipo = (attrs.match(/\bt="([^"]+)"/) || [])[1];
      const v = (cuerpo.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      let valor = '';
      if (tipo === 's') valor = compartidos[Number(v)] ?? '';
      else if (tipo === 'inlineStr') valor = textos(cuerpo);
      else if (tipo === 'b') valor = v === '1';
      else if (tipo === 'str' || tipo === 'e') valor = v ? desescapar(v) : '';
      else if (v !== undefined) valor = Number(v);
      fila[ref ? columna(ref) : fila.length] = valor;
    }
    filas[numero] = Array.from(fila, (x) => (x === undefined ? '' : x));
  }
  return Array.from(filas, (f) => f || []);
}

/** Matriz → .xlsx de una hoja (textos como inlineStr, números como número). */
export function escribirXlsx(filas, nombreHoja = 'Hoja1') {
  const letra = (i) => {
    let s = '';
    for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    return s;
  };
  const celdas = filas.map((fila, r) => `<row r="${r + 1}">${fila.map((v, c) => {
    const ref = `${letra(c)}${r + 1}`;
    return typeof v === 'number' ? `<c r="${ref}"><v>${v}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t>${escapar(v ?? '')}</t></is></c>`;
  }).join('')}</row>`).join('');
  return escribirZip([
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapar(nombreHoja)}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],
    ['xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${celdas}</sheetData></worksheet>`],
  ]);
}
