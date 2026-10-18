'use strict';

// Cliente de prueba de la API de n8n. La URL y la clave se leen de .n8n-local.md.
// Uso: node sim/llamar_api.js GET salud
//      node sim/llamar_api.js GET "solicitudes?intencion=ALTA"
//      node sim/llamar_api.js POST mensaje '{"wa_id":"51900000011","texto":"Hola"}'

const fs = require('fs');
const path = require('path');

const [metodo = 'GET', ruta = 'salud', cuerpo] = process.argv.slice(2);
const local = fs.readFileSync(path.join(__dirname, '..', '.n8n-local.md'), 'utf8');
const base = (local.match(/API: (\S+)\/<ruta>/) || [])[1];
const clave = (local.match(/Cabecera API X-Api-Key: (\S+)/) || [])[1];

(async () => {
  const r = await fetch(`${base}/${ruta}`, {
    method: metodo,
    headers: { 'X-Api-Key': clave, ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
    body: cuerpo,
  });
  const texto = await r.text();
  let salida = texto;
  try { salida = JSON.stringify(JSON.parse(texto), null, 2); } catch (e) { /* no es JSON */ }
  console.log(`HTTP ${r.status}\n${salida}`);
})();
