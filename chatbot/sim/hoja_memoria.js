'use strict';

// Hoja de cálculo en memoria con el mismo comportamiento que se espera de los nodos de Google Sheets:
// leer filas por columna, añadir filas y actualizar solo las columnas indicadas de la fila que coincide.
// `interceptar(operacion, tabla)` permite simular caídas o cambios manuales durante una prueba.

const fs = require('fs');
const { PESTANAS } = require('../src/hojas');

function leerCsv(ruta) {
  const [cabecera, ...lineas] = fs.readFileSync(ruta, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
  const columnas = cabecera.split(',');
  return lineas.map(linea => {
    const valores = linea.split(',');
    return Object.fromEntries(columnas.map((c, i) => [c, valores[i] === undefined ? '' : valores[i]]));
  });
}

class HojaMemoria {
  constructor(catalogo, inventario) {
    this.tablas = {};
    for (const nombre of Object.values(PESTANAS)) this.tablas[nombre] = [];
    this.tablas[PESTANAS.catalogo] = catalogo || [];
    this.tablas[PESTANAS.inventario] = inventario || [];
    this.interceptar = null;
    this.operaciones = 0;
  }

  _antes(operacion, tabla) {
    this.operaciones += 1;
    if (this.interceptar) this.interceptar(operacion, tabla, this);
  }

  leer(tabla, columna, valor) {
    this._antes('leer', tabla);
    const filas = this.tablas[tabla];
    const r = columna ? filas.filter(f => String(f[columna]) === String(valor)) : filas;
    return r.map(f => ({ ...f }));
  }

  agregar(tabla, fila) {
    this._antes('agregar', tabla);
    this.tablas[tabla].push({ ...fila });
  }

  // appendOrUpdate: actualiza las columnas dadas en la fila coincidente o añade una fila nueva.
  guardar(tabla, clave, fila) {
    this._antes('guardar', tabla);
    const existente = this.tablas[tabla].find(f => String(f[clave]) === String(fila[clave]));
    if (existente) Object.assign(existente, fila);
    else this.tablas[tabla].push({ ...fila });
  }

  // clear (conservando la cabecera) + append: así vuelca la sincronización de Drive.
  reemplazar(tabla, filas) {
    this._antes('reemplazar', tabla);
    this.tablas[tabla] = (filas || []).map(f => ({ ...f }));
  }

  // update: solo si la fila existe.
  actualizar(tabla, clave, fila) {
    this._antes('actualizar', tabla);
    const existente = this.tablas[tabla].find(f => String(f[clave]) === String(fila[clave]));
    if (existente) Object.assign(existente, fila);
    return !!existente;
  }
}

module.exports = { HojaMemoria, leerCsv };
