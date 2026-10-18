// Lee la pestaña "Ventas 2026" (CSV o XLSX en ref/) y genera
// src/data/ventas_2026.demo.json sin datos personales.
// Uso: npm run anonimizar [-- ruta/al/archivo]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';
import {
  parseMonto, parseFecha, parseCantidad, normalizarPlataforma, normalizarEstado,
  deducirTipo, huboGrabado, normalizarTelefono, normalizarNombre, tituloBonito, limpiarDistrito,
} from '../src/lib/parse.js';
import { catalogoDesdeFilas } from '../src/lib/catalogo.js';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const refDir = path.resolve(aqui, '../../ref');
const candidatos = [process.argv[2], path.join(refDir, 'ventas_2026.csv'), path.join(refDir, 'ventas_2026_itswood.xlsx')].filter(Boolean);
const origen = candidatos.find((p) => fs.existsSync(p));
if (!origen) {
  console.error('No encontré el archivo de ventas en ref/. Pon ventas_2026.csv o ventas_2026_itswood.xlsx.');
  process.exit(1);
}

const wb = XLSX.read(fs.readFileSync(origen), { type: 'buffer', raw: origen.endsWith('.csv') });
const hoja = wb.Sheets[wb.SheetNames.find((n) => /ventas/i.test(n)) || wb.SheetNames[0]];
const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, raw: false, defval: '' });

const cab = filas[0].map((c) => String(c).trim().toUpperCase());
const col = (nombre) => cab.findIndex((c) => c === nombre || c.startsWith(nombre));
const C = {
  fechaPedido: col('FECHA DE PEDIDO'), nombre: col('NOMBRE'), plataforma: col('PLATAFORMA'),
  fechaEntrega: col('FECHA ENTREGA'), telefono: col('TELEFONO'), distrito: col('DISTRITO'),
  producto: col('LISTADO DE PRODUCTOS'), cantidad: col('CANTIDAD'), precio: col('PRECIO UNT'),
  delivery: col('DELIVERY'), monto: col('MONTO TOTAL'), detalles: col('DETALLES'),
};
C.estado = col('CTA DESTINO') + 1; // columna sin título que sigue a "CTA DESTINO"

const aliasPorTelefono = new Map();
const aliasPorNombre = new Map();
let siguiente = 1;
function aliasDe(nombre, telefono) {
  const tel = normalizarTelefono(telefono);
  const nom = normalizarNombre(nombre);
  let alias = (tel && aliasPorTelefono.get(tel)) || aliasPorNombre.get(nom);
  if (!alias) alias = `Cliente ${String(siguiente++).padStart(3, '0')}`;
  if (tel) aliasPorTelefono.set(tel, alias);
  aliasPorNombre.set(nom, alias);
  return alias;
}

const ventas = [];
for (const f of filas.slice(1)) {
  const nombre = String(f[C.nombre] || '').trim();
  if (!nombre) continue;
  const cantidad = parseCantidad(f[C.cantidad]);
  const precio = parseMonto(f[C.precio]);
  const delivery = parseMonto(f[C.delivery]) || 0;
  // MONTO TOTAL suele venir vacío (fórmula sin valor): se calcula.
  const monto = parseMonto(f[C.monto]) ?? ((cantidad || 0) * (precio || 0) + delivery);
  const fechaEntrega = parseFecha(f[C.fechaEntrega]);
  ventas.push({
    id: `H-${String(ventas.length + 1).padStart(4, '0')}`,
    cliente: aliasDe(nombre, f[C.telefono]),
    tipo: deducirTipo(nombre, cantidad),
    fecha_pedido: parseFecha(f[C.fechaPedido]) || fechaEntrega,
    fecha_entrega: fechaEntrega,
    plataforma: normalizarPlataforma(f[C.plataforma]),
    distrito: limpiarDistrito(f[C.distrito]),
    producto: tituloBonito(f[C.producto]),
    cantidad,
    precio_unitario: precio,
    delivery,
    monto: Math.round(monto * 100) / 100,
    estado: normalizarEstado(f[C.estado]),
    grabado: huboGrabado(f[C.detalles]),
  });
}

const destino = path.resolve(aqui, '../src/data/ventas_2026.demo.json');
fs.writeFileSync(destino, JSON.stringify(ventas, null, 1) + '\n');
const total = ventas.reduce((a, v) => a + v.monto, 0);
console.log(`Listo: ${ventas.length} registros, ${siguiente - 1} clientes, S/ ${total.toFixed(2)} → ${path.relative(process.cwd(), destino)}`);

// El catálogo no tiene datos personales: se copia tal cual a JSON para el modo ejemplo.
const catalogoCsv = path.join(refDir, 'catalogo_itswood.csv');
if (fs.existsSync(catalogoCsv)) {
  const wbCat = XLSX.read(fs.readFileSync(catalogoCsv, 'utf8'), { type: 'string', raw: true });
  const filasCat = XLSX.utils.sheet_to_json(wbCat.Sheets[wbCat.SheetNames[0]], { defval: '', raw: false });
  const destinoCat = path.resolve(aqui, '../src/data/catalogo.demo.json');
  fs.writeFileSync(destinoCat, JSON.stringify(catalogoDesdeFilas(filasCat), null, 1) + '\n');
  console.log(`Catálogo: ${filasCat.length} productos → ${path.relative(process.cwd(), destinoCat)}`);
}
