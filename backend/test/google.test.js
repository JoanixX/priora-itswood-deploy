// Cliente de Google con una clave RSA generada y un fetch simulado: firma del JWT y llamadas a Sheets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import { ClienteGoogle, leerCredencial, persistenciaSheets } from '../src/almacen/google.js';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const credencialJson = JSON.stringify({ client_email: 'priora@demo.iam.gserviceaccount.com', private_key: pem.replace(/\n/g, '\\n'), token_uri: 'https://oauth2.googleapis.com/token' });

test('credencial: JSON directo, base64 y \\n literales en la clave', () => {
  assert.equal(leerCredencial(credencialJson).client_email, 'priora@demo.iam.gserviceaccount.com');
  assert.match(leerCredencial(Buffer.from(credencialJson).toString('base64')).private_key, /^-----BEGIN PRIVATE KEY-----\n/);
  assert.equal(leerCredencial(''), null);
  assert.throws(() => leerCredencial('{"client_email":"x"}'), /private_key/);
});

test('token con JWT RS256 firmado y persistencia en pestañas', async () => {
  const llamadas = [];
  const fetchFalso = async (url, op = {}) => {
    llamadas.push({ url: String(url), method: op.method || 'GET', body: op.body });
    const json = (d) => ({ ok: true, status: 200, json: async () => d });
    if (String(url).includes('oauth2')) {
      const jwt = new URLSearchParams(String(op.body)).get('assertion');
      const [h, c, firma] = jwt.split('.');
      const valida = createVerify('RSA-SHA256').update(`${h}.${c}`).verify(publicKey, Buffer.from(firma, 'base64url'));
      assert.ok(valida, 'firma RS256 válida');
      const claims = JSON.parse(Buffer.from(c, 'base64url').toString());
      assert.match(claims.scope, /spreadsheets/);
      assert.match(claims.scope, /drive\.readonly/);
      return json({ access_token: 'TOKEN', expires_in: 3600 });
    }
    assert.equal(op.headers.Authorization, 'Bearer TOKEN');
    if (String(url).endsWith('fields=properties.title,sheets.properties.title')) return json({ properties: { title: 'Priora' }, sheets: [{ properties: { title: 'Config' } }] });
    if (String(url).includes('/values/Config?')) return json({ values: [['clave', 'valor'], ['asistente', 'Mermín']] });
    return json({});
  };
  const google = new ClienteGoogle(leerCredencial(credencialJson), { fetch: fetchFalso });
  const p = persistenciaSheets(google, 'SHEET');
  assert.deepEqual(await p.leer('Config'), [['clave', 'valor'], ['asistente', 'Mermín']]);
  assert.equal(await p.leer('Pedidos'), null, 'pestaña que no existe');
  await p.escribir('Pedidos', ['id'], [['PED-0001']]);
  const metodos = llamadas.map((l) => `${l.method} ${l.url.replace('https://sheets.googleapis.com/v4/spreadsheets/SHEET', '')}`);
  assert.ok(metodos.includes('POST :batchUpdate'), 'crea la pestaña Pedidos');
  assert.ok(metodos.includes('POST /values/Pedidos:clear'));
  assert.ok(metodos.some((m) => m.startsWith('PUT /values/Pedidos!A1?valueInputOption=RAW')));
  assert.equal(llamadas.filter((l) => l.url.includes('oauth2')).length, 1, 'el token se reutiliza');
});
