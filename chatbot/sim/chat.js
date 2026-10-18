'use strict';

// Chat local para probar el bot desde la terminal, sin WhatsApp ni Google Sheets.
// Comandos: /tomar [mensaje], /responder <mensaje>, /bot, /cerrar, /cliente <número>, /imagen, /audio, /hoja <pestaña>, /salir

const path = require('path');
const readline = require('readline');
const { HojaMemoria, leerCsv } = require('./hoja_memoria');
const { recibirWebhook, accionHumana } = require('./pipeline');
const ev = require('./eventos');

const hoja = new HojaMemoria(leerCsv(path.join(__dirname, '..', 'hoja', 'catalogo_bot.csv')));
let cliente = '51987000001';
let n = 0;
const entorno = {
  hoja,
  config: { phoneNumberId: 'LOCAL', waAvisos: '51900000099' },
  enviar: async envio => {
    const quien = envio.aviso ? '🔔 aviso al equipo' : envio.humano ? '👩 equipo' : '🤖 bot';
    console.log(`\n${quien} → ${envio.to}\n${envio.texto}\n`);
    return { messages: [{ id: `wamid.LOCAL${++n}` }] };
  },
};

async function humano(accion, mensaje) {
  const enviarOriginal = entorno.enviar;
  entorno.enviar = envio => enviarOriginal({ ...envio, humano: true });
  const r = await accionHumana({ 'WhatsApp del cliente': cliente, 'Acción': accion, 'Mensaje al cliente': mensaje, 'Responsable': 'Equipo' }, entorno);
  entorno.enviar = enviarOriginal;
  console.log(`[formulario] ${r.texto_resultado}`);
}

async function manejar(linea) {
  const [cmd, ...resto] = linea.trim().split(' ');
  const arg = resto.join(' ');
  switch (cmd) {
    case '/salir': process.exit(0); break;
    case '/cliente': cliente = arg.replace(/\D/g, '') || cliente; console.log(`[cliente activo: ${cliente}]`); return;
    case '/tomar': return humano('Tomar caso', arg);
    case '/responder': return humano('Responder', arg);
    case '/bot': return humano('Devolver al bot', arg);
    case '/cerrar': return humano('Cerrar caso', arg);
    case '/hoja': console.table(hoja.tablas[arg || 'BOT_CONVERSACIONES']); return;
    case '/imagen': return recibirWebhook(ev.mensaje(cliente, ev.imagen(`MEDIA${Date.now()}`, arg)), entorno);
    case '/audio': return recibirWebhook(ev.mensaje(cliente, ev.audio(`MEDIA${Date.now()}`)), entorno);
    default:
      if (!linea.trim()) return;
      await recibirWebhook(ev.mensaje(cliente, linea), entorno);
      if (!n) return;
  }
}

console.log('Chat local de ITS WOOD. Escribe como si fueras el cliente. /salir para terminar.');
console.log('Comandos: /tomar [msg] · /responder <msg> · /bot · /cerrar · /cliente <número> · /imagen [texto] · /audio · /hoja [pestaña]\n');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: `👤 ` });
rl.prompt();
let cola = Promise.resolve();
rl.on('line', linea => { cola = cola.then(() => manejar(linea)).catch(e => console.error('Error:', e.message)).then(() => rl.prompt()); });
