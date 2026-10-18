// Fuentes de datos (vista Datos): la dueña pega el enlace de una hoja de Google Sheets o de una carpeta de Drive y
// la comparte con el correo de la cuenta de servicio. El backend la lee con esa cuenta: ventas → segmentos y
// métricas, catálogo → catálogo activo. Clientes y pedidos se leen y se cuentan (todavía no alimentan otras vistas).
import { aObjetos, catalogoDesdeFilas } from './catalogo.js';
import { parseMonto, parseFecha, claveColumna } from './formato.js';
import { agregarNotificacion } from './pedidos.js';

export const TIPOS = {
  ventas: { nombre: 'Ventas', requeridas: ['cliente', 'producto', 'cantidad'] },
  pedidos: { nombre: 'Pedidos', requeridas: ['cliente', 'producto', 'cantidad'] },
  clientes: { nombre: 'Clientes', requeridas: ['cliente'] },
  catalogo: { nombre: 'Catálogo', requeridas: ['producto', 'precio'] },
};

export function recursoDeUrl(url) {
  const u = String(url || '').trim();
  let m = u.match(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]{10,})/);
  if (m) return { clase: 'hoja', id: m[1] };
  m = u.match(/^https:\/\/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([A-Za-z0-9_-]{10,})/);
  if (m) return { clase: 'carpeta', id: m[1] };
  return null;
}

const RAZON_SOCIAL = /\b(s\.?a\.?c|s\.?a\.?a|s\.?a|e\.?i\.?r\.?l|s\.?r\.?l|corp(oraci[oó]n)?|inversiones|colegio|cl[ií]nica|estudio|constructora|empresa|universidad|banco|grupo)\b\.?/i;
const deducirTipo = (nombre, cantidad, minimo) => (RAZON_SOCIAL.test(String(nombre || '')) || (cantidad || 0) >= minimo ? 'empresa' : 'persona');
const valor = (f, ...claves) => { for (const k of claves) if (f[k] !== undefined && f[k] !== '') return f[k]; return ''; };

/** Filas de una hoja de ventas (columnas de la vista Datos) → ventas en la forma del histórico. */
export function ventasDesdeFilas(filas, minimoEmpresa = 12) {
  return filas.map((f, i) => {
    const cantidad = Number.parseInt(valor(f, 'cantidad'), 10) || 0;
    const precio = parseMonto(valor(f, 'precio unitario', 'precio'));
    const delivery = parseMonto(valor(f, 'delivery')) || 0;
    const monto = parseMonto(valor(f, 'monto', 'total')) ?? (precio !== null ? precio * cantidad + delivery : null);
    const cliente = String(valor(f, 'cliente')).trim();
    return {
      id: `H-${String(i + 1).padStart(4, '0')}`, cliente, tipo: String(valor(f, 'tipo', 'tipo (empresa/persona)')).toLowerCase().startsWith('emp') ? 'empresa' : deducirTipo(cliente, cantidad, minimoEmpresa),
      fecha_pedido: parseFecha(valor(f, 'fecha de pedido', 'fecha')), fecha_entrega: parseFecha(valor(f, 'fecha de entrega')),
      plataforma: String(valor(f, 'plataforma')).trim() || 'Otro', distrito: String(valor(f, 'distrito')).trim(),
      producto: String(valor(f, 'producto')).trim(), cantidad, precio_unitario: precio, delivery, monto,
      estado: String(valor(f, 'estado')).trim() || 'Pendiente', grabado: /grab|logo|nombre|frase|personaliz/i.test(String(valor(f, 'detalles', 'personalizacion'))),
    };
  }).filter((v) => v.cliente && v.producto);
}

