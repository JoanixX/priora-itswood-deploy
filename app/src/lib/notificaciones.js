// El contrato solo garantiza `texto`; `titulo` es opcional (anexo del frontend).
const TITULOS = {
  pedido_alta: 'Nuevo pedido de prioridad alta',
  pedido: 'Nuevo pedido',
  pedido_derivado: 'Pedido derivado',
  resumen_diario: 'Resumen del día',
  sync: 'Hoja sincronizada',
};

export const tituloNotificacion = (n) => n.titulo || n.texto || TITULOS[n.tipo] || 'Aviso';
