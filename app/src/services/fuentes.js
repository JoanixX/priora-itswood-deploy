import { pedir, conRespaldo } from './api.js';
import { demo, agregarNotificacion } from './demo/store.js';

// Rutas propuestas por el frontend (ver docs/API_CONTRATO.md).
// La conexión real la hace el backend con su cuenta de servicio: aquí nunca se piden claves.

export const TIPOS_FUENTE = {
  ventas: { nombre: 'Ventas', columnas: ['fecha de pedido', 'cliente', 'plataforma', 'fecha de entrega', 'distrito', 'producto', 'cantidad', 'precio unitario', 'delivery', 'estado', 'detalles'] },
  pedidos: { nombre: 'Pedidos', columnas: ['id', 'fecha', 'cliente', 'tipo (empresa/persona)', 'producto', 'cantidad', 'fecha requerida', 'personalización', 'estado'] },
  clientes: { nombre: 'Clientes', columnas: ['cliente', 'tipo (empresa/persona)', 'teléfono', 'correo', 'distrito'] },
  catalogo: { nombre: 'Catálogo', columnas: ['producto', 'categoria', 'precio', 'stock', 'descripcion'] },
};

export const esUrlGoogle = (url) => /^https:\/\/(docs\.google\.com\/spreadsheets\/d\/|drive\.google\.com\/drive\/(u\/\d+\/)?folders\/)/.test(url.trim());

export async function listarFuentes() {
  return conRespaldo(
    () => pedir('/fuentes'),
    async () => ({ correo_servicio: demo.config.correo_servicio, fuentes: structuredClone(demo.fuentes) }),
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
    f.filas = f.filas || { ventas: 264, pedidos: 12, clientes: 225, catalogo: 55 }[f.tipo];
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
