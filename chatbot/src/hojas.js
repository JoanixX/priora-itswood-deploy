'use strict';

// Nombres de las pestañas del libro de ITS WOOD. Las BOT_ son del bot; PAUTAS e INVENTARIO son del equipo.
// Ojo: "PAUTAS " lleva un espacio al final y "LISTADO DE PRODUCTOS " también, igual que en la hoja.

const PESTANAS = {
  conversaciones: 'BOT_CONVERSACIONES',
  solicitudes: 'BOT_SOLICITUDES',
  clientes: 'BOT_CLIENTES',
  eventos: 'BOT_EVENTOS',
  catalogo: 'BOT_CATALOGO',
  errores: 'BOT_ERRORES',
  cotizaciones: 'BOT_COTIZACIONES',
  config: 'BOT_CONFIG',
  // Copias de la hoja fuente MERMIN_FUENTE (carpeta de Drive), escritas por el flujo [8] Sincronizar Drive.
  productos: 'BOT_PRODUCTOS',
  clientesFuente: 'BOT_CLIENTES_FUENTE',
  ventas: 'BOT_VENTAS',
  // Reglas de canal, mensaje y oferta por segmento de fidelización (las edita el dashboard).
  fidelizacion: 'BOT_FIDELIZACION',
  // Registro de campañas: vista previa diaria (PREVISTA) y envíos (ENVIADO / ERROR_ENVIO).
  campanas: 'BOT_CAMPANAS',
  proveedores: 'PROVEEDORES',
  pautas: 'PAUTAS ',
  inventario: 'INVENTARIO',
};

// INVENTARIO no empieza en A1: la cabecera "ITEM " / "UNIDADES " está en H3:I3.
const RANGO_INVENTARIO = 'H3:I300';

const COLUMNAS_PAUTAS = [
  'FECHA MENSAJE', 'CLIENTE', 'NUMERO', 'CELEBRACION', 'FECHA EVENTO', 'LISTADO DE PRODUCTOS ', 'CANTIDAD',
  'ESTADO', 'ULTIMO CONTACTO', 'PROXIMO SEGUIMIENTO', 'MOTIVO DE PERDIDA',
];

module.exports = { PESTANAS, RANGO_INVENTARIO, COLUMNAS_PAUTAS };
