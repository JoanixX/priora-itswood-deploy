'use strict';

// Sincronización de la carpeta de Drive: el negocio deja ahí su hoja MERMIN_FUENTE (pestañas PRODUCTOS, CLIENTES y
// VENTAS) y el flujo [8] la copia a BOT_PRODUCTOS, BOT_CLIENTES_FUENTE y BOT_VENTAS. El bot y el dashboard leen la
// copia, nunca la fuente: si el negocio rompe su hoja, se registra el error y queda la última copia válida.
// Sin dependencias: se usa en los nodos Code de n8n y en el simulador.

// En n8n, fidelizacion.js va concatenado antes de este archivo en el nodo que valida; en Node se carga con require.
// Se resuelve al usarla: los nodos que solo eligen la hoja o registran errores no incluyen fidelizacion.js.
function syncSegmentar(args) { return (typeof segmentar === 'function' ? segmentar : require('./fidelizacion').segmentar)(args); }

const PREFIJO_FUENTE = 'MERMIN_FUENTE';
const MIME_SHEETS = 'application/vnd.google-apps.spreadsheet';
const COLUMNAS_FUENTE = {
  PRODUCTOS: ['sku', 'nombre', 'categoria', 'precio', 'costo', 'stock', 'activo'],
  CLIENTES: ['cliente_id', 'nombre', 'telefono', 'email', 'tipo', 'fecha_registro', 'acepta_marketing'],
  VENTAS: ['fecha', 'pedido_id', 'cliente_id', 'sku', 'cantidad', 'total', 'canal', 'codigo'],
};
const TIPOS_CLIENTE = ['EMPRESA', 'PERSONA'];
const CANALES_VENTA = ['WEB', 'WHATSAPP', 'TIENDA'];