/** Filas de una hoja de pedidos → pedidos en la forma del almacén. */
export function pedidosDesdeFilas(filas, minimoEmpresa = 12, catalogo = []) {
  return filas.map((f, i) => {
    const clienteNombre = String(valor(f, 'cliente')).trim();
    const cantidad = Number.parseInt(valor(f, 'cantidad'), 10) || 1;
    const tipoTxt = String(valor(f, 'tipo (empresa/persona)', 'tipo')).toLowerCase();
    const tipo = tipoTxt.startsWith('emp') ? 'empresa' : tipoTxt.startsWith('per') ? 'persona' : deducirTipo(clienteNombre, cantidad, minimoEmpresa);
    const prodNombre = String(valor(f, 'producto')).trim();
    const delCat = catalogo.find((p) => p.nombre.toLowerCase() === prodNombre.toLowerCase());
    const precio = parseMonto(valor(f, 'precio unitario', 'precio')) ?? delCat?.precio ?? 0;
    const estadoRaw = String(valor(f, 'estado')).trim().toLowerCase();
    const estado = ['nuevo', 'derivado', 'confirmado'].includes(estadoRaw) ? estadoRaw : 'nuevo';
    const fechaPedido = parseFecha(valor(f, 'fecha', 'fecha de pedido')) || new Date().toISOString().slice(0, 10);
    return {
      id: String(valor(f, 'id')).trim() || `PED-H${String(i + 1).padStart(3, '0')}`,
      creado_en: `${fechaPedido}T12:00:00.000Z`,
      estado,
      ejemplo: false,
      cliente: {
        nombre: tipo === 'persona' ? clienteNombre : null,
        empresa: tipo === 'empresa' ? clienteNombre : null,
        telefono: String(valor(f, 'telefono') || '').trim() || null,
        correo: String(valor(f, 'correo') || '').trim() || null,
        tipo,
        ya_compro_antes: false,
      },
      ocasion: String(valor(f, 'ocasion') || '').trim() || null,
      cantidad_total: cantidad,
      fecha_requerida: parseFecha(valor(f, 'fecha requerida', 'fecha de entrega')),
      productos: [{ producto_id: delCat?.id || `PR-H${i + 1}`, nombre: prodNombre, cantidad, precio_unitario: precio }],
      personalizacion: String(valor(f, 'personalizacion', 'detalles') || '').trim() || null,
      entrega: null,
      flags: {},
      resumen: `Importado desde hoja de pedidos (${cantidad} × ${prodNombre}).`,
      conversacion_id: null,
    };
  }).filter((p) => (p.cliente.nombre || p.cliente.empresa) && p.productos[0]?.nombre);
}

/** Filas de una hoja de clientes → clientes en la forma del almacén. */
export function clientesDesdeFilas(filas, minimoEmpresa = 12) {
  return filas.map((f) => {
    const nombre = String(valor(f, 'cliente', 'nombre')).trim();
    const tipoTxt = String(valor(f, 'tipo (empresa/persona)', 'tipo')).toLowerCase();
    const tipo = tipoTxt.startsWith('emp') ? 'empresa' : tipoTxt.startsWith('per') ? 'persona' : deducirTipo(nombre, 0, minimoEmpresa);
    return {
      cliente: nombre,
      nombre: tipo === 'persona' ? nombre : null,
      empresa: tipo === 'empresa' ? nombre : null,
      tipo,
      telefono: String(valor(f, 'telefono') || '').trim() || null,
      correo: String(valor(f, 'correo', 'email') || '').trim() || null,
      distrito: String(valor(f, 'distrito') || '').trim() || null,
      pedidos: Number.parseInt(valor(f, 'pedidos'), 10) || 1,
      ultimo_pedido: String(valor(f, 'ultimo_pedido', 'ultima compra') || '').trim() || null,
    };
  }).filter((c) => c.nombre || c.empresa);
}

function aplicarFilasAFuente(almacen, fuente, filas) {
  const minEmp = almacen.datos.config?.reglas?.minimo_empresa ?? 12;
  if (!almacen.datos.fuentesFilas) almacen.datos.fuentesFilas = {};
  if (fuente.tipo === 'ventas') {
    const ventas = ventasDesdeFilas(filas, minEmp);
    almacen.datos.ventas = ventas;
    almacen.datos.fuentesFilas[fuente.id] = ventas;
    almacen.guardar('ventas');
  } else if (fuente.tipo === 'catalogo') {
    const cat = catalogoDesdeFilas(filas);
    almacen.datos.catalogo = cat;
    almacen.datos.fuentesFilas[fuente.id] = cat;
    almacen.guardar('catalogo');
  } else if (fuente.tipo === 'pedidos') {
    const peds = pedidosDesdeFilas(filas, minEmp, almacen.datos.catalogo);
    const idsNuevos = new Set(peds.map((p) => p.id));
    almacen.datos.pedidos = [...peds, ...almacen.datos.pedidos.filter((p) => !idsNuevos.has(p.id))];
    almacen.datos.fuentesFilas[fuente.id] = peds;
    almacen.guardar('pedidos');
  } else if (fuente.tipo === 'clientes') {
    const clis = clientesDesdeFilas(filas, minEmp);
    almacen.datos.clientes = clis;
    almacen.datos.fuentesFilas[fuente.id] = clis;
    almacen.guardar('clientes');
  }
}

export function obtenerDatosFuente(almacen, id) {
  const fuente = almacen.datos.fuentes.find((x) => x.id === id);
  if (!fuente) return null;
  const guardadas = almacen.datos.fuentesFilas?.[id];
  const respaldo = {
    ventas: almacen.datos.ventas,
    catalogo: almacen.datos.catalogo,
    pedidos: almacen.datos.pedidos,
    clientes: almacen.datos.clientes,
  }[fuente.tipo] || [];
  const filas = guardadas || respaldo;
  return { id: fuente.id, nombre: fuente.nombre, tipo: fuente.tipo, estado: fuente.estado, filas };
}

