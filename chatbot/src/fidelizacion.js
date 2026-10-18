'use strict';

// Fidelización (postventa): segmentos de clientes, reglas de publicidad por segmento, recomendaciones y audiencias.
// Trabaja sobre BOT_CLIENTES_FUENTE, BOT_VENTAS y BOT_PRODUCTOS (copias de la hoja del negocio) y BOT_FIDELIZACION.
// Reglas fijas, sin IA. Sin dependencias: nodos Code de n8n y simulador.

const ZONA_FIDELIZACION = 'America/Lima';
const DIAS_DORMIDO = 90;
const DIAS_NUEVO = 30;
const PEDIDOS_VIP = 3;
const PORCENTAJE_VIP = 0.10;
const SEGMENTOS_FIDELIZACION = ['CORPORATIVO', 'VIP', 'RECURRENTE', 'NUEVO', 'DORMIDO'];
// Fuera de las reglas del plan: un pedido de hace 30 a 90 días, o ninguna compra.
const SEGMENTOS_OTROS = ['OCASIONAL', 'SIN_COMPRAS'];
const COLUMNAS_FIDELIZACION = ['segmento', 'canal', 'mensaje', 'oferta', 'frecuencia_dias', 'activo'];

// Valores con los que nace BOT_FIDELIZACION. Placeholders: {nombre}, {producto}, {oferta}, {negocio}, {url}.
const REGLAS_POR_DEFECTO = [
  {
    segmento: 'CORPORATIVO', canal: 'EMAIL + ASESOR POR WHATSAPP', frecuencia_dias: '30', activo: 'SI',
    oferta: 'Descuento por volumen desde 50 unidades y logo grabado sin costo',
    mensaje: 'Hola {nombre}, te compartimos el catálogo corporativo de {negocio}. Para tus próximos regalos te recomendamos {producto}. {oferta}. ¿Agendamos una llamada con un asesor?',
  },
  {
    segmento: 'VIP', canal: 'WHATSAPP PERSONAL (HUMANO)', frecuencia_dias: '45', activo: 'SI',
    oferta: 'Acceso anticipado a la nueva colección y un regalo en tu próximo pedido',
    mensaje: 'Hola {nombre}, eres de nuestros clientes favoritos de {negocio} 🌳 {oferta}. Te separamos {producto} antes que nadie.',
  },
  {
    segmento: 'RECURRENTE', canal: 'PLANTILLA DE WHATSAPP', frecuencia_dias: '30', activo: 'SI',
    oferta: '10% de descuento en tu siguiente compra',
    mensaje: 'Hola {nombre}, a quienes compraron lo mismo que tú también les encantó {producto}. {oferta} 👉 {url}',
  },
  {
    segmento: 'NUEVO', canal: 'EMAIL Y WHATSAPP', frecuencia_dias: '20', activo: 'SI',
    oferta: 'Cupón SEGUNDA10 para tu segunda compra',
    mensaje: '¡Gracias por tu compra, {nombre}! ¿Nos dejas una reseña? Como agradecimiento: {oferta}. Te podría gustar {producto}.',
  },
  {
    segmento: 'DORMIDO', canal: 'WHATSAPP CON CUPÓN + RETARGETING EN META ADS', frecuencia_dias: '60', activo: 'SI',
    oferta: 'Cupón VUELVE15 por 15 días',
    mensaje: 'Hola {nombre}, te extrañamos en {negocio}. Vuelve con {oferta}: {producto} te está esperando 👉 {url}',
  },
];

function fidTexto(v) { return v === undefined || v === null ? '' : String(v).trim(); }
function fidNumero(v) { const s = fidTexto(v).replace(',', '.'); const n = Number(s); return s !== '' && Number.isFinite(n) ? n : null; }
function fidDia(v) {
  const s = fidTexto(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return '';
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_FIDELIZACION, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(t));
  const p = tipo => partes.find(x => x.type === tipo).value;
  return `${p('year')}-${p('month')}-${p('day')}`;
}
function diasEntre(a, b) { return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5); }
function fidSumarDias(ymd, dias) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}
function fidRender(plantilla, valores) { return fidTexto(plantilla).replace(/\{(\w+)\}/g, (_, k) => fidTexto(valores[k])); }
function fidTelefono(v) {
  const d = fidTexto(v).replace(/\D/g, '');
  if (/^9\d{8}$/.test(d)) return `51${d}`;
  return d.length >= 10 ? d : '';
}
function primerNombre(v) { return fidTexto(v).split(/\s+/)[0] || ''; }

