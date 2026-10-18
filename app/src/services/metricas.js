import { pedir, conRespaldo } from './api.js';
import { demo } from './demo/store.js';

// El contrato usa periodo=2026 para todo el año y periodo=aaaa-mm para un mes.
const aPeriodoApi = (periodo) => (periodo === 'todo' ? '2026' : periodo);

/** Respuesta de GET /metricas (forma del contrato) → lo que usa Inicio. */
function adaptar(m) {
  const t = m.tiempo_primera_respuesta || {};
  const c = m.conversion_consultas || {};
  return {
    ejemplo: Boolean(m.ejemplo),
    tiempo_primera_respuesta_seg: t.despues_min != null ? t.despues_min * 60 : null,
    tiempo_primera_respuesta_antes_min: t.antes_min ?? null,
    conversaciones: c.consultas ?? null,
    conversaciones_con_pedido: c.pedidos ?? null,
    conversion: c.porcentaje != null ? c.porcentaje / 100 : null,
  };
}

/**
 * Métricas que salen de los registros de Mermín. Las de ventas (ticket, clientes,
 * corporativos) las calcula el frontend con el histórico anonimizado.
 * En modo ejemplo: valores rotulados "Ejemplo" + lo que pase en el chat de esta demo.
 */
export async function obtenerMetricasChat(periodo = 'todo') {
  const respuesta = await conRespaldo(
    () => pedir(`/metricas?periodo=${encodeURIComponent(aPeriodoApi(periodo))}`),
    async () => {
      const base = { consultas: 42, pedidos: 15, tiempos_seg: [3, 4, 2, 5, 3] };
      const conv = demo.conversaciones.filter((c) => c.inicio);
      const tiempos = [...base.tiempos_seg, ...conv.map((c) => c.primera_respuesta_seg).filter((x) => x != null)];
      const consultas = base.consultas + conv.length;
      const pedidos = base.pedidos + conv.filter((c) => c.pedido_id).length;
      return {
        ejemplo: true,
        tiempo_primera_respuesta: {
          antes_min: demo.config.metricas?.tiempo_respuesta_antes_min ?? null,
          despues_min: tiempos.reduce((a, b) => a + b, 0) / tiempos.length / 60,
          fuente: 'registros de Mermín',
        },
        conversion_consultas: { consultas, pedidos, porcentaje: (pedidos / consultas) * 100 },
      };
    },
    { rutaPropuesta: true },
  );
  return adaptar(respuesta);
}
