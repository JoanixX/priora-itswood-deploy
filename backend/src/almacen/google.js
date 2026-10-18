// Cliente mínimo de Google (cuenta de servicio) sin dependencias: token OAuth con un JWT firmado (RS256) y llamadas
// REST a Sheets v4 y Drive v3. La credencial llega en GOOGLE_SERVICE_ACCOUNT_JSON (el JSON completo, o en base64).
import { createSign } from 'node:crypto';

const ALCANCES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly';
const b64url = (b) => Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

/** Lee la credencial: JSON directo o en base64 (más cómodo de pegar en Render). */
export function leerCredencial(texto) {
  if (!texto) return null;
  const limpio = texto.trim();
  const json = limpio.startsWith('{') ? limpio : Buffer.from(limpio, 'base64').toString('utf8');
  const c = JSON.parse(json);
  if (!c.client_email || !c.private_key) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON no tiene client_email y private_key');
  // Algunos paneles guardan los saltos de línea de la clave como "\n" literales.
  c.private_key = c.private_key.replace(/\\n/g, '\n');
  return c;
}

export class ClienteGoogle {
  constructor(credencial, { fetch: f = globalThis.fetch } = {}) {
    this.cred = credencial;
    this.fetch = f;
    this.token = null;
    this.vence = 0;
  }

  get correo() { return this.cred.client_email; }

  async obtenerToken() {
    if (this.token && Date.now() < this.vence - 60000) return this.token;
    const ahora = Math.floor(Date.now() / 1000);
    const uri = this.cred.token_uri || 'https://oauth2.googleapis.com/token';
    const cabecera = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const cuerpo = b64url(JSON.stringify({ iss: this.cred.client_email, scope: ALCANCES, aud: uri, iat: ahora, exp: ahora + 3600 }));
    const firma = createSign('RSA-SHA256').update(`${cabecera}.${cuerpo}`).sign(this.cred.private_key);
    const res = await this.fetch(uri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${cabecera}.${cuerpo}.${b64url(firma)}` }),
    });
    const datos = await res.json();
    if (!res.ok) throw new Error(`Google no entregó el token: ${datos.error_description || datos.error || res.status}`);
    this.token = datos.access_token;
    this.vence = Date.now() + (datos.expires_in || 3600) * 1000;
    return this.token;
  }

  async llamar(url, { method = 'GET', body } = {}) {
    const res = await this.fetch(url, {
      method,
      headers: { Authorization: `Bearer ${await this.obtenerToken()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const datos = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = new Error(datos.error?.message || `Google respondió ${res.status}`);
      e.status = res.status;
      throw e;
    }
    return datos;
  }

  hoja(id) { return `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}`; }

  /** Nombre del documento y de sus pestañas. */
  async info(id) {
    const d = await this.llamar(`${this.hoja(id)}?fields=properties.title,sheets.properties.title`);
    return { titulo: d.properties?.title || '', pestanas: (d.sheets || []).map((s) => s.properties.title) };
  }

  async leerValores(id, rango) {
    const d = await this.llamar(`${this.hoja(id)}/values/${encodeURIComponent(rango)}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`);
    return d.values || [];
  }

  async crearPestana(id, titulo) {
    await this.llamar(`${this.hoja(id)}:batchUpdate`, { method: 'POST', body: { requests: [{ addSheet: { properties: { title: titulo } } }] } });
  }

  /** Reemplaza el contenido de la pestaña completa. */
  async reemplazar(id, titulo, filas) {
    await this.llamar(`${this.hoja(id)}/values/${encodeURIComponent(titulo)}:clear`, { method: 'POST', body: {} });
    await this.llamar(`${this.hoja(id)}/values/${encodeURIComponent(`${titulo}!A1`)}?valueInputOption=RAW`, { method: 'PUT', body: { values: filas } });
  }

  /** Hojas de cálculo dentro de una carpeta de Drive. */
  async hojasDeCarpeta(carpetaId) {
    const q = `'${carpetaId}' in parents and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;
    const d = await this.llamar(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&supportsAllDrives=true&includeItemsFromAllDrives=true`);
    return d.files || [];
  }
}

/** Persistencia del almacén en la hoja GOOGLE_SHEET_ID (pestañas Config, Catalogo, Pedidos...). */
export function persistenciaSheets(cliente, sheetId) {
  let pestanas = null;
  const asegurar = async (titulo) => {
    if (!pestanas) pestanas = new Set((await cliente.info(sheetId)).pestanas);
    if (!pestanas.has(titulo)) {
      await cliente.crearPestana(sheetId, titulo);
      pestanas.add(titulo);
    }
  };
  return {
    nombre: 'sheets',
    async leer(titulo) {
      if (!pestanas) pestanas = new Set((await cliente.info(sheetId)).pestanas);
      if (!pestanas.has(titulo)) return null;
      return cliente.leerValores(sheetId, titulo);
    },
    async escribir(titulo, encabezado, filas) {
      await asegurar(titulo);
      await cliente.reemplazar(sheetId, titulo, [encabezado, ...filas]);
    },
  };
}