// ---------- segmentos ----------

// Pedidos por cliente (las ventas vienen por línea: un pedido_id puede tener varias filas).
function pedidosPorCliente(ventas) {
  const porCliente = {};
  for (const v of ventas || []) {
    const cliente = fidTexto(v.cliente_id);
    const pedido = fidTexto(v.pedido_id);
    const fecha = fidDia(v.fecha);
    if (!cliente || !pedido || !fecha) continue;
    const pedidos = (porCliente[cliente] = porCliente[cliente] || {});
    const p = (pedidos[pedido] = pedidos[pedido] || { pedido_id: pedido, fecha, total: 0, skus: [] });
    if (fecha < p.fecha) p.fecha = fecha;
    p.total += fidNumero(v.total) || 0;
    if (fidTexto(v.sku)) p.skus.push(fidTexto(v.sku));
  }
  return porCliente;
}

// Clientes con su historial y su segmento. Orden de las reglas: CORPORATIVO, DORMIDO, VIP, RECURRENTE, NUEVO.
function segmentar({ clientes, ventas, ahora }) {
  const hoy = fidDia(ahora || new Date().toISOString());
  const pedidos = pedidosPorCliente(ventas);
  const base = (clientes || []).filter(c => c && fidTexto(c.cliente_id)).map(c => {
    const lista = Object.values(pedidos[fidTexto(c.cliente_id)] || {}).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const total = lista.reduce((s, p) => s + p.total, 0);
    const ultima = lista.length ? lista[lista.length - 1].fecha : '';
    return {
      cliente_id: fidTexto(c.cliente_id), nombre: fidTexto(c.nombre), telefono: fidTelefono(c.telefono), email: fidTexto(c.email).toLowerCase(),
      tipo: fidTexto(c.tipo).toUpperCase() === 'EMPRESA' ? 'EMPRESA' : 'PERSONA',
      acepta_marketing: fidTexto(c.acepta_marketing).toUpperCase() === 'SI' ? 'SI' : 'NO',
      pedidos: lista.length, total_comprado: Math.round(total * 100) / 100, ultima_compra: ultima,
      dias_sin_comprar: ultima ? diasEntre(ultima, hoy) : null,
      fechas_pedidos: lista.map(p => p.fecha), skus_comprados: [...new Set(lista.flatMap(p => p.skus))],
    };
  });
  // Top 10 % en total comprado, entre los que compraron (al menos uno).
  const compradores = base.filter(c => c.pedidos > 0).sort((a, b) => b.total_comprado - a.total_comprado);
  const corte = compradores.length ? compradores[Math.max(0, Math.ceil(compradores.length * PORCENTAJE_VIP) - 1)].total_comprado : Infinity;
  for (const c of base) {
    if (c.tipo === 'EMPRESA') c.segmento = 'CORPORATIVO';
    else if (!c.pedidos) c.segmento = 'SIN_COMPRAS';
    else if (c.dias_sin_comprar > DIAS_DORMIDO) c.segmento = 'DORMIDO';
    else if (c.pedidos >= PEDIDOS_VIP || c.total_comprado >= corte) c.segmento = 'VIP';
    else if (c.pedidos === 2) c.segmento = 'RECURRENTE';
    else if (c.dias_sin_comprar < DIAS_NUEVO) c.segmento = 'NUEVO';
    else c.segmento = 'OCASIONAL';
  }
  return base;
}

function conteoSegmentos(segmentados) {
  const conteo = Object.fromEntries([...SEGMENTOS_FIDELIZACION, ...SEGMENTOS_OTROS].map(s => [s, 0]));
  for (const c of segmentados || []) conteo[c.segmento] = (conteo[c.segmento] || 0) + 1;
  return conteo;
}

// Columnas que la sincronización agrega a BOT_CLIENTES_FUENTE.
const COLUMNAS_SEGMENTO = ['segmento', 'pedidos', 'total_comprado', 'ultima_compra'];

// ---------- reglas por segmento (BOT_FIDELIZACION) ----------

function leerReglas(filas) {
  const reglas = Object.fromEntries(REGLAS_POR_DEFECTO.map(r => [r.segmento, { ...r }]));
  for (const f of filas || []) {
    const seg = fidTexto(f && f.segmento).toUpperCase();
    if (!reglas[seg]) continue;
    for (const c of COLUMNAS_FIDELIZACION) if (c !== 'segmento' && fidTexto(f[c]) !== '') reglas[seg][c] = fidTexto(f[c]);
  }
  for (const r of Object.values(reglas)) {
    r.frecuencia_dias = String(Math.max(1, Math.floor(fidNumero(r.frecuencia_dias) || 30)));
    r.activo = fidTexto(r.activo).toUpperCase() === 'NO' ? 'NO' : 'SI';
  }
  return reglas;
}

