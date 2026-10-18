import { pedir, conRespaldo } from './api.js';
import { demo, agregarNotificacion } from './demo/store.js';
import { leerArchivo, catalogoDesdeFilas, conIdsActuales } from '../lib/catalogo.js';
import { pedidoMermin, ventasAPedidos } from '../lib/historico.js';
import { agruparClientes } from '../lib/segmentos.js';
import {
  parseMonto, parseFecha, parseCantidad, normalizarPlataforma, normalizarEstado,
  deducirTipo, huboGrabado, limpiarDistrito, tituloBonito,
} from '../lib/parse.js';

// Rutas propuestas por el frontend (ver docs/API_CONTRATO.md).
// La conexión real la hace el backend con su cuenta de servicio: aquí nunca se piden claves.

export const TIPOS_FUENTE = {
  ventas: { nombre: 'Ventas', columnas: ['fecha de pedido', 'cliente', 'plataforma', 'fecha de entrega', 'distrito', 'producto', 'cantidad', 'precio unitario', 'delivery', 'estado', 'detalles'] },
  pedidos: { nombre: 'Pedidos', columnas: ['id', 'fecha', 'cliente', 'tipo (empresa/persona)', 'producto', 'cantidad', 'fecha requerida', 'personalización', 'estado'] },
  clientes: { nombre: 'Clientes', columnas: ['cliente', 'tipo (empresa/persona)', 'teléfono', 'correo', 'distrito'] },
  catalogo: { nombre: 'Catálogo', columnas: ['producto', 'categoria', 'precio', 'stock', 'descripcion'] },
};

const REQUERIDAS = {
  ventas: ['cliente', 'producto'],
  pedidos: ['cliente', 'producto'],
  clientes: ['cliente'],
  catalogo: ['producto', 'precio'],
};

const sinTildes = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

function normalizarClaves(filas) {
  return filas.map((f) => Object.fromEntries(Object.entries(f).map(([k, v]) => [sinTildes(k), v])));
}

function ventasDesdeFilasDemo(filas, minimoEmpresa = 12) {
  return filas
    .filter((f) => f.cliente && f.producto)
    .map((f, i) => {
      const cantidad = parseCantidad(f.cantidad);
      const unit = parseMonto(f['precio unitario'] ?? f.precio);
      const delivery = parseMonto(f.delivery);
      return {
        id: f.id || `V-HOJA-${i + 1}`,
        cliente: String(f.cliente).trim(),
        tipo: deducirTipo(f.cliente, cantidad, minimoEmpresa),
        fecha_pedido: parseFecha(f['fecha de pedido'] || f.fecha) || f['fecha de pedido'] || null,
        fecha_entrega: parseFecha(f['fecha de entrega']) || f['fecha de entrega'] || null,
        plataforma: normalizarPlataforma(f.plataforma),
        distrito: limpiarDistrito(f.distrito),
        producto: tituloBonito(f.producto),
        cantidad,
        precio_unitario: unit,
        delivery,
        monto: unit === null ? null : Math.round(((cantidad ? unit * cantidad : unit) + (delivery || 0)) * 100) / 100,
        estado: normalizarEstado(f.estado),
        grabado: huboGrabado(f.detalles),
      };
    });
}

