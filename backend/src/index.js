// Arranque: lee las variables de entorno, carga el almacén (memoria o Google Sheets) y escucha en PORT.
// Variables: ver backend/env.example.
process.env.TZ = process.env.TZ || 'America/Lima';

const { readFileSync } = await import('node:fs');
const { Almacen } = await import('./almacen/index.js');
const { ClienteGoogle, leerCredencial, persistenciaSheets } = await import('./almacen/google.js');
const { iniciarServidor } = await import('./servidor.js');
const { crearAuth } = await import('./auth.js');

const env = process.env;
const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8').replace(/^﻿/, '')).version;
const origenes = (env.FRONTEND_ORIGIN || '*').split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);

let google = null;
try {
  const credencial = leerCredencial(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  if (credencial) google = new ClienteGoogle(credencial);
} catch (e) {
  console.error(`[inicio] GOOGLE_SERVICE_ACCOUNT_JSON no es válido: ${e.message}`);
  process.exit(1);
}
if (env.GOOGLE_SHEET_ID && !google) {
  console.error('[inicio] Hay GOOGLE_SHEET_ID pero falta GOOGLE_SERVICE_ACCOUNT_JSON');
  process.exit(1);
}

const almacen = new Almacen({
  persistencia: google && env.GOOGLE_SHEET_ID ? persistenciaSheets(google, env.GOOGLE_SHEET_ID) : null,
  ejemplos: env.SEMBRAR_EJEMPLOS !== 'false',
});
try {
  await almacen.iniciar();
} catch (e) {
  console.error(`[inicio] No pude leer la hoja ${env.GOOGLE_SHEET_ID}: ${e.message}. ¿La compartiste con ${google?.correo} como editor?`);
  process.exit(1);
}

// Login de demo: solo si están ADMIN_EMAIL y ADMIN_PASSWORD. Si falta uno de los dos, el dashboard queda abierto.
if (Boolean(env.ADMIN_EMAIL) !== Boolean(env.ADMIN_PASSWORD)) console.warn('[inicio] Falta ADMIN_EMAIL o ADMIN_PASSWORD: el login queda desactivado');
const auth = crearAuth({ correo: env.ADMIN_EMAIL, contrasena: env.ADMIN_PASSWORD, secreto: env.AUTH_SECRET });
if (auth?.secretoAleatorio) console.warn('[inicio] Falta AUTH_SECRET: las sesiones se cierran en cada reinicio');

const servidor = await iniciarServidor({ almacen, google, origenes, version, auth }, Number(env.PORT) || 3000);
console.log(`[inicio] Priora backend ${version} en el puerto ${servidor.address().port} · almacén: ${almacen.modo} · Google: ${google ? google.correo : 'no'} · login: ${auth ? auth.correo : 'desactivado'} · CORS: ${origenes.join(', ')}`);

// Render manda SIGTERM al redeploy: se escribe lo pendiente antes de salir.
for (const senal of ['SIGTERM', 'SIGINT']) {
  process.on(senal, async () => {
    servidor.close();
    await almacen.vaciar();
    process.exit(0);
  });
}
