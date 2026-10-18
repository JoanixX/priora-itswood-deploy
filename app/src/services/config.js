import { pedir, conRespaldo } from './api.js';
import { demo } from './demo/store.js';
import { CONFIG_DEMO } from '../data/configDemo.js';

// Los campos propuestos (bienvenida, prioridad, notificaciones…) pueden no venir
// del backend todavía: se completan con los valores por defecto.
function completar(cfg) {
  const out = structuredClone(CONFIG_DEMO);
  for (const [k, v] of Object.entries(cfg || {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? { ...out[k], ...v } : v;
  }
  return out;
}

export async function obtenerConfig() {
  return conRespaldo(async () => completar(await pedir('/config')), async () => structuredClone(demo.config));
}

export async function guardarConfig(cambios) {
  return conRespaldo(
    async () => completar(await pedir('/config', { method: 'PATCH', body: cambios })),
    async () => {
      demo.config = completar({ ...demo.config, ...cambios });
      return structuredClone(demo.config);
    },
  );
}