function pedidosDesdeFilasDemo(filas, minimoEmpresa = 12) {
  const hoy = new Date().toISOString();
  return filas
    .filter((f) => f.cliente && f.producto)
    .map((f, i) => {
      const cantidad = parseCantidad(f.cantidad) || 1;
      const rawTipo = String(f['tipo (empresa/persona)'] ?? f.tipo ?? '').trim().toLowerCase();
      const tipo = rawTipo.includes('empresa') ? 'empresa'
        : rawTipo.includes('persona') ? 'persona'
          : deducirTipo(f.cliente, cantidad, minimoEmpresa);
      const nombreProd = tituloBonito(f.producto);
      const prodCat = demo.catalogo.find((p) => p.nombre.toLowerCase() === nombreProd.toLowerCase());
      const precioUnitario = parseMonto(f['precio unitario'] ?? f.precio) ?? prodCat?.precio ?? 0;
      const clienteTxt = String(f.cliente).trim();
      const rawEstado = String(f.estado || 'nuevo').trim().toLowerCase();
      const estado = rawEstado.includes('confirm') || rawEstado.includes('entreg') ? 'confirmado'
        : rawEstado.includes('deriv') ? 'derivado' : 'nuevo';
      return {
        id: String(f.id || `PED-H${String(i + 1).padStart(3, '0')}`).trim(),
        creado_en: parseFecha(f.fecha || f['fecha de pedido']) ? `${parseFecha(f.fecha || f['fecha de pedido'])}T12:00:00.000Z` : hoy,
        cliente: {
          nombre: tipo === 'empresa' ? null : clienteTxt,
          empresa: tipo === 'empresa' ? clienteTxt : null,
          tipo,
          ya_compro_antes: false,
        },
        ocasion: f.ocasion ? String(f.ocasion).trim() : 'Pedido de hoja',
        cantidad_total: cantidad,
        fecha_requerida: parseFecha(f['fecha requerida'] || f['fecha de entrega']) || f['fecha requerida'] || null,
        productos: [{
          producto_id: prodCat?.id || `PR-HOJA-${i + 1}`,
          nombre: prodCat?.nombre || nombreProd,
          cantidad,
          precio_unitario: precioUnitario,
        }],
        personalizacion: f.personalizacion ? String(f.personalizacion).trim() : null,
        estado,
        resumen: `Importado de hoja Pedidos: ${cantidad} × ${nombreProd}.`,
      };
    });
}

function clientesDesdeFilasDemo(filas, minimoEmpresa = 12) {
  return filas
    .filter((f) => f.cliente)
    .map((f, i) => {
      const cliente = String(f.cliente).trim();
      const rawTipo = String(f['tipo (empresa/persona)'] ?? f.tipo ?? '').trim().toLowerCase();
      const tipo = rawTipo.includes('empresa') ? 'empresa'
        : rawTipo.includes('persona') ? 'persona'
          : deducirTipo(cliente, 1, minimoEmpresa);
      return {
        id: f.id || `CLI-${i + 1}`,
        cliente,
        alias: cliente,
        tipo,
        empresa: tipo === 'empresa',
        telefono: String(f.telefono || '').trim() || null,
        correo: String(f.correo || '').trim() || null,
        distrito: limpiarDistrito(f.distrito) || (String(f.distrito || '').trim() || null),
      };
    });
}

function filasDemoPorFuente(f) {
  if (demo.fuentesFilas?.[f.id]) return structuredClone(demo.fuentesFilas[f.id]);
  if (f.tipo === 'ventas') return structuredClone(demo.ventas);
  if (f.tipo === 'pedidos') {
    const mermin = demo.pedidos.map((p) => pedidoMermin(p));
    const hist = ventasAPedidos(demo.ventas).slice(0, Math.max(0, (f.filas || 12) - mermin.length));
    return [...mermin, ...hist];
  }
  if (f.tipo === 'clientes') return structuredClone(demo.clientes || agruparClientes(demo.ventas));
  if (f.tipo === 'catalogo') return structuredClone(demo.catalogo);
  return [];
}

export const esUrlGoogle = (url) => /^https:\/\/(docs\.google\.com\/spreadsheets\/d\/|drive\.google\.com\/drive\/(u\/\d+\/)?folders\/)/.test(url.trim());

export async function listarFuentes() {
  return conRespaldo(
    () => pedir('/fuentes'),
    async () => ({ correo_servicio: demo.config.correo_servicio, fuentes: structuredClone(demo.fuentes) }),
    { rutaPropuesta: true },
  );
}

export async function obtenerDatosFuente(id) {
  return conRespaldo(
    () => pedir(`/fuentes/${id}/datos`),
    async () => {
      const f = demo.fuentes.find((x) => x.id === id);
      if (!f) throw new Error('Fuente no encontrada.');
      return {
        id: f.id,
        nombre: f.nombre,
        tipo: f.tipo,
        estado: f.estado,
        filas: filasDemoPorFuente(f),
      };
    },
    { rutaPropuesta: true },
  );
}

