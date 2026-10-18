import { describe, it, expect } from 'vitest';
import ventas from '../data/ventas_2026.demo.json';
import { calcularMetricas } from './metricas.js';

// Valores de control calculados por el equipo sobre el CSV original.
describe('métricas con valores de control', () => {
  const m = calcularMetricas(ventas, 'todo');
  it('unos 264 registros con cliente', () => expect(m.registros).toBe(264));
  it('monto total entre S/ 101,000 y 107,000', () => {
    expect(m.total).toBeGreaterThanOrEqual(101000);
    expect(m.total).toBeLessThanOrEqual(107500);
  });
  it('pedidos de 12+ u. ≈ 86 % del monto', () => expect(m.pctGrandes).toBeCloseTo(0.86, 1));
  it('ticket promedio ≈ S/ 420 (empresa ≈ 700, persona ≈ 117)', () => {
    expect(m.ticket).toBeGreaterThan(400);
    expect(m.ticket).toBeLessThan(440);
    expect(m.ticketEmpresa).toBeGreaterThan(650);
    expect(m.ticketEmpresa).toBeLessThan(750);
    expect(m.ticketPersona).toBeGreaterThan(100);
    expect(m.ticketPersona).toBeLessThan(130);
  });
  it('entre 208 y 227 clientes, unos 27 con 2+ pedidos', () => {
    expect(m.clientes).toBeGreaterThanOrEqual(208);
    expect(m.clientes).toBeLessThanOrEqual(227);
    expect(m.recurrentes).toBeGreaterThanOrEqual(24);
    expect(m.recurrentes).toBeLessThanOrEqual(30);
  });
  it('WhatsApp ≈ 54 % del monto', () => expect(m.porCanal.find((c) => c.canal === 'WhatsApp').pct).toBeCloseTo(0.54, 1));
  it('un mes filtra por fecha de pedido', () => {
    const sep = calcularMetricas(ventas, '2026-09');
    expect(sep.registros).toBeGreaterThan(0);
    expect(sep.total).toBeLessThan(m.total);
    expect(sep.corporativosMes).toBe(sep.corporativosPorMes.find((x) => x.mes === '2026-09').pedidos);
  });
});