export function fuenteDesdeArchivo(almacen, { nombreArchivo, filas, tipo }) {
  if (!TIPOS[tipo]) return { status: 400, error: `tipo debe ser ${Object.keys(TIPOS).join(', ')}` };
  if (!filas.length) return { status: 400, error: 'El archivo está vacío o no tiene filas.' };
  const faltan = TIPOS[tipo].requeridas.filter((c) => !(c in filas[0]));
  if (faltan.length) return { status: 400, error: `Al archivo le faltan columnas: ${faltan.join(', ')}.` };
  const fuente = {
    id: `F-${Date.now().toString(36)}`,
    tipo,
    nombre: `${nombreArchivo || TIPOS[tipo].nombre}`,
    url: `archivo://${nombreArchivo || tipo}`,
    recurso_id: `archivo:${nombreArchivo || tipo}`,
    estado: 'ok',
    ultima_sync: new Date().toISOString(),
    filas: filas.length,
    error: null,
  };
  aplicarFilasAFuente(almacen, fuente, filas);
  almacen.datos.fuentes.unshift(fuente);
  almacen.guardar('fuentes');
  agregarNotificacion(almacen, { tipo: 'sync', titulo: `Hoja ${TIPOS[tipo].nombre} sincronizada`, texto: `${filas.length} filas leídas`, enlace: `/app/datos?ver=${fuente.id}` });
  return { status: 201, fuente };
}

export function nuevaFuente(almacen, { url, tipo }) {
  if (!TIPOS[tipo]) return { status: 400, error: `tipo debe ser ${Object.keys(TIPOS).join(', ')}` };
  const recurso = recursoDeUrl(url);
  if (!recurso) return { status: 400, error: 'Pega el enlace de una hoja de Google Sheets o de una carpeta de Drive.' };
  const lista = almacen.datos.fuentes;
  const fuente = {
    id: `F-${Date.now().toString(36)}`, tipo, nombre: `${TIPOS[tipo].nombre} (conectando…)`, url: String(url).trim(),
    recurso_id: `${recurso.clase}:${recurso.id}`, estado: 'sincronizando', ultima_sync: null, filas: null, error: null,
  };
  lista.push(fuente);
  almacen.guardar('fuentes');
  return { status: 201, fuente };
}

const mensajeAcceso = (google) => `No tengo acceso. Comparte la hoja (o la carpeta) con ${google.correo} como lector y vuelve a sincronizar.`;

/** Lee la fuente y aplica sus datos. Nunca lanza: deja el error en la fuente. */
export async function sincronizar(almacen, google, fuente) {
  fuente.estado = 'sincronizando';
  fuente.error = null;
  try {
    if (!google) throw new Error('El backend no tiene configurada la cuenta de servicio (GOOGLE_SERVICE_ACCOUNT_JSON).');
    const [clase, id] = String(fuente.recurso_id).split(':');
    let hojaId = id;
    let nombre = '';
    if (clase === 'carpeta') {
      const hojas = await google.hojasDeCarpeta(id);
      const elegida = hojas.find((h) => claveColumna(h.name).includes(claveColumna(TIPOS[fuente.tipo].nombre))) || hojas[0];
      if (!elegida) throw new Error(`La carpeta no tiene hojas de cálculo que yo pueda ver. Compártela con ${google.correo} y revisa que tenga una hoja de ${TIPOS[fuente.tipo].nombre.toLowerCase()}.`);
      hojaId = elegida.id;
      nombre = elegida.name;
    }
    const info = await google.info(hojaId);
    const pestana = info.pestanas.find((p) => claveColumna(p).includes(claveColumna(TIPOS[fuente.tipo].nombre))) || info.pestanas[0];
    const filas = aObjetos(await google.leerValores(hojaId, pestana));
    const faltan = TIPOS[fuente.tipo].requeridas.filter((c) => !filas.length || !(c in filas[0]));
    if (!filas.length) throw new Error(`La pestaña "${pestana}" está vacía.`);
    if (faltan.length) throw new Error(`A la pestaña "${pestana}" le faltan columnas: ${faltan.join(', ')}.`);

    aplicarFilasAFuente(almacen, fuente, filas);
    Object.assign(fuente, { estado: 'ok', nombre: `${nombre || info.titulo} · ${pestana}`, filas: filas.length, ultima_sync: new Date().toISOString(), error: null });
    agregarNotificacion(almacen, { tipo: 'sync', titulo: `Hoja ${TIPOS[fuente.tipo].nombre} sincronizada`, texto: `${filas.length} filas leídas`, enlace: '/app/datos' });
  } catch (e) {
    const sinAcceso = e.status === 403 || e.status === 404;
    Object.assign(fuente, { estado: 'error', error: sinAcceso && google ? mensajeAcceso(google) : e.message });
    if (fuente.nombre.endsWith('(conectando…)')) fuente.nombre = TIPOS[fuente.tipo].nombre;
  }
  almacen.guardar('fuentes');
  return fuente;
}

