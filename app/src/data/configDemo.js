// Configuración por defecto del modo ejemplo. Todo lo marcado [SUPUESTO]
// espera confirmación de la dueña.
export const CONFIG_DEMO = {
  negocio: 'ITS WOOD',
  asistente: 'Mermín',
  correo_negocio: 'hola@itswood.pe',
  correo_servicio: 'priora-sheets@priora-demo.iam.gserviceaccount.com',
  textos: {
    saludo: '¡Hola! Soy Mermín, el asistente de ITS WOOD.',
    aviso_ia: 'Soy un asistente con IA. Si prefieres, te paso con la dueña.',
    no_sabe: 'Esa no la sé. Le paso tu consulta a la dueña y te responde pronto.',
  },
  tono: 'premium',
  bienvenida: {
    mensaje: 'Mira el catálogo completo en nuestra web 👉',
    url_tienda: 'https://itswood.pe',
    texto_boton: 'Ir a la tienda',
    promo_activa: false,
    promo_texto: '10 % de descuento comprando en la web', // [SUPUESTO]
  },
  derivar: { reclamos: true, descuentos: true, disenos_especiales: true, pide_persona: true },
  reglas: { minimo_empresa: 12, umbral_alta: 30, maximo_sin_derivar: 100, dias_fecha_cercana: 14 },
  // peso_valor: si el valor del pedido cuenta para la prioridad. monto_alta: desde qué monto sube a alta. [SUPUESTO]
  prioridad: { peso_valor: true, monto_alta: 1000, margen_estimado: 0.5 },
  notificaciones: { pedido_alta: true, pedido_derivado: true, resumen_diario: true, canal: 'app' },
  metricas: { tiempo_respuesta_antes_min: null },
};
