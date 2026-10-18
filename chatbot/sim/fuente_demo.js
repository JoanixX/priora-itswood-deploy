'use strict';

// Datos de ejemplo de la hoja MERMIN_FUENTE (pestañas PRODUCTOS, CLIENTES y VENTAS), tal como los devuelve el nodo
// de Google Sheets: todo texto. Sirven para las pruebas, para el simulador y para la plantilla que se entrega al negocio.
// Fechas pensadas para el 17/10/2026: hay un cliente de cada segmento de fidelización.

const PRODUCTOS = [
  ['PR-492A873B', 'Tabla Quesera - ROMA', 'Tablas queseras', '85', '45', '6', 'SI'],
  ['PR-4966E8E6', 'Tabla Quesera - TOSCANA', 'Tablas queseras', '110', '60', '4', 'SI'],
  ['PR-4D383833', 'Posataza para cafe - Koi', 'Posatazas', '45', '18', '20', 'SI'],
  ['PR-425592EB', 'Posataza Corazon - LATTE', 'Posatazas', '58', '25', '10', 'SI'],
  ['PR-4A398B5B', 'Tabla Parrillera - Brasa', 'Parrilla', '130', '70', '8', 'SI'],
  ['PR-4325996A', 'Plato Parrillero - T-Bone', 'Parrilla', '90', '45', '29', 'SI'],
  ['PR-432598B6', 'Mesa Picnic Plegable - YARD', 'Picnic', '175', '95', '5', 'SI'],
  ['PR-4B577D89', 'CERA DE ABEJA PARA MADERA 90ML', 'Cuidado', '35', '', '30', 'SI'],
  ['PR-459E2D67', 'Espejo de Bolsillo - AURA', 'Accesorios', '23', '9', '0', 'SI'],
].map(([sku, nombre, categoria, precio, costo, stock, activo]) => ({ sku, nombre, categoria, precio, costo, stock, activo }));

const CLIENTES = [
  ['C001', 'Acme SAC', '987000002', 'compras@acme.example', 'EMPRESA', '01/03/2026', 'SI'],
  ['C002', 'Ana Pérez', '+51 987 000 001', 'ana@example.com', 'PERSONA', '2026-05-10', 'SI'],
  ['C003', 'Bruno Díaz', '51987000003', 'bruno@example.com', 'PERSONA', '2026-08-30', 'SI'],
  ['C004', 'Carla Ruiz', '987000004', 'carla@example.com', 'PERSONA', '2026-10-07', 'SI'],
  ['C005', 'Diego Soto', '987000005', 'diego@example.com', 'PERSONA', '2026-05-20', 'SI'],
  ['C006', 'Elena Vargas', '987000006', 'elena@example.com', 'PERSONA', '2026-08-28', 'NO'],
  ['C007', 'Fernando León', '987000007', '', 'persona', '2026-10-01', ''],
].map(([cliente_id, nombre, telefono, email, tipo, fecha_registro, acepta_marketing]) => ({ cliente_id, nombre, telefono, email, tipo, fecha_registro, acepta_marketing }));

const VENTAS = [
  ['10/04/2026', 'P001', 'C001', 'PR-4D383833', '60', '2700', 'WHATSAPP', ''],
  ['2026-09-20', 'P002', 'C001', 'PR-492A873B', '30', '2550', 'WHATSAPP', ''],
  ['2026-06-01', 'P003', 'C002', 'PR-492A873B', '1', '85', 'WEB', 'WEB10'],
  ['2026-06-01', 'P003', 'C002', 'PR-4D383833', '2', '90', 'WEB', 'WEB10'],
  ['2026-08-15', 'P004', 'C002', 'PR-4966E8E6', '1', '110', 'WEB', ''],
  ['2026-10-05', 'P005', 'C002', 'PR-4A398B5B', '1', '130', 'TIENDA', ''],
  ['2026-09-01', 'P006', 'C003', 'PR-492A873B', '1', '85', 'WEB', ''],
  ['2026-09-01', 'P006', 'C003', 'PR-4D383833', '1', '45', 'WEB', ''],
  ['2026-10-01', 'P007', 'C003', 'PR-4325996A', '1', '90', 'WHATSAPP', ''],
  ['2026-10-07', 'P008', 'C004', 'PR-492A873B', '1', '', 'WEB', 'web10'],
  ['2026-05-20', 'P009', 'C005', 'PR-432598B6', '1', '175', 'TIENDA', ''],
  ['2026-08-28', 'P010', 'C006', 'PR-425592EB', '2', '116', 'WEB', ''],
].map(([fecha, pedido_id, cliente_id, sku, cantidad, total, canal, codigo]) => ({ fecha, pedido_id, cliente_id, sku, cantidad, total, canal, codigo }));

// Resultado de buscar hojas en la carpeta de Drive.
const ARCHIVOS_CARPETA = [
  { id: 'SHEET_OTRA', name: 'Notas del equipo', mimeType: 'application/vnd.google-apps.spreadsheet' },
  { id: 'SHEET_FUENTE', name: 'MERMIN_FUENTE ITS WOOD', mimeType: 'application/vnd.google-apps.spreadsheet' },
];

function copia() {
  return { PRODUCTOS: PRODUCTOS.map(f => ({ ...f })), CLIENTES: CLIENTES.map(f => ({ ...f })), VENTAS: VENTAS.map(f => ({ ...f })) };
}

module.exports = { PRODUCTOS, CLIENTES, VENTAS, ARCHIVOS_CARPETA, copia };
