import { pedir, conRespaldo } from './api.js';
import { demo, agregarNotificacion } from './demo/store.js';
import { pedidoMermin, ventasAPedidos } from '../lib/historico.js';

export const obtenerVentasHistoricas = () => demo.ventas;

export async function listarVentas() {
  return conRespaldo(
    async () => {
      const remotas = await pedir('/ventas');
      if (Array.isArray(remotas) && remotas.length) demo.ventas = remotas;
      return demo.ventas;
    },
    async () => demo.ventas,
    { rutaPropuesta: true },
  );
}

export async function listarPedidos() {
  const mermin = await conRespaldo(
    async () => (await pedir('/pedidos')).map((p) => pedidoMermin(p, { desdeBackend: true })),
    async () => demo.pedidos.map((p) => pedidoMermin(p)),
  );
  return [...mermin, ...ventasAPedidos(demo.ventas)];
}

export async function actualizarPedido(id, cambios) {
  return conRespaldo(
    () => pedir(`/pedidos/${id}`, { method: 'PATCH', body: cambios }),
    async () => {
      const p = demo.pedidos.find((x) => x.id === id);
      if (!p) throw new Error('Ese pedido es del histórico y no se puede cambiar aquí.');
      Object.assign(p, cambios);
      if (cambios.estado === 'derivado') {
        agregarNotificacion({ tipo: 'pedido_derivado', titulo: 'Pedido marcado como derivado', texto: p.cliente.empresa || p.cliente.nombre, enlace: `/app/pedidos?id=${id}` });
      }
      return p;
    },
  );
}

/** Solo modo ejemplo: lo usa el chat simulado al cerrar un pedido. */
export function crearPedidoDemo(pedido) {
  const id = `PED-D${String(demo.siguientePedido++).padStart(3, '0')}`;
  const nuevo = { id, creado_en: new Date().toISOString(), estado: 'nuevo', ...pedido };
  demo.pedidos.unshift(nuevo);
  return nuevo;
}