// PUT /fidelizacion: { reglas: [{ segmento, canal?, mensaje?, oferta?, frecuencia_dias?, activo? }] } -> filas.
function validarReglas(cuerpo) {
  const lista = Array.isArray(cuerpo) ? cuerpo : cuerpo && Array.isArray(cuerpo.reglas) ? cuerpo.reglas : null;
  if (!lista || !lista.length) return { ok: false, error: 'Envía { "reglas": [ { "segmento": "VIP", ... } ] }.' };
  const filas = [];
  for (const r of lista) {
    const seg = fidTexto(r && r.segmento).toUpperCase();
    if (!SEGMENTOS_FIDELIZACION.includes(seg)) return { ok: false, error: `segmento debe ser ${SEGMENTOS_FIDELIZACION.join(', ')}.` };
    const fila = { segmento: seg };
    for (const c of COLUMNAS_FIDELIZACION.slice(1)) {
      if (r[c] === undefined) continue;
      const v = fidTexto(r[c]);
      if (v.length > 1000) return { ok: false, error: `${c} admite hasta 1000 caracteres.` };
      if (c === 'frecuencia_dias' && !(fidNumero(v) >= 1)) return { ok: false, error: 'frecuencia_dias debe ser un número de días (1 o más).' };
      if (c === 'activo' && !['SI', 'NO'].includes(v.toUpperCase())) return { ok: false, error: 'activo debe ser SI o NO.' };
      fila[c] = c === 'activo' ? v.toUpperCase() : v;
    }
    filas.push(fila);
  }
  return { ok: true, filas };
}

// ---------- recomendaciones ----------

function leerProductosFuente(filas) {
  return (filas || []).filter(p => p && fidTexto(p.sku)).map(p => ({
    sku: fidTexto(p.sku), nombre: fidTexto(p.nombre), categoria: fidTexto(p.categoria),
    precio: fidNumero(p.precio), costo: fidNumero(p.costo), stock: fidNumero(p.stock),
    activo: fidTexto(p.activo).toUpperCase() !== 'NO',
  }));
}

// Pares de productos comprados en el mismo pedido y unidades vendidas por producto.
function estadisticasVentas(ventas) {
  const pedidos = {};
  const vendidos = {};
  for (const v of ventas || []) {
    const sku = fidTexto(v.sku);
    const pedido = fidTexto(v.pedido_id);
    if (!sku || !pedido) continue;
    (pedidos[pedido] = pedidos[pedido] || new Set()).add(sku);
    vendidos[sku] = (vendidos[sku] || 0) + (fidNumero(v.cantidad) || 1);
  }
  const pares = {};
  for (const skus of Object.values(pedidos)) {
    for (const a of skus) for (const b of skus) if (a !== b) pares[`${a}|${b}`] = (pares[`${a}|${b}`] || 0) + 1;
  }
  return { pares, vendidos };
}

