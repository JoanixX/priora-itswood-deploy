// Datos con los que nace el almacén: catálogo de ITS WOOD, histórico de ventas anonimizado y algunos pedidos
// y avisos de ejemplo (marcados con ejemplo: true), los mismos que muestra la app en "Modo ejemplo".
import { readFileSync } from 'node:fs';
import { CONFIG_INICIAL } from '../config.js';
import { hoyISO, sumarDias } from '../formato.js';

const leer = (archivo) => JSON.parse(readFileSync(new URL(`../../data/${archivo}`, import.meta.url), 'utf8'));

export function semillas({ ejemplos = true } = {}) {
  const catalogo = leer('catalogo.json');
  const hoy = hoyISO();
  const hace = (min) => new Date(Date.now() - min * 60000).toISOString();
  const producto = (id, cantidad) => {
    const p = catalogo.find((x) => x.id === id);
    return { producto_id: p.id, nombre: p.nombre, cantidad, precio_unitario: p.precio };
  };
  const pedido = (id, min, cliente, ocasion, dias, prod, cant, personalizacion, resumen, flags = {}) => ({
    id, ejemplo: true, creado_en: hace(min), estado: 'nuevo', cliente, ocasion, cantidad_total: cant,
    fecha_requerida: sumarDias(hoy, dias), productos: [producto(prod, cant)], personalizacion, entrega: null, flags, resumen, conversacion_id: null,
  });
  const empresa = (nombre, empresa, ya) => ({ nombre, empresa, telefono: null, correo: null, tipo: 'empresa', ya_compro_antes: ya });
  const persona = (nombre, ya) => ({ nombre, empresa: null, telefono: null, correo: null, tipo: 'persona', ya_compro_antes: ya });

  return {
    config: structuredClone(CONFIG_INICIAL),
    catalogo,
    ventas: leer('ventas_demo.json'),
    pedidos: ejemplos ? [
      pedido('PED-E001', 25, empresa('Rosa', 'Inversiones Andinas SAC', true), 'Navidad', 21, 'PR-4D655976', 30, 'Logo de la empresa y nombre de cada colaborador', 'Regalo de fin de año para todo el equipo. Ya compraron Docks el año pasado.'),
      pedido('PED-E002', 70, empresa('Martín', 'Estudio Contable Ríos', false), 'Aniversario', 35, 'PR-4B75357B', 150, 'Logo grabado', 'Quiere 150 posacelulares para clientes. Pregunta por precio especial.'),
      pedido('PED-E003', 140, empresa('Carla', 'Colegio Los Pinos', false), 'Día del maestro', 9, 'PR-492A873B', 45, 'Nombre de cada profesor', 'Tablas Roma para 45 profesores. Fecha cercana.'),
      pedido('PED-E004', 200, empresa('Jorge', 'Clínica Sol', false), 'Navidad', 45, 'PR-48A95AE5', 18, null, 'Box navideño para el área administrativa.'),
      pedido('PED-E005', 260, persona('Lucía', false), 'Cumpleaños', 25, 'PR-4257E8A7', 1, 'Fecha y "Te quiero, mamá"', 'Portarretrato para su mamá. Resuelto por Mermín.'),
      pedido('PED-E006', 320, persona('Andrés', true), 'Reclamo', 4, 'PR-496A7867', 2, null, 'Uno de los joyeros llegó con una rayadura. Pide cambio.', { reclamo: true }),
    ] : [],
    clientes: [],
    conversaciones: [],
    notificaciones: ejemplos ? [
      { id: 'N-E1', tipo: 'pedido_alta', titulo: 'Nuevo pedido de prioridad alta', texto: 'Inversiones Andinas SAC · 30 u. · Dock 3 en 1', creado_en: hace(25), leida: false, enlace: '/app/pedidos?id=PED-E001' },
      { id: 'N-E2', tipo: 'pedido_derivado', titulo: 'Pedido derivado: reclamo', texto: 'Andrés: un joyero llegó rayado', creado_en: hace(320), leida: false, enlace: '/app/pedidos?id=PED-E006' },
    ] : [],
    fuentes: [],
  };
}
