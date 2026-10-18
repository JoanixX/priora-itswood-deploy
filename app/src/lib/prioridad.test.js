import { describe, it, expect } from 'vitest';
import { calcularPrioridad, enriquecer, ordenarPorPrioridad, ordenarBandeja, validarConfig } from './prioridad.js';
import { CONFIG_DEMO } from '../data/configDemo.js';

const HOY = '2026-10-17';
const cfg = structuredClone(CONFIG_DEMO);
const p = (x) => ({ id: x.id || 'X', origen: 'mermin', tipo: 'empresa', cantidad: 20, monto: 400, fecha_entrega: '2026-12-15', estado: 'Nuevo', ...x });

describe('calcularPrioridad', () => {
  it('empresa con 30+ u. es alta', () => expect(calcularPrioridad(p({ cantidad: 30 }), cfg, HOY).prioridad).toBe('alta'));
  it('empresa 12–29 con fecha holgada es media', () => expect(calcularPrioridad(p({}), cfg, HOY).prioridad).toBe('media'));
  it('más de 100 u. se deriva', () => expect(calcularPrioridad(p({ cantidad: 150 }), cfg, HOY).prioridad).toBe('derivado'));
  it('persona simple es automático', () => expect(calcularPrioridad(p({ tipo: 'persona', cantidad: 1, monto: 60 }), cfg, HOY).prioridad).toBe('automatico'));
  it('persona con fecha cercana es media', () => expect(calcularPrioridad(p({ tipo: 'persona', cantidad: 1, monto: 60, fecha_entrega: '2026-10-20' }), cfg, HOY).prioridad).toBe('media'));
  it('un pedido de mucho valor sube a alta', () => expect(calcularPrioridad(p({ tipo: 'persona', cantidad: 5, monto: 1500 }), cfg, HOY).prioridad).toBe('alta'));
  it('sin peso del valor, el monto no sube la prioridad', () => {
    const sinValor = { ...cfg, prioridad: { ...cfg.prioridad, peso_valor: false } };
    expect(calcularPrioridad(p({ tipo: 'persona', cantidad: 5, monto: 1500 }), sinValor, HOY).prioridad).toBe('automatico');
  });
  it('reclamo se deriva si está activado', () => {
    expect(calcularPrioridad(p({ flags: { reclamo: true } }), cfg, HOY).prioridad).toBe('derivado');
    const sinReclamos = { ...cfg, derivar: { ...cfg.derivar, reclamos: false } };
    expect(calcularPrioridad(p({ flags: { reclamo: true } }), sinReclamos, HOY).prioridad).toBe('media');
  });
  it('el motivo se explica en texto', () => expect(calcularPrioridad(p({ cantidad: 30, ya_compro_antes: true }), cfg, HOY).motivo).toContain('ya compró antes'));
});

describe('ordenarPorPrioridad', () => {
  const lista = [
    p({ id: 'auto', tipo: 'persona', cantidad: 1, monto: 50 }),
    p({ id: 'media', cantidad: 20 }),
    p({ id: 'alta-tarde', cantidad: 40, fecha_entrega: '2026-12-20' }),
    p({ id: 'alta-pronto', cantidad: 40, fecha_entrega: '2026-11-20' }),
    p({ id: 'derivado', cantidad: 150, fecha_entrega: '2026-12-01' }),
    p({ id: 'entregado', cantidad: 60, estado: 'Entregado', origen: 'historico' }),
  ];
  it('derivado y alta primero (por fecha), luego media, luego automático, y lo entregado al final', () => {
    const orden = ordenarPorPrioridad(enriquecer(lista, cfg, HOY)).map((x) => x.id);
    expect(orden).toEqual(['alta-pronto', 'derivado', 'alta-tarde', 'media', 'auto', 'entregado']);
  });
  it('recalcula con umbrales cambiados', () => {
    const cfg2 = { ...cfg, reglas: { ...cfg.reglas, umbral_alta: 15, maximo_sin_derivar: 30 } };
    const orden = ordenarPorPrioridad(enriquecer(lista, cfg2, HOY));
    expect(orden.find((x) => x.id === 'media').prioridad).toBe('alta');
    expect(orden.find((x) => x.id === 'alta-pronto').prioridad).toBe('derivado');
  });
  it('a igual prioridad y fecha, primero el de más valor', () => {
    const orden = ordenarPorPrioridad(enriquecer([p({ id: 'a', cantidad: 40, monto: 500 }), p({ id: 'b', cantidad: 40, monto: 900 })], cfg, HOY));
    expect(orden.map((x) => x.id)).toEqual(['b', 'a']);
  });
});