// cliente: un elemento de segmentar(). Devuelve hasta `limite` productos con el motivo de cada uno.
function recomendarPara(cliente, { productos, ventas, reglas, config, ahora, limite }) {
  const hoy = fidDia(ahora || new Date().toISOString());
  const catalogo = leerProductosFuente(productos).filter(p => p.activo && p.precio !== null);
  const disponible = p => p.stock === null || p.stock > 0;
  const porSku = Object.fromEntries(catalogo.map(p => [p.sku, p]));
  const compradas = new Set(cliente.skus_comprados || []);
  const { pares, vendidos } = estadisticasVentas(ventas);
  const noCompradas = catalogo.filter(p => !compradas.has(p.sku) && disponible(p));
  const margen = fidNumero(config && config.margen_por_defecto) || 0.4;
  const ganancia = p => (p.costo !== null ? p.precio - p.costo : p.precio * margen);

  let candidatos = [];
  if (cliente.segmento === 'DORMIDO') {
    // Reactivación: lo más barato con stock.
    candidatos = [...noCompradas].sort((a, b) => a.precio - b.precio).map(p => ({ p, motivo: 'MAS_ECONOMICO_CON_STOCK' }));
  } else {
    // 1. Comprados juntos con lo que ya compró.
    const puntos = {};
    for (const [par, n] of Object.entries(pares)) {
      const [a, b] = par.split('|');
      if (compradas.has(a) && !compradas.has(b) && porSku[b] && disponible(porSku[b])) puntos[b] = (puntos[b] || 0) + n;
    }
    candidatos = Object.entries(puntos).sort((x, y) => y[1] - x[1]).map(([sku]) => ({ p: porSku[sku], motivo: 'COMPRADO_JUNTO' }));
    // 2. Lo más vendido de sus categorías que aún no compró; sin historial, lo más vendido en general.
    const categorias = new Set([...compradas].map(s => porSku[s] && porSku[s].categoria).filter(Boolean));
    const masVendidos = [...noCompradas].sort((a, b) => (vendidos[b.sku] || 0) - (vendidos[a.sku] || 0));
    const vistos = new Set(candidatos.map(c => c.p.sku));
    for (const p of masVendidos.filter(x => categorias.has(x.categoria))) if (!vistos.has(p.sku)) { candidatos.push({ p, motivo: 'MAS_VENDIDO_DE_SU_CATEGORIA' }); vistos.add(p.sku); }
    for (const p of masVendidos) if (!vistos.has(p.sku)) { candidatos.push({ p, motivo: 'MAS_VENDIDO' }); vistos.add(p.sku); }
    // 4. VIP y corporativos: primero lo de mayor ganancia y ticket (orden estable dentro de cada motivo).
    if (cliente.segmento === 'VIP' || cliente.segmento === 'CORPORATIVO') {
      candidatos.sort((a, b) => ganancia(b.p) - ganancia(a.p) || b.p.precio - a.p.precio);
    }
  }
  const elegidos = candidatos.slice(0, limite || 3).map(({ p, motivo }) => ({ sku: p.sku, nombre: p.nombre, categoria: p.categoria, precio: p.precio, motivo }));

  // 3. Momento de recompra: promedio de días entre sus pedidos; sin historial, la frecuencia del segmento.
  const regla = (reglas || {})[cliente.segmento] || null;
  const fechas = cliente.fechas_pedidos || [];
  let dias = null;
  let base = 'FRECUENCIA_DEL_SEGMENTO';
  if (fechas.length >= 2) {
    const saltos = fechas.slice(1).map((f, i) => diasEntre(fechas[i], f)).filter(d => d > 0);
    if (saltos.length) { dias = Math.round(saltos.reduce((a, b) => a + b, 0) / saltos.length); base = 'PROMEDIO_ENTRE_COMPRAS'; }
  }
  if (dias === null) dias = regla ? Number(regla.frecuencia_dias) : 30;
  const desde = cliente.ultima_compra || hoy;
  const proxima = fidSumarDias(desde, dias);
  const mensaje = regla && elegidos.length ? fidRender(regla.mensaje, {
    nombre: primerNombre(cliente.nombre), producto: elegidos[0].nombre, oferta: regla.oferta,
    negocio: fidTexto(config && config.nombre_negocio) || 'ITS WOOD', url: fidTexto(config && config.url_web),
  }).replace(/\s*👉\s*$/, '') : '';
  return {
    cliente_id: cliente.cliente_id, nombre: cliente.nombre, segmento: cliente.segmento,
    productos: elegidos,
    recompra: { dias, base, proxima_compra: proxima, dias_para_recompra: diasEntre(hoy, proxima) },
    canal: regla ? regla.canal : '', oferta: regla ? regla.oferta : '', mensaje,
  };
}

// ---------- campañas (flujo [9]) ----------
// A quién le toca según frecuencia_dias del segmento. En la demo se envía por email: fuera de la ventana de 24 h,
// WhatsApp exige una plantilla aprobada por Meta.

const COLUMNAS_CAMPANA = ['campana_id', 'fecha', 'segmento', 'cliente_id', 'nombre', 'canal', 'destino', 'asunto', 'mensaje', 'estado', 'detalle'];

// Último envío por cliente y segmento (BOT_CAMPANAS con estado ENVIADO).
function ultimosEnvios(campanas, segmento) {
  const ultimo = {};
  for (const c of campanas || []) {
    if (fidTexto(c.segmento).toUpperCase() !== segmento || fidTexto(c.estado).toUpperCase() !== 'ENVIADO') continue;
    const id = fidTexto(c.cliente_id);
    const dia = fidDia(c.fecha);
    if (id && dia && (!ultimo[id] || dia > ultimo[id])) ultimo[id] = dia;
  }
  return ultimo;
}

