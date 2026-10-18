import { describe, expect, it } from 'vitest';
import { sesionLocal, CORREO_DEMO } from './sesion.js';

describe('cuenta de demo sin backend', () => {
  const ahora = Date.parse('2026-10-17T15:00:00Z');

  it('acepta el correo de demo (sin importar mayúsculas ni espacios) con la clave configurada', () => {
    const s = sesionLocal('  JoaquinSito@gmail.com ', 'clave-prueba', 'clave-prueba', ahora);
    expect(s.correo).toBe(CORREO_DEMO);
    expect(s.local).toBe(true);
    expect(s.token.startsWith('local.')).toBe(true);
    expect(Date.parse(s.expira_en) - ahora).toBe(12 * 60 * 60 * 1000);
  });

  it('rechaza otra clave, otro correo o la falta de VITE_DEMO_PASSWORD', () => {
    expect(sesionLocal(CORREO_DEMO, 'otra', 'clave-prueba', ahora)).toBeNull();
    expect(sesionLocal('otro@gmail.com', 'clave-prueba', 'clave-prueba', ahora)).toBeNull();
    expect(sesionLocal(CORREO_DEMO, '', '', ahora)).toBeNull();
  });
});