function sincronizarDemo(f) {
  f.estado = 'sincronizando';
  setTimeout(() => {
    if (f.url.includes('/drive/') && f.tipo !== 'catalogo') {
      f.estado = 'error';
      f.error = 'La carpeta no tiene una hoja con las columnas esperadas.';
      return;
    }
    f.estado = 'ok';
    f.error = null;
    f.ultima_sync = new Date().toISOString();
    f.filas = f.filas || { ventas: demo.ventas.length, pedidos: 12, clientes: (demo.clientes || []).length || 225, catalogo: demo.catalogo.length }[f.tipo];
    agregarNotificacion({ tipo: 'sync', titulo: `Hoja ${TIPOS_FUENTE[f.tipo].nombre} sincronizada`, texto: `${f.filas} filas leídas`, enlace: '/app/datos' });
  }, 2500);
}

export async function conectarFuente({ url, tipo }) {
  return conRespaldo(
    () => pedir('/fuentes', { method: 'POST', body: { url, tipo } }),
    async () => {
      if (!esUrlGoogle(url)) throw new Error('Pega el enlace de una hoja de Google Sheets o de una carpeta de Drive.');
      const f = { id: `F-${Date.now()}`, nombre: `${TIPOS_FUENTE[tipo].nombre} (ejemplo)`, tipo, url: url.trim(), estado: 'sincronizando', error: null, ultima_sync: null, filas: null };
      demo.fuentes.push(f);
      sincronizarDemo(f);
      return structuredClone(f);
    },
    { rutaPropuesta: true },
  );
}

export async function subirArchivoFuente(archivo, tipo = 'ventas') {
  const form = new FormData();
  form.append('archivo', archivo);
  return conRespaldo(
    () => pedir(`/fuentes/archivo?tipo=${encodeURIComponent(tipo)}`, { method: 'POST', form }),
    async () => {
      if (!TIPOS_FUENTE[tipo]) throw new Error('Elige el tipo de hoja.');
      const crudas = await leerArchivo(archivo);
      const filas = normalizarClaves(crudas);
      if (!filas.length) throw new Error('El archivo está vacío.');
      const faltan = REQUERIDAS[tipo].filter((c) => !(c in filas[0]));
      if (faltan.length) throw new Error(`A la hoja le faltan las columnas: ${faltan.join(', ')}.`);

      const minEmp = demo.config.reglas?.minimo_empresa || 12;
      let procesadas = filas;
      if (tipo === 'ventas') {
        procesadas = ventasDesdeFilasDemo(filas, minEmp);
        if (procesadas.length) {
          demo.ventas = procesadas;
          demo.clientes = agruparClientes(procesadas);
        }
      } else if (tipo === 'catalogo') {
        procesadas = conIdsActuales(catalogoDesdeFilas(filas), demo.catalogo);
        if (procesadas.length) demo.catalogo = procesadas;
      } else if (tipo === 'pedidos') {
        const nuevos = pedidosDesdeFilasDemo(filas, minEmp);
        if (nuevos.length) {
          const idsNuevos = new Set(nuevos.map((p) => p.id));
          demo.pedidos = [...nuevos, ...demo.pedidos.filter((p) => !idsNuevos.has(p.id))];
        }
        procesadas = nuevos.map((p) => pedidoMermin(p));
      } else if (tipo === 'clientes') {
        procesadas = clientesDesdeFilasDemo(filas, minEmp);
        if (procesadas.length) demo.clientes = procesadas;
      }

      const f = {
        id: `F-${Date.now()}`,
        nombre: archivo.name || `${TIPOS_FUENTE[tipo].nombre} (archivo)`,
        tipo,
        url: `archivo://${archivo.name}`,
        estado: 'ok',
        error: null,
        ultima_sync: new Date().toISOString(),
        filas: procesadas.length,
      };
      demo.fuentesFilas[f.id] = procesadas;
      demo.fuentes.push(f);
      agregarNotificacion({ tipo: 'sync', titulo: `Hoja ${TIPOS_FUENTE[tipo].nombre} cargada`, texto: `${f.filas} filas leídas`, enlace: '/app/datos' });
      return structuredClone(f);
    },
    { rutaPropuesta: true },
  );
}

export async function sincronizarFuente(id) {
  return conRespaldo(
    () => pedir(`/fuentes/${id}/sincronizar`, { method: 'POST' }),
    async () => {
      const f = demo.fuentes.find((x) => x.id === id);
      if (f) sincronizarDemo(f);
      return structuredClone(f);
    },
    { rutaPropuesta: true },
  );
}