function aQuienLeToca({ segmento, clientes, ventas, productos, fidelizacion, campanas, config, ahora }) {
  const seg = fidTexto(segmento).toUpperCase();
  if (!SEGMENTOS_FIDELIZACION.includes(seg)) return { ok: false, status: 400, error: `segmento debe ser ${SEGMENTOS_FIDELIZACION.join(', ')}.` };
  const ahoraIso = ahora || new Date().toISOString();
  const hoy = fidDia(ahoraIso);
  const reglas = leerReglas(fidelizacion);
  const regla = reglas[seg];
  const omitidos = { sin_permiso: 0, contactado_recientemente: 0, sin_email: 0 };
  const base = { ok: true, status: 200, segmento: seg, regla, fecha: hoy, omitidos };
  if (regla.activo !== 'SI') return { ...base, destinatarios: [], aviso: `La regla de ${seg} está inactiva en BOT_FIDELIZACION.` };
  const ultimo = ultimosEnvios(campanas, seg);
  const frecuencia = Number(regla.frecuencia_dias);
  const negocio = fidTexto(config && config.nombre_negocio) || 'ITS WOOD';
  const destinatarios = [];
  for (const c of segmentar({ clientes, ventas, ahora: ahoraIso }).filter(x => x.segmento === seg)) {
    if (c.acepta_marketing !== 'SI') { omitidos.sin_permiso += 1; continue; }
    if (ultimo[c.cliente_id] && diasEntre(ultimo[c.cliente_id], hoy) < frecuencia) { omitidos.contactado_recientemente += 1; continue; }
    if (!c.email) { omitidos.sin_email += 1; continue; }
    const reco = recomendarPara(c, { productos, ventas, reglas, config, ahora: ahoraIso });
    destinatarios.push({
      campana_id: `CAMP-${seg}-${hoy.replace(/-/g, '')}-${c.cliente_id}`,
      cliente_id: c.cliente_id, nombre: c.nombre, email: c.email, telefono: c.telefono,
      producto: reco.productos[0] ? reco.productos[0].nombre : '',
      asunto: `${negocio}: ${regla.oferta}`.slice(0, 150),
      mensaje: reco.mensaje || fidRender(regla.mensaje, { nombre: primerNombre(c.nombre), producto: 'nuestra nueva colección', oferta: regla.oferta, negocio, url: fidTexto(config && config.url_web) }),
    });
  }
  return { ...base, destinatarios };
}

// Filas de BOT_CAMPANAS. estado: PREVISTA (vista previa diaria), ENVIADO o ERROR_ENVIO (con resultados por id).
function filasCampana(resultado, { ahora, estado, errores }) {
  const fallidos = errores || {};
  return (resultado.destinatarios || []).map(d => ({
    campana_id: d.campana_id, fecha: ahora || new Date().toISOString(), segmento: resultado.segmento,
    cliente_id: d.cliente_id, nombre: d.nombre, canal: 'EMAIL', destino: d.email, asunto: d.asunto, mensaje: d.mensaje,
    estado: fallidos[d.campana_id] ? 'ERROR_ENVIO' : estado, detalle: fallidos[d.campana_id] ? String(fallidos[d.campana_id]).slice(0, 500) : '',
  }));
}

// ---------- audiencias para Ads ----------

function campoCsv(v) { const s = fidTexto(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }

// CSV telefono,email del segmento, solo con acepta_marketing = SI (Custom Audience de Meta o Google Ads).
function audiencia(segmentados, segmento) {
  const seg = fidTexto(segmento).toUpperCase();
  const filas = (segmentados || []).filter(c => c.segmento === seg && c.acepta_marketing === 'SI' && (c.telefono || c.email));
  const lineas = ['telefono,email', ...filas.map(c => [c.telefono ? `+${c.telefono}` : '', c.email].map(campoCsv).join(','))];
  return { segmento: seg, total: filas.length, csv: `${lineas.join('\n')}\n` };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    segmentar, conteoSegmentos, leerReglas, validarReglas, recomendarPara, audiencia, leerProductosFuente,
    aQuienLeToca, filasCampana,
    SEGMENTOS_FIDELIZACION, SEGMENTOS_OTROS, REGLAS_POR_DEFECTO, COLUMNAS_FIDELIZACION, COLUMNAS_SEGMENTO, COLUMNAS_CAMPANA,
  };
}