function syncTexto(v) { return v === undefined || v === null ? '' : String(v).trim(); }
function syncClave(v) { return syncTexto(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '_'); }
function syncNumero(v) {
  const s = syncTexto(v).replace(/^S\/\s*/i, '').replace(/\s/g, '');
  if (!s) return null;
  // "1,234.50" o "1234,50": la coma es decimal solo si no hay punto.
  const limpio = s.includes('.') ? s.replace(/,/g, '') : s.replace(',', '.');
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

// Fecha de la hoja -> YYYY-MM-DD. Acepta 2026-10-17, 17/10/2026, 17/10/26, ISO con hora y el número de serie de Sheets.
function fechaFuente(v) {
  const s = syncTexto(v);
  if (!s) return '';
  let g;
  if ((g = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return armarFecha(+g[1], +g[2], +g[3]);
  if ((g = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/))) return armarFecha(g[3].length === 2 ? 2000 + +g[3] : +g[3], +g[2], +g[1]);
  if (/^\d{5}(\.\d+)?$/.test(s)) return new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 864e5).toISOString().slice(0, 10);
  return '';
}
function armarFecha(y, m, d) {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? t.toISOString().slice(0, 10) : '';
}

function telefonoFuente(v) {
  const d = syncTexto(v).replace(/\D/g, '');
  if (/^9\d{8}$/.test(d)) return `51${d}`;
  return d.length >= 10 ? d : '';
}
function siNo(v, porDefecto) {
  const s = syncClave(v);
  if (!s) return porDefecto;
  return ['si', 'sí', 's', 'yes', 'y', 'true', '1', 'x'].includes(s) ? 'SI' : 'NO';
}

// URL de la carpeta (o el id suelto) -> folderId.
function extraerFolderId(url) {
  const s = syncTexto(url);
  let g;
  if ((g = s.match(/\/folders\/([A-Za-z0-9_-]{10,})/))) return g[1];
  if ((g = s.match(/[?&]id=([A-Za-z0-9_-]{10,})/))) return g[1];
  if (/^[A-Za-z0-9_-]{10,}$/.test(s)) return s;
  return '';
}

// Archivos de la carpeta (búsqueda de Drive) -> la hoja fuente: la que empieza por MERMIN_FUENTE o la primera Sheet.
function elegirHojaFuente(archivos) {
  const hojas = (archivos || []).filter(a => a && syncTexto(a.id) && (!a.mimeType || a.mimeType === MIME_SHEETS));
  const porNombre = hojas.find(a => syncTexto(a.name).toUpperCase().startsWith(PREFIJO_FUENTE));
  const elegida = porNombre || hojas[0];
  return elegida ? { id: syncTexto(elegida.id), nombre: syncTexto(elegida.name) } : null;
}

// Filas leídas de una pestaña -> filas con claves normalizadas, sin filas vacías.
function filasLimpias(filas) {
  return (filas || [])
    .map(f => {
      const fila = {};
      for (const k of Object.keys(f || {})) if (k !== 'row_number') fila[syncClave(k)] = f[k];
      return fila;
    })
    .filter(f => Object.values(f).some(v => syncTexto(v) !== ''));
}

function columnasFaltantes(pestana, filas) {
  const vistas = new Set();
  for (const f of filas) for (const k of Object.keys(f)) vistas.add(k);
  return COLUMNAS_FUENTE[pestana].filter(c => !vistas.has(c));
}

function normalizarProductos(filas, avisos) {
  const vistos = new Set();
  const productos = [];
  for (const f of filas) {
    const sku = syncTexto(f.sku);
    if (!sku) { avisos.push(`PRODUCTOS: fila sin sku omitida (${syncTexto(f.nombre) || 'sin nombre'}).`); continue; }
    if (vistos.has(sku)) { avisos.push(`PRODUCTOS: sku ${sku} repetido; se usa la primera fila.`); continue; }
    vistos.add(sku);
    const precio = syncNumero(f.precio);
    if (precio === null) avisos.push(`PRODUCTOS: ${sku} sin precio.`);
    const costo = syncNumero(f.costo);
    const stock = syncNumero(f.stock);
    productos.push({
      sku, nombre: syncTexto(f.nombre), categoria: syncTexto(f.categoria),
      precio: precio === null ? '' : precio, costo: costo === null ? '' : costo,
      stock: stock === null ? '' : Math.floor(stock), activo: siNo(f.activo, 'SI'),
    });
  }
  return productos;
}

function normalizarClientes(filas, avisos) {
  const clientes = [];
  const vistos = new Set();
  for (const f of filas) {
    const id = syncTexto(f.cliente_id);
    if (!id) { avisos.push('CLIENTES: fila sin cliente_id omitida.'); continue; }
    if (vistos.has(id)) { avisos.push(`CLIENTES: cliente_id ${id} repetido; se usa la primera fila.`); continue; }
    vistos.add(id);
    const tipo = syncTexto(f.tipo).toUpperCase();
    if (tipo && !TIPOS_CLIENTE.includes(tipo)) avisos.push(`CLIENTES: ${id} tiene tipo "${tipo}"; se toma como PERSONA.`);
    clientes.push({
      cliente_id: id, nombre: syncTexto(f.nombre), telefono: telefonoFuente(f.telefono), email: syncTexto(f.email).toLowerCase(),
      tipo: tipo === 'EMPRESA' ? 'EMPRESA' : 'PERSONA', fecha_registro: fechaFuente(f.fecha_registro),
      acepta_marketing: siNo(f.acepta_marketing, 'NO'),
    });
  }
  return clientes;
}

function normalizarVentas(filas, productos, avisos) {
  const precios = Object.fromEntries(productos.map(p => [p.sku, p.precio]));
  const ventas = [];
  for (const f of filas) {
    const fecha = fechaFuente(f.fecha);
    const pedido = syncTexto(f.pedido_id);
    if (!fecha || !pedido) { avisos.push(`VENTAS: fila sin fecha válida o sin pedido_id omitida (${pedido || syncTexto(f.fecha) || 'vacía'}).`); continue; }
    const cantidad = syncNumero(f.cantidad);
    let total = syncNumero(f.total);
    const sku = syncTexto(f.sku);
    if (total === null && cantidad !== null && typeof precios[sku] === 'number') total = Math.round(precios[sku] * cantidad * 100) / 100;
    const canal = syncTexto(f.canal).toUpperCase();
    ventas.push({
      fecha, pedido_id: pedido, cliente_id: syncTexto(f.cliente_id), sku,
      cantidad: cantidad === null ? '' : cantidad, total: total === null ? '' : total,
      canal: CANALES_VENTA.includes(canal) ? canal : canal || 'TIENDA', codigo: syncTexto(f.codigo).toUpperCase(),
    });
  }
  return ventas;
}

// Lo leído de la hoja fuente -> qué escribir. Si falta una columna o no hay productos, no se escribe nada.
function prepararSync({ hoja, productos, clientes, ventas, ahora }) {
  const ahoraIso = ahora || new Date().toISOString();
  const errores = [];
  const avisos = [];
  if (!hoja) {
    return { ok: false, errores: [`No hay una hoja de cálculo en la carpeta. Sube la plantilla ${PREFIJO_FUENTE}.`], avisos, ahora: ahoraIso };
  }
  const leidas = { PRODUCTOS: filasLimpias(productos), CLIENTES: filasLimpias(clientes), VENTAS: filasLimpias(ventas) };
  for (const pestana of Object.keys(COLUMNAS_FUENTE)) {
    // Una pestaña vacía no deja ver sus cabeceras: solo se exige que PRODUCTOS tenga filas.
    if (!leidas[pestana].length) {
      if (pestana === 'PRODUCTOS') errores.push('La pestaña PRODUCTOS no tiene filas (o no existe).');
      continue;
    }
    const faltan = columnasFaltantes(pestana, leidas[pestana]);
    if (faltan.length) errores.push(`A la pestaña ${pestana} le faltan columnas: ${faltan.join(', ')}.`);
  }
  if (errores.length) return { ok: false, errores, avisos, hoja, ahora: ahoraIso };

  const prods = normalizarProductos(leidas.PRODUCTOS, avisos);
  const clis = normalizarClientes(leidas.CLIENTES, avisos);
  const vents = normalizarVentas(leidas.VENTAS, prods, avisos);
  const idsClientes = new Set(clis.map(c => c.cliente_id));
  const sinCliente = vents.filter(v => v.cliente_id && !idsClientes.has(v.cliente_id)).length;
  if (sinCliente) avisos.push(`VENTAS: ${sinCliente} fila(s) con cliente_id que no está en CLIENTES.`);
  // Segmentos de fidelización recalculados en cada sincronización (columnas extra de BOT_CLIENTES_FUENTE).
  const segmentos = Object.fromEntries(syncSegmentar({ clientes: clis, ventas: vents, ahora: ahoraIso }).map(c => [c.cliente_id, c]));
  for (const c of clis) {
    const s = segmentos[c.cliente_id];
    Object.assign(c, { segmento: s.segmento, pedidos: s.pedidos, total_comprado: s.total_comprado, ultima_compra: s.ultima_compra });
  }
  return {
    ok: true,
    errores,
    avisos: avisos.slice(0, 50),
    hoja,
    ahora: ahoraIso,
    productos: prods,
    clientes: clis,
    ventas: vents,
    config: [
      { clave: 'sheet_fuente_id', valor: hoja.id, descripcion: 'Hoja fuente detectada por la sincronización.' },
      { clave: 'ultima_sync', valor: ahoraIso, descripcion: 'Fecha de la última sincronización correcta.' },
    ],
    resumen: `${prods.length} productos, ${clis.length} clientes y ${vents.length} líneas de venta desde "${hoja.nombre}".`,
  };
}

// Fila de BOT_ERRORES para una sincronización fallida.
function filaErrorSync(resultado) {
  return {
    fecha: resultado.ahora, flujo: 'Mermín - Sincronizar Drive', nodo: 'Validar fuente',
    mensaje: resultado.errores.join(' ').slice(0, 500), ejecucion_id: '', modo: 'sync',
  };
}

// POST /config/drive: lo que encontró la búsqueda en la carpeta -> respuesta y filas de BOT_CONFIG.
function conectarDrive({ url, archivos, correoServicio }) {
  const folderId = extraerFolderId(url);
  if (!folderId) return { ok: false, status: 400, error: 'No reconozco esa URL. Pega el enlace de la carpeta de Drive (…/drive/folders/<id>).' };
  const hoja = elegirHojaFuente(archivos);
  if (!hoja) {
    const correo = syncTexto(correoServicio);
    return {
      ok: false, status: 403, folder_id: folderId, correo_servicio: correo,
      error: `No veo ninguna hoja de cálculo en esa carpeta. Compártela${correo ? ` con ${correo}` : ' con la cuenta de servicio'} (como lector) y sube la plantilla ${PREFIJO_FUENTE}.`,
    };
  }
  return {
    ok: true, status: 200, folder_id: folderId, hoja,
    config: [
      { clave: 'drive_folder_id', valor: folderId, descripcion: 'Carpeta de Drive con la hoja MERMIN_FUENTE. Se llena desde el dashboard.' },
      { clave: 'sheet_fuente_id', valor: hoja.id, descripcion: 'Hoja fuente detectada por la sincronización.' },
    ],
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    extraerFolderId, elegirHojaFuente, prepararSync, filaErrorSync, conectarDrive, fechaFuente, telefonoFuente,
    COLUMNAS_FUENTE, PREFIJO_FUENTE, MIME_SHEETS,
  };
}
