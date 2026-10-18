// Almacén del backend: todo vive en memoria (respuestas rápidas, la app corta a los 4 s) y, si hay Google Sheets
// configurado, cada cambio se copia a la pestaña correspondiente en segundo plano. Al arrancar se carga lo que haya
// en la hoja; las pestañas vacías nacen con las semillas.
import { semillas } from './semillas.js';

// Pestañas de la hoja y cómo se guarda cada fila. json: columnas guardadas como texto JSON.
export const TABLAS = {
  config: { hoja: 'Config', columnas: ['clave', 'valor'] },
  catalogo: { hoja: 'Catalogo', columnas: ['id', 'nombre', 'categoria', 'precio', 'stock', 'descripcion', 'imagen_url'] },
  pedidos: {
    hoja: 'Pedidos',
    columnas: ['id', 'creado_en', 'estado', 'cliente_nombre', 'cliente_empresa', 'cliente_tipo', 'cliente_telefono', 'ya_compro_antes',
      'ocasion', 'cantidad_total', 'fecha_requerida', 'monto', 'productos', 'personalizacion', 'entrega', 'flags', 'resumen', 'conversacion_id', 'ejemplo'],
    json: ['productos', 'entrega', 'flags'],
  },
  clientes: { hoja: 'Clientes', columnas: ['nombre', 'empresa', 'tipo', 'telefono', 'pedidos', 'ultimo_pedido'] },
  notificaciones: { hoja: 'Notificaciones', columnas: ['id', 'tipo', 'titulo', 'texto', 'enlace', 'creado_en', 'leida'] },
  conversaciones: { hoja: 'Conversaciones', columnas: ['id', 'creado_en', 'inicio', 'primera_respuesta_seg', 'paso', 'pedido_id', 'borrador', 'prioridad'], json: ['borrador', 'prioridad'] },
  fuentes: { hoja: 'Fuentes', columnas: ['id', 'tipo', 'nombre', 'url', 'recurso_id', 'estado', 'ultima_sync', 'filas', 'error'] },
  ventas: {
    hoja: 'Ventas',
    columnas: ['id', 'cliente', 'tipo', 'fecha_pedido', 'fecha_entrega', 'plataforma', 'distrito', 'producto', 'cantidad', 'precio_unitario', 'delivery', 'monto', 'estado', 'grabado'],
  },
};

const vacio = (v) => v === undefined || v === null || v === '';

function aCelda(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

function deCelda(v, esJson) {
  if (vacio(v)) return null;
  if (esJson && typeof v === 'string') { try { return JSON.parse(v); } catch { return null; } }
  if (v === 'TRUE' || v === 'true') return true;
  if (v === 'FALSE' || v === 'false') return false;
  return v;
}

// Pedido del contrato ⇄ fila plana (la dueña lee la pestaña Pedidos sin JSON del cliente).
function pedidoAFila(p) {
  const monto = (p.productos || []).reduce((a, x) => a + (x.cantidad || 0) * (x.precio_unitario || 0), 0);
  return {
    ...p, cliente_nombre: p.cliente?.nombre, cliente_empresa: p.cliente?.empresa, cliente_tipo: p.cliente?.tipo,
    cliente_telefono: p.cliente?.telefono, ya_compro_antes: Boolean(p.cliente?.ya_compro_antes), monto,
  };
}
function filaAPedido(f) {
  const { cliente_nombre, cliente_empresa, cliente_tipo, cliente_telefono, ya_compro_antes, monto, ...resto } = f;
  return {
    ...resto,
    cliente: { nombre: cliente_nombre, empresa: cliente_empresa, telefono: cliente_telefono ? String(cliente_telefono) : null, correo: null, tipo: cliente_tipo || 'persona', ya_compro_antes: Boolean(ya_compro_antes) },
    productos: resto.productos || [], flags: resto.flags || {}, ejemplo: Boolean(resto.ejemplo),
  };
}

export function aFilas(tabla, datos) {
  if (tabla === 'config') return Object.entries(datos).map(([clave, valor]) => [clave, typeof valor === 'string' ? valor : JSON.stringify(valor)]);
  const { columnas } = TABLAS[tabla];
  return datos.map((d) => {
    const fila = tabla === 'pedidos' ? pedidoAFila(d) : d;
    return columnas.map((c) => aCelda(fila[c]));
  });
}

export function deFilas(tabla, filas) {
  if (tabla === 'config') {
    const config = {};
    for (const [clave, valor] of filas) {
      if (vacio(clave)) continue;
      try { config[clave] = typeof valor === 'string' ? JSON.parse(valor) : valor; } catch { config[clave] = valor; }
    }
    return config;
  }
  const { columnas, json = [] } = TABLAS[tabla];
  const objetos = filas.filter((f) => f.some((v) => !vacio(v))).map((f) => Object.fromEntries(columnas.map((c, i) => [c, deCelda(f[i], json.includes(c))])));
  return tabla === 'pedidos' ? objetos.map(filaAPedido) : objetos;
}

export class Almacen {
  /** persistencia: null (solo memoria) o { nombre, leer(hoja) → filas[][] | null, escribir(hoja, encabezado, filas) }. */
  constructor({ persistencia = null, ejemplos = true, esperaEscritura = 800 } = {}) {
    this.persistencia = persistencia;
    this.ejemplos = ejemplos;
    this.espera = esperaEscritura;
    this.datos = null;
    this.pendientes = new Map();
    this.cola = Promise.resolve();
    this.ultimoError = null;
  }

  get modo() { return this.persistencia ? this.persistencia.nombre : 'memoria'; }

  async iniciar() {
    const base = semillas({ ejemplos: this.ejemplos });
    this.datos = base;
    if (!this.persistencia) return this;
    for (const tabla of Object.keys(TABLAS)) {
      const filas = await this.persistencia.leer(TABLAS[tabla].hoja);
      if (filas && filas.length > 1) {
        const leidos = deFilas(tabla, filas.slice(1));
        // La config de la hoja se completa con los valores iniciales (campos nuevos que la hoja aún no tiene).
        this.datos[tabla] = tabla === 'config' ? { ...base.config, ...leidos } : leidos;
      } else {
        this.guardar(tabla);
      }
    }
    return this;
  }

  /** Programa la copia de una tabla a la hoja. Varias llamadas seguidas se juntan en una escritura. */
  guardar(tabla) {
    if (!this.persistencia || this.pendientes.has(tabla)) return;
    const timer = setTimeout(() => {
      this.pendientes.delete(tabla);
      this.cola = this.cola.then(() => this.escribir(tabla));
    }, this.espera);
    timer.unref?.();
    this.pendientes.set(tabla, timer);
  }

  async escribir(tabla) {
    const { hoja, columnas } = TABLAS[tabla];
    try {
      await this.persistencia.escribir(hoja, tabla === 'config' ? ['clave', 'valor'] : columnas, aFilas(tabla, this.datos[tabla]));
      this.ultimoError = null;
    } catch (e) {
      this.ultimoError = `${hoja}: ${e.message}`;
      console.error(`[almacen] no se pudo guardar ${hoja}: ${e.message}`);
    }
  }

  /** Escribe ya todo lo pendiente (pruebas y apagado). */
  async vaciar() {
    for (const [tabla, timer] of this.pendientes) {
      clearTimeout(timer);
      this.pendientes.delete(tabla);
      this.cola = this.cola.then(() => this.escribir(tabla));
    }
    await this.cola;
  }
}