describe('validarConfig', () => {
  it('acepta la configuración por defecto', () => expect(validarConfig(cfg)).toEqual({}));
  it('exige minimo_empresa < umbral_alta < maximo_sin_derivar', () => {
    expect(validarConfig({ ...cfg, reglas: { ...cfg.reglas, umbral_alta: 10 } })).toHaveProperty('umbral_alta');
    expect(validarConfig({ ...cfg, reglas: { ...cfg.reglas, maximo_sin_derivar: 30 } })).toHaveProperty('maximo_sin_derivar');
  });
  it('limita nombre, saludo y margen', () => {
    const e = validarConfig({ ...cfg, asistente: 'x'.repeat(21), textos: { saludo: '' }, prioridad: { ...cfg.prioridad, margen_estimado: 1.5 } });
    expect(Object.keys(e)).toEqual(expect.arrayContaining(['asistente', 'saludo', 'margen_estimado']));
  });
});

describe('ordenarBandeja', () => {
  const AHORA = new Date('2026-10-17T22:00:00-05:00').getTime();
  const hace = (min) => new Date(AHORA - min * 60000).toISOString();
  const lista = enriquecer([
    p({ id: 'vieja-pronto', cantidad: 45, fecha_entrega: '2026-10-26', estado_api: 'nuevo', creado_en: hace(140) }),
    p({ id: 'nueva-tarde', cantidad: 30, fecha_entrega: '2026-12-15', estado_api: 'nuevo', creado_en: hace(1) }),
    p({ id: 'derivada-media-hora', cantidad: 150, fecha_entrega: '2026-11-16', estado_api: 'nuevo', creado_en: hace(30) }),
    p({ id: 'de-ayer', cantidad: 40, fecha_entrega: '2026-10-20', estado_api: 'nuevo', creado_en: hace(60 * 30) }),
    p({ id: 'confirmada', cantidad: 40, fecha_entrega: '2026-10-19', estado_api: 'confirmado', creado_en: hace(5) }),
    p({ id: 'historico', origen: 'historico', cantidad: 40, fecha_entrega: '2026-10-18', estado: 'Pendiente' }),
    p({ id: 'automatico', tipo: 'persona', cantidad: 1, monto: 50, estado_api: 'nuevo', creado_en: hace(2) }),
  ], cfg, HOY);
  const orden = ordenarBandeja(ordenarPorPrioridad(lista), 10, AHORA).map((x) => x.id);

  it('lo recién llegado de Mermín va primero, del más nuevo al más antiguo', () => {
    expect(orden.slice(0, 3)).toEqual(['nueva-tarde', 'derivada-media-hora', 'vieja-pronto']);
  });
  it('después va el resto por prioridad y fecha (lo de más de 24 h y el histórico)', () => {
    expect(orden.slice(3)).toEqual(['de-ayer', 'historico']);
  });
  it('no incluye lo confirmado ni lo automático, y respeta el límite', () => {
    expect(orden).not.toContain('confirmada');
    expect(orden).not.toContain('automatico');
    expect(ordenarBandeja(ordenarPorPrioridad(lista), 2, AHORA)).toHaveLength(2);
  });
});
