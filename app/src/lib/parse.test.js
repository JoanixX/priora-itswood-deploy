import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import XLSX from 'xlsx';
import {
  parseMonto, parseFecha, parseCantidad, normalizarPlataforma, deducirTipo, limpiarDistrito,
} from './parse.js';
import ventas from '../data/ventas_2026.demo.json';

describe('parseo de montos y fechas', () => {
  it('quita S/. y comas', () => {
    expect(parseMonto('S/.1,180.00')).toBe(1180);
    expect(parseMonto('S/. 28.50')).toBe(28.5);
    expect(parseMonto('')).toBe(null);
    expect(parseMonto(45)).toBe(45);
  });
  it('lee fechas d/m/aaaa', () => {
    expect(parseFecha('5/9/2026')).toBe('2026-09-05');
    expect(parseFecha('18/09/2026')).toBe('2026-09-18');
    expect(parseFecha('')).toBe(null);
    expect(parseFecha('31/13/2026')).toBe(null);
  });
  it('cantidad no numérica es null', () => {
    expect(parseCantidad('listo')).toBe(null);
    expect(parseCantidad('20')).toBe(20);
  });
  it('normaliza plataforma y tipo', () => {
    expect(normalizarPlataforma('PAUTA CRUCES')).toBe('Pauta');
    expect(normalizarPlataforma('CLIENTE AINTUGO')).toBe('Cliente antiguo');
    expect(normalizarPlataforma('')).toBe('Otro');
    expect(deducirTipo('Acme S.A.C.', 2)).toBe('empresa');
    expect(deducirTipo('Ana', 12)).toBe('empresa');
    expect(deducirTipo('Ana', 3)).toBe('persona');
  });
  it('un distrito con dirección completa queda solo como distrito', () => {
    expect(limpiarDistrito('Av. Siempre Viva 123, San Juan de Lurigancho, 15401, LM, PE')).toBe('San Juan De Lurigancho');
  });
});

describe('JSON anonimizado', () => {
  const texto = JSON.stringify(ventas);

  it('no tiene teléfonos ni campos personales', () => {
    expect(texto).not.toMatch(/\d{9}/);
    for (const campo of ['nombre', 'telefono', 'direccion', 'ruc', 'forma_pago', 'cuenta']) {
      expect(Object.keys(ventas[0])).not.toContain(campo);
    }
  });

  it('no tiene direcciones', () => {
    for (const v of ventas) expect(v.distrito ?? '').not.toMatch(/\d|\bav\.|\bcalle\b|\bjr\.?\s/i);
  });

  const archivo = ['ventas_2026.csv', 'ventas_2026_itswood.xlsx']
    .map((n) => path.resolve(__dirname, '../../../ref', n))
    .find((p) => fs.existsSync(p));

  it.skipIf(!archivo)('no contiene nombres, teléfonos ni direcciones del archivo original', () => {
    const wb = XLSX.read(fs.readFileSync(archivo), { type: 'buffer' });
    const filas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
    const cab = filas[0].map((c) => String(c).trim().toUpperCase());
    const idx = ['NOMBRE', 'TELEFONO', 'DIRECCION'].map((c) => cab.indexOf(c));
    const minus = texto.toLowerCase();
    let revisados = 0;
    for (const f of filas.slice(1)) {
      for (const i of idx) {
        const v = String(f[i] || '').trim().toLowerCase();
        // En DIRECCION a veces solo ponen el distrito o la agencia: eso no identifica a nadie.
        const esDireccionSinNumero = cab[i] === 'DIRECCION' && !/\d/.test(v);
        if (v.length >= 6 && !esDireccionSinNumero) {
          expect(minus.includes(v), `aparece un dato original (columna ${cab[i]})`).toBe(false);
          revisados++;
        }
      }
    }
    expect(revisados).toBeGreaterThan(200);
  });
});
