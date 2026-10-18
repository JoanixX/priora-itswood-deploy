// Estado en memoria del modo ejemplo. Se pierde al recargar (es una demo).
import { CONFIG_DEMO } from '../../data/configDemo.js';
import catalogo from '../../data/catalogo.demo.json';
import { hoyISO, sumarDias } from '../../lib/format.js';

const hoy = hoyISO();
const hace = (min) => new Date(Date.now() - min * 60000).toISOString();
const producto = (id, cantidad) => {
  const p = catalogo.find((x) => x.id === id);
  return { producto_id: p.id, nombre: p.nombre, cantidad, precio_unitario: p.precio };
};

const PEDIDOS_EJEMPLO = [
  {
    id: 'PED-E001', ejemplo: true, creado_en: hace(25),
    cliente: { nombre: 'Rosa', empresa: 'Inversiones Andinas SAC', tipo: 'empresa', ya_compro_antes: true },
    ocasion: 'Navidad', fecha_requerida: sumarDias(hoy, 21),
    productos: [producto('PR-4D655976', 30)],
    personalizacion: 'Logo de la empresa y nombre de cada colaborador', estado: 'nuevo',
    resumen: 'Regalo de fin de año para todo el equipo. Ya compraron Docks el año pasado.',
  },
  {
    id: 'PED-E002', ejemplo: true, creado_en: hace(70),
    cliente: { nombre: 'Martín', empresa: 'Estudio Contable Ríos', tipo: 'empresa', ya_compro_antes: false },
    ocasion: 'Aniversario', fecha_requerida: sumarDias(hoy, 35),
    productos: [producto('PR-4B75357B', 150)],
    personalizacion: 'Logo grabado', estado: 'nuevo',
    resumen: 'Quiere 150 posacelulares para clientes. Pregunta por precio especial.',
  },
  {
    id: 'PED-E003', ejemplo: true, creado_en: hace(140),
    cliente: { nombre: 'Carla', empresa: 'Colegio Los Pinos', tipo: 'empresa', ya_compro_antes: false },
    ocasion: 'Día del maestro', fecha_requerida: sumarDias(hoy, 9),
    productos: [producto('PR-492A873B', 45)],
    personalizacion: 'Nombre de cada profesor', estado: 'nuevo',
    resumen: 'Tablas Roma para 45 profesores. Fecha cercana.',
  },
  {
    id: 'PED-E004', ejemplo: true, creado_en: hace(200),
    cliente: { nombre: 'Jorge', empresa: 'Clínica Sol', tipo: 'empresa', ya_compro_antes: false },
    ocasion: 'Navidad', fecha_requerida: sumarDias(hoy, 45),
    productos: [producto('PR-48A95AE5', 18)],
    personalizacion: null, estado: 'nuevo',
    resumen: 'Box navideño para el área administrativa.',
  },
  {
    id: 'PED-E005', ejemplo: true, creado_en: hace(260),
    cliente: { nombre: 'Lucía', empresa: null, tipo: 'persona', ya_compro_antes: false },
    ocasion: 'Cumpleaños', fecha_requerida: sumarDias(hoy, 25),
    productos: [producto('PR-4257E8A7', 1)],
    personalizacion: 'Fecha y "Te quiero, mamá"', estado: 'nuevo',
    resumen: 'Portarretrato para su mamá. Resuelto por Mermín.',
  },
  {
    id: 'PED-E006', ejemplo: true, creado_en: hace(320),
    cliente: { nombre: 'Andrés', empresa: null, tipo: 'persona', ya_compro_antes: true },
    ocasion: 'Reclamo', fecha_requerida: sumarDias(hoy, 4),
    productos: [producto('PR-496A7867', 2)],
    personalizacion: null, estado: 'nuevo', flags: { reclamo: true },
    resumen: 'Uno de los joyeros llegó con una rayadura. Pide cambio.',
  },
];

export const demo = {
  config: structuredClone(CONFIG_DEMO),
  catalogo: structuredClone(catalogo),
  pedidos: structuredClone(PEDIDOS_EJEMPLO),
  // Registros de Mermín en esta sesión de demo: para las métricas de respuesta y conversión.
  conversaciones: [],
  notificaciones: [
    { id: 'N-E1', tipo: 'pedido_alta', titulo: 'Nuevo pedido de prioridad alta', texto: 'Inversiones Andinas SAC · 30 u. · Dock 3 en 1', creado_en: hace(25), leida: false, enlace: '/app/pedidos?id=PED-E001' },
    { id: 'N-E2', tipo: 'pedido_derivado', titulo: 'Pedido derivado: reclamo', texto: 'Andrés: un joyero llegó rayado', creado_en: hace(320), leida: false, enlace: '/app/pedidos?id=PED-E006' },
    { id: 'N-E3', tipo: 'resumen_diario', titulo: 'Resumen del día', texto: '4 consultas, 2 pedidos, S/ 1,240', creado_en: hace(600), leida: true, enlace: '/app' },
    { id: 'N-E4', tipo: 'sync', titulo: 'Hoja Ventas sincronizada', texto: '264 filas leídas', creado_en: hace(900), leida: true, enlace: '/app/datos' },
  ],
  fuentes: [
    { id: 'F-E1', nombre: 'Ventas 2026 (ejemplo)', tipo: 'ventas', url: 'https://docs.google.com/spreadsheets/d/ejemplo', estado: 'ok', error: null, ultima_sync: hace(900), filas: 264 },
  ],
  siguientePedido: 1,
  siguienteNotificacion: 1,
};

export function agregarNotificacion(n) {
  const nueva = { id: `N-${Date.now()}-${demo.siguienteNotificacion++}`, creado_en: new Date().toISOString(), leida: false, ...n };
  demo.notificaciones.unshift(nueva);
  return nueva;
}
