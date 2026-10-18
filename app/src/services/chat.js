import { pedir, conRespaldo } from './api.js';
import { responderDemo } from './demo/chatSim.js';

/** POST /chat. En modo ejemplo responde el chat guiado local. */
export async function enviarMensaje({ conversacion_id = null, texto = null, boton_id = null }) {
  return conRespaldo(
    () => pedir('/chat', { method: 'POST', body: { conversacion_id, texto, boton_id } }),
    () => responderDemo({ conversacion_id, texto, boton_id }),
  );
}

/** Conversaciones de un clic para el pitch: funcionan aunque falle el internet o la IA. */
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
