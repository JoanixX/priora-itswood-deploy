'use strict';

// Envía un mensaje simulado al webhook de prueba de n8n y muestra la respuesta del bot.
// Uso: node sim/enviar_prueba.js "<texto>" [wa_id]   (la clave se lee de .n8n-local.md)

const fs = require('fs');
const path = require('path');
const ev = require('./eventos');

const [texto, waId = '51900000001'] = process.argv.slice(2);
const local = fs.readFileSync(path.join(__dirname, '..', '.n8n-local.md'), 'utf8');
const clave = (local.match(/X-Api-Key: (\S+)/) || [])[1];
const url = (local.match(/POST (\S+)/) || [])[1];

(async () => {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': clave },
    // ID único por envío: con un ID repetido n8n lo descarta como duplicado (eso es lo esperado).
    body: JSON.stringify(ev.mensaje(waId, texto, { perfil: 'Prueba Bot', id: `wamid.PRUEBA${Date.now()}` })),
  });
  const cuerpo = await r.text();
  let filas;
  try { filas = JSON.parse(cuerpo); } catch (e) { console.log(r.status, cuerpo.slice(0, 500)); return; }
  for (const f of [].concat(filas)) console.log(`[${r.status}] ${f.resultado || ''}\n${f.texto || JSON.stringify(f).slice(0, 300)}\n`);
})();
