// Pedidos, clientes y notificaciones sobre el almacén.
import { conPrioridad, ordenar, montoPedido } from './prioridad.js';
import { formatoSoles, sinTildes } from './formato.js';

export const ESTADOS = ['nuevo', 'derivado', 'confirmado'];
const clave = (s) => sinTildes(s).trim().toLowerCase();

export function agregarNotificacion(almacen, n) {
  const lista = almacen.datos.notificaciones;
  const nueva = { id: `N-${Date.now().toString(36)}-${lista.length + 1}`, creado_en: new Date().toISOString(), leida: false, enlace: '/app', ...n };
  lista.unshift(nueva);
  if (lista.length > 200) lista.length = 200;
  almacen.guardar('notificaciones');
  return nueva;
}

function siguienteId(pedidos) {
  const max = pedidos.reduce((m, p) => Math.max(m, Number((/^PED-(\d+)$/.exec(p.id) || [])[1] || 0)), 0);
  return `PED-${String(max + 1).padStart(4, '0')}`;
}

/** ¿Ya compró antes? Por nombre de empresa o persona en Clientes o en el histórico de ventas. */
export function yaComproAntes(almacen, nombre) {
  const k = clave(nombre);
  if (!k) return false;
  return almacen.datos.clientes.some((c) => clave(c.empresa || c.nombre) === k && (c.pedidos || 0) > 0)
    || almacen.datos.ventas.some((v) => clave(v.cliente) === k);
}

function registrarCliente(almacen, pedido) {
  const nombre = pedido.cliente.empresa || pedido.cliente.nombre;
  const k = clave(nombre);
  let c = almacen.datos.clientes.find((x) => clave(x.empresa || x.nombre) === k);
  if (!c) {
    c = { nombre: pedido.cliente.nombre, empresa: pedido.cliente.empresa, tipo: pedido.cliente.tipo, telefono: pedido.cliente.telefono, pedidos: 0, ultimo_pedido: null };
    almacen.datos.clientes.push(c);
  }
  c.pedidos = (c.pedidos || 0) + 1;
  c.ultimo_pedido = pedido.id;
  almacen.guardar('clientes');
}

export function crearPedido(almacen, datos) {
  const pedido = { id: siguienteId(almacen.datos.pedidos), creado_en: new Date().toISOString(), estado: 'nuevo', ejemplo: false, entrega: null, ...datos };
  almacen.datos.pedidos.unshift(pedido);
  registrarCliente(almacen, pedido);
  almacen.guardar('pedidos');
  return pedido;
}

export function listarPedidos(almacen, { estado } = {}) {
  const config = almacen.datos.config;
  const lista = almacen.datos.pedidos.filter((p) => !estado || p.estado === estado).map((p) => conPrioridad(p, config));
  return ordenar(lista);
}

export function obtenerPedido(almacen, id) {
  const p = almacen.datos.pedidos.find((x) => x.id === id);
  return p ? conPrioridad(p, almacen.datos.config) : null;
}

/** PATCH /pedidos/{id}: solo el estado. */
export function actualizarPedido(almacen, id, cambios) {
  const p = almacen.datos.pedidos.find((x) => x.id === id);
  if (!p) return { status: 404, error: `No existe el pedido ${id}` };
  const extra = Object.keys(cambios || {}).filter((k) => k !== 'estado');
  if (extra.length) return { status: 400, error: `Solo se puede cambiar el estado (llegó: ${extra.join(', ')})` };
  if (!ESTADOS.includes(cambios.estado)) return { status: 400, error: `estado debe ser ${ESTADOS.join(', ')}` };
  const antes = p.estado;
  p.estado = cambios.estado;
  almacen.guardar('pedidos');
  if (antes !== 'derivado' && p.estado === 'derivado' && almacen.datos.config.notificaciones?.pedido_derivado !== false) {
    agregarNotificacion(almacen, { tipo: 'pedido_derivado', titulo: 'Pedido marcado como derivado', texto: p.cliente?.empresa || p.cliente?.nombre || p.id, enlace: `/app/pedidos?id=${p.id}` });
  }
  return { status: 200, pedido: conPrioridad(p, almacen.datos.config) };
}

/** Aviso al cerrar un pedido, según su prioridad y lo que la dueña activó en Ajustes. */
export function avisarPedido(almacen, pedido, prioridad) {
  const config = almacen.datos.config;
  const aviso = {
    alta: { tipo: 'pedido_alta', titulo: 'Nuevo pedido de prioridad alta', activo: config.notificaciones?.pedido_alta !== false },
    derivado: { tipo: 'pedido_derivado', titulo: 'Pedido derivado: lo negocias tú', activo: config.notificaciones?.pedido_derivado !== false },
  }[prioridad] || { tipo: 'pedido', titulo: `Nuevo pedido resuelto por ${config.asistente}`, activo: true };
  if (!aviso.activo) return null;
  const cliente = pedido.cliente.empresa || pedido.cliente.nombre;
  return agregarNotificacion(almacen, { tipo: aviso.tipo, titulo: aviso.titulo, texto: `${cliente} · ${pedido.cantidad_total} u. · ${formatoSoles(montoPedido(pedido))}`, enlace: `/app/pedidos?id=${pedido.id}` });
}
