// Escenarios de un clic de la vista Mermín (app/src/services/chat.js): los mismos pasos y la prioridad esperada.
// Los usan las pruebas automáticas y scripts/probar_backend.mjs.

export const ESCENARIOS = [
  {
    id: 'empresa30',
    titulo: 'Empresa · 30 unidades',
    esperado: 'alta',
    pasos: [
      { boton_id: 'empresa', texto: 'Regalos para empresa' },
      { boton_id: 'Navidad', texto: 'Navidad' },
      { boton_id: '30', texto: '30' },
      { boton_id: 'fnav', texto: 'Para Navidad (15 dic)' },
      { boton_id: 'prod:PR-4D655976', texto: 'Dock 3 en 1 de Madera Personalizado' },
      { boton_id: 'si', texto: 'Sí, con grabado' },
      { texto: 'El logo de la empresa y el nombre de cada colaborador' },
      { texto: 'Grupo Miraflores SAC' },
      { boton_id: 'confirmar', texto: 'Confirmar pedido' },
    ],
  },
  {
    id: 'persona1',
    titulo: 'Persona · 1 unidad',
    esperado: 'automatico',
    pasos: [
      { boton_id: 'persona', texto: 'Regalo personal' },
      { boton_id: 'Cumpleaños', texto: 'Cumpleaños' },
      { boton_id: '1', texto: '1' },
      { boton_id: 'f1m', texto: 'En 1 mes' },
      { boton_id: 'prod:PR-4257E8A7', texto: 'Portarretrato Tipo Libro - LOVE' },
      { boton_id: 'no', texto: 'No, así está bien' },
      { texto: 'Valeria' },
      { boton_id: 'confirmar', texto: 'Confirmar pedido' },
    ],
  },
  {
    id: 'empresa150',
    titulo: 'Empresa · 150 unidades',
    esperado: 'derivado',
    pasos: [
      { boton_id: 'empresa', texto: 'Regalos para empresa' },
      { boton_id: 'Aniversario', texto: 'Aniversario' },
      { texto: 'Necesito 150' },
      { boton_id: 'f1m', texto: 'En 1 mes' },
      { boton_id: 'prod:PR-4B75357B', texto: 'Posacelular TRAPECIO' },
      { boton_id: 'si', texto: 'Sí, con grabado' },
      { texto: 'Logo de la empresa' },
      { texto: 'Constructora Pacífico SAC' },
      { boton_id: 'confirmar', texto: 'Confirmar pedido' },
    ],
  },
];

/** Corre un escenario contra `enviar(cuerpo) → respuesta de POST /chat`. Devuelve la última respuesta. */
export async function correrEscenario(enviar, escenario) {
  let r = await enviar({ conversacion_id: null, texto: null, boton_id: null });
  for (const paso of escenario.pasos) r = await enviar({ conversacion_id: r.conversacion_id, texto: paso.texto || null, boton_id: paso.boton_id || null });
  return r;
}
