import { pedir, conRespaldo } from './api.js';
import { demo } from './demo/store.js';
import { calcularSegmentos, recomendaciones, borradores, canalCorto } from '../lib/segmentos.js';
import ventas from '../data/ventas_2026.demo.json';

// Rutas propuestas por el frontend (ver docs/API_CONTRATO.md). Sin backend: reglas locales.

export async function listarSegmentos() {
  const locales = calcularSegmentos(ventas);
  return conRespaldo(
    async () => {
      // El backend manda el resumen ({ id, nombre, clientes, monto, ultima_compra });
      // la lista de alias y los productos top salen del histórico local.
      const remotos = await pedir('/segmentos');
      return remotos.map((r) => {
        const local = locales.find((l) => l.id === r.id) || { clientes: [], top_productos: [] };
        return { ...local, id: r.id, nombre: r.nombre, tamano: r.clientes, monto: r.monto, ultima: r.ultima_compra };
      });
    },
    async () => locales,
    { rutaPropuesta: true },
  );
}

/** Forma del contrato: { segmento, recomendaciones: [{ titulo, motivo, canal, mensaje_borrador }], secuencia_postventa: [texto] } */
export async function obtenerRecomendaciones(segmento) {
  return conRespaldo(
    () => pedir(`/segmentos/${segmento.id}/recomendaciones`),
    async () => {
      const b = borradores(segmento, demo.config.negocio);
      return {
        segmento: segmento.id,
        recomendaciones: recomendaciones(segmento, demo.config.negocio)
          .map((r) => ({ ...r, canal: canalCorto(segmento.id), mensaje_borrador: b.principal })),
        secuencia_postventa: b.secuencia.map((m) => m.texto),
      };
    },
    { rutaPropuesta: true },
  );
}
