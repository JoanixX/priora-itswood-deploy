import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Copy, Check, RefreshCw, Link2, AlertCircle, CheckCircle2, Loader2,
  FileSpreadsheet, Eye, EyeOff, Upload, Search, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { usePolling } from '../hooks/usePolling.js';
import {
  listarFuentes, conectarFuente, sincronizarFuente, obtenerDatosFuente,
  subirArchivoFuente, TIPOS_FUENTE, esUrlGoogle,
} from '../services/fuentes.js';
import { formatoFecha, formatoSoles } from '../lib/format.js';
import EmptyState from '../components/EmptyState.jsx';
import s from './Datos.module.css';

const ESTADOS = {
  ok: { texto: 'Sincronizada', icono: CheckCircle2, clase: 'ok' },
  sincronizando: { texto: 'Sincronizando…', icono: Loader2, clase: 'cargando' },
  error: { texto: 'Error', icono: AlertCircle, clase: 'error' },
};

const FILAS_POR_PAGINA = 20;

function hace(iso) {
  if (!iso) return 'Nunca';
  const min = Math.round((Date.now() - new Date(iso)) / 60000);
  if (min < 1) return 'Hace un momento';
  if (min < 60) return `Hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `Hace ${h} h` : new Date(iso).toLocaleDateString('es-PE');
}

function TablaHoja({ tipo, filas }) {
  if (!filas || filas.length === 0) {
    return <p className="muted">Esta hoja no tiene filas para mostrar.</p>;
  }

  if (tipo === 'ventas') {
    return (
      <div className={s.tablaCaja}>
        <table className={s.tabla}>
          <thead>
            <tr>
              <th scope="col">Fecha pedido</th>
              <th scope="col">Cliente</th>
              <th scope="col">Tipo</th>
              <th scope="col">Canal</th>
              <th scope="col">Distrito</th>
              <th scope="col">Producto</th>
              <th scope="col" className={s.num}>Cant.</th>
              <th scope="col" className={s.num}>Monto</th>
              <th scope="col">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={f.id || i}>
                <td>{formatoFecha(f.fecha_pedido)}</td>
                <td><strong>{f.cliente || '—'}</strong></td>
                <td>{f.tipo === 'empresa' ? 'Empresa' : 'Persona'}</td>
                <td>{f.plataforma || '—'}</td>
                <td>{f.distrito || '—'}</td>
                <td>{f.producto || '—'}</td>
                <td className={s.num}>{f.cantidad ?? '—'}</td>
                <td className={s.num}>{formatoSoles(f.monto)}</td>
                <td>{f.estado || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (tipo === 'pedidos') {
    return (
      <div className={s.tablaCaja}>
        <table className={s.tabla}>
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">Fecha</th>
              <th scope="col">Cliente</th>
              <th scope="col">Tipo</th>
              <th scope="col">Producto</th>
              <th scope="col" className={s.num}>Cant.</th>
              <th scope="col" className={s.num}>Monto</th>
              <th scope="col">Fecha requerida</th>
              <th scope="col">Personalización</th>
              <th scope="col">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => {
              const cliente = typeof f.cliente === 'object'
                ? (f.cliente?.empresa || f.cliente?.nombre || 'Cliente')
                : (f.cliente || 'Cliente');
              const tipoCli = (typeof f.cliente === 'object' ? f.cliente?.tipo : f.tipo) === 'empresa' ? 'Empresa' : 'Persona';
              const producto = f.producto || (Array.isArray(f.productos) ? f.productos.map((p) => p.nombre).join(', ') : '—');
              const cantidad = f.cantidad ?? f.cantidad_total ?? (Array.isArray(f.productos) ? f.productos.reduce((a, p) => a + (p.cantidad || 0), 0) : '—');
              const monto = f.monto ?? (Array.isArray(f.productos) ? f.productos.reduce((a, p) => a + (p.cantidad || 0) * (p.precio_unitario || 0), 0) : null);
              return (
                <tr key={f.id || i}>
                  <td><code>{f.id || `PED-${i + 1}`}</code></td>
                  <td>{formatoFecha(f.fecha_pedido || (f.creado_en || '').slice(0, 10))}</td>
                  <td><strong>{cliente}</strong></td>
                  <td>{tipoCli}</td>
                  <td>{producto}</td>
                  <td className={s.num}>{cantidad}</td>
                  <td className={s.num}>{formatoSoles(monto)}</td>
                  <td>{formatoFecha(f.fecha_entrega || f.fecha_requerida)}</td>
                  <td>{f.personalizacion || 'No'}</td>
                  <td>{f.estado || 'Nuevo'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  if (tipo === 'clientes') {
    const tieneContacto = filas.some((f) => f.telefono || f.correo || f.distrito);
    return (
      <div className={s.tablaCaja}>
        <table className={s.tabla}>
          <thead>
            <tr>
              <th scope="col">Cliente</th>
              <th scope="col">Tipo</th>
              {tieneContacto ? (
                <>
                  <th scope="col">Teléfono</th>
                  <th scope="col">Correo</th>
                  <th scope="col">Distrito</th>
                </>
              ) : (
                <>
                  <th scope="col" className={s.num}>Pedidos</th>
                  <th scope="col" className={s.num}>Monto acumulado</th>
                  <th scope="col">Última compra</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={f.id || f.alias || f.cliente || i}>
                <td><strong>{f.cliente || f.alias || '—'}</strong></td>
                <td>{f.empresa || f.tipo === 'empresa' ? 'Empresa' : 'Persona'}</td>
                {tieneContacto ? (
                  <>
                    <td>{f.telefono || '—'}</td>
                    <td>{f.correo || '—'}</td>
                    <td>{f.distrito || '—'}</td>
                  </>
                ) : (
                  <>
                    <td className={s.num}>{f.pedidos ?? 1}</td>
                    <td className={s.num}>{formatoSoles(f.monto)}</td>
                    <td>{formatoFecha(f.ultima)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (tipo === 'catalogo') {
    return (
      <div className={s.tablaCaja}>
        <table className={s.tabla}>
          <thead>
            <tr>
              <th scope="col">Producto</th>
              <th scope="col">Categoría</th>
              <th scope="col" className={s.num}>Precio</th>
              <th scope="col" className={s.num}>Stock</th>
              <th scope="col">Descripción</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={f.id || i}>
                <td><strong>{f.nombre || f.producto || '—'}</strong></td>
                <td>{f.categoria || '—'}</td>
                <td className={s.num}>{formatoSoles(f.precio)}</td>
                <td className={s.num}>{f.stock ?? 'Sin registro'}</td>
                <td className="muted">{f.descripcion || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const columnas = Object.keys(filas[0] || {});
  return (
    <div className={s.tablaCaja}>
      <table className={s.tabla}>
        <thead>
          <tr>{columnas.map((c) => <th key={c} scope="col">{c}</th>)}</tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={f.id || i}>
              {columnas.map((c) => <td key={c}>{String(f[c] ?? '—')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Datos() {
  const { toast, refrescarNotificaciones, refrescarPedidos, refrescarCatalogo, refrescarVentas } = useApp();
  const [datos, setDatos] = useState(null);
  const [url, setUrl] = useState('');
  const [tipo, setTipo] = useState('ventas');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const [fuenteActivaId, setFuenteActivaId] = useState(null);
  const [detalleFuente, setDetalleFuente] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);

  const inputArchivo = useRef(null);
  const seleccionInicial = useRef(false);
  const estadosPrevios = useRef(new Map());

  const verDatos = useCallback(async (id) => {
    setFuenteActivaId(id);
    setCargandoDetalle(true);
    setBusqueda('');
    setPagina(1);
    try {
      const d = await obtenerDatosFuente(id);
      setDetalleFuente(d);
    } catch (ex) {
      toast({ titulo: 'No se pudieron cargar los datos', texto: ex.message, tono: 'coral' });
    } finally {
      setCargandoDetalle(false);
    }
  }, [toast]);

  const cargar = useCallback(async () => {
    try {
      const res = await listarFuentes();
      setDatos(res);
      const lista = res?.fuentes || [];

      // Si alguna fuente pasó de 'sincronizando' a 'ok', refrescamos las vistas y su tabla.
      let huboNuevaSync = false;
      let recienSincronizadaId = null;
      for (const f of lista) {
        const prev = estadosPrevios.current.get(f.id);
        if (prev === 'sincronizando' && f.estado === 'ok') {
          huboNuevaSync = true;
          recienSincronizadaId = f.id;
        }
        estadosPrevios.current.set(f.id, f.estado);
      }

      if (huboNuevaSync) {
        await Promise.all([refrescarVentas(), refrescarPedidos(), refrescarCatalogo(), refrescarNotificaciones()]);
        if (recienSincronizadaId) verDatos(recienSincronizadaId);
      } else if (!seleccionInicial.current) {
        const primeraOk = lista.find((f) => f.estado === 'ok');
        if (primeraOk) {
          seleccionInicial.current = true;
          verDatos(primeraOk.id);
        }
      }
    } catch {
      setDatos({ fuentes: [] });
    }
  }, [refrescarCatalogo, refrescarNotificaciones, refrescarPedidos, refrescarVentas, verDatos]);

  usePolling(cargar, 3000);

  const conectar = async (e) => {
    e.preventDefault();
    setError('');
    if (!esUrlGoogle(url)) {
      setError('Pega el enlace de una hoja de Google Sheets (docs.google.com/spreadsheets/…) o de una carpeta de Drive.');
      return;
    }
    setEnviando(true);
    try {
      const nueva = await conectarFuente({ url, tipo });
      setUrl('');
      toast({ titulo: 'Hoja conectada', texto: 'Estamos leyendo tus datos. Te avisamos al terminar.' });
      await cargar();
      if (nueva?.estado === 'ok') {
        await Promise.all([refrescarVentas(), refrescarPedidos(), refrescarCatalogo(), refrescarNotificaciones()]);
        await verDatos(nueva.id);
      }
    } catch (ex) {
      setError(ex.message);
    } finally {
      setEnviando(false);
    }
  };

  const subirArchivo = async (archivo) => {
    if (!archivo) return;
    setError('');
    if (!/\.(xlsx|csv)$/i.test(archivo.name)) {
      setError('El archivo debe ser .xlsx o .csv.');
      return;
    }
    setSubiendo(true);
    try {
      const nueva = await subirArchivoFuente(archivo, tipo);
      toast({ titulo: 'Hoja cargada', texto: `${nueva.filas} filas leídas de ${archivo.name}.` });
      await Promise.all([cargar(), refrescarVentas(), refrescarPedidos(), refrescarCatalogo(), refrescarNotificaciones()]);
      if (nueva?.id) await verDatos(nueva.id);
    } catch (ex) {
      setError(ex.message);
    } finally {
      setSubiendo(false);
    }
  };

  const sincronizar = async (id) => {
    try {
      const f = await sincronizarFuente(id);
      await cargar();
      if (f?.estado === 'ok') {
        await Promise.all([refrescarVentas(), refrescarPedidos(), refrescarCatalogo(), refrescarNotificaciones()]);
        if (fuenteActivaId === id) await verDatos(id);
      } else {
        setTimeout(async () => {
          await Promise.all([cargar(), refrescarVentas(), refrescarPedidos(), refrescarCatalogo(), refrescarNotificaciones()]);
          if (fuenteActivaId === id) await verDatos(id);
        }, 2800);
      }
    } catch (ex) {
      toast({ titulo: 'No se pudo sincronizar', texto: ex.message, tono: 'coral' });
    }
  };

  const copiarCorreo = async () => {
    try {
      await navigator.clipboard.writeText(datos.correo_servicio);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { /* el usuario puede copiarlo a mano */ }
  };

  const filasFiltradas = useMemo(() => {
    const lista = detalleFuente?.filas || [];
    const q = busqueda.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter((f) => JSON.stringify(f).toLowerCase().includes(q));
  }, [detalleFuente, busqueda]);

  const totalPaginas = Math.max(1, Math.ceil(filasFiltradas.length / FILAS_POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const filasPagina = useMemo(() => {
    const inicio = (paginaActual - 1) * FILAS_POR_PAGINA;
    return filasFiltradas.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [filasFiltradas, paginaActual]);

  useEffect(() => {
    setPagina(1);
  }, [busqueda]);

  return (
    <div className="pagina">
      <div className="cabecera">
        <div>
          <h1>Datos</h1>
          <p className="muted">Conecta tus hojas de Google para que Priora lea tu negocio y se actualice sola.</p>
        </div>
      </div>

      <section className={`${s.conectar} vidrio`} aria-labelledby="conecta-titulo">
        <h2 id="conecta-titulo">Conecta tu hoja</h2>
        <ol className={s.pasos}>
          <li>
            <span>Comparte tu hoja (como lector) con este correo:</span>
            <span className={s.correo}>
              <code>{datos?.correo_servicio || '…'}</code>
              <button type="button" className="btn btn-chico" onClick={copiarCorreo} disabled={!datos?.correo_servicio}>
                {copiado ? <><Check size={14} aria-hidden="true" /> Copiado</> : <><Copy size={14} aria-hidden="true" /> Copiar</>}
              </button>
            </span>
          </li>
          <li>Pega el enlace aquí y elige qué contiene.</li>
        </ol>
        <form className={s.form} onSubmit={conectar} noValidate>
          <label className={`campo ${s.url}`}>Enlace de Google Sheets o carpeta de Drive
            <input type="url" placeholder="https://docs.google.com/spreadsheets/d/…" value={url} onChange={(e) => setUrl(e.target.value)} aria-invalid={!!error} aria-describedby={error ? 'error-url' : undefined} />
          </label>
          <label className="campo">¿Qué es?
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {Object.entries(TIPOS_FUENTE).map(([k, v]) => <option key={k} value={k}>{v.nombre}</option>)}
            </select>
          </label>
          <button className="btn btn-primario" disabled={enviando}><Link2 size={16} aria-hidden="true" /> {enviando ? 'Conectando…' : 'Conectar'}</button>
          <button
            type="button"
            className="btn"
            disabled={subiendo}
            onClick={() => inputArchivo.current?.click()}
          >
            <Upload size={16} aria-hidden="true" /> {subiendo ? 'Cargando…' : 'Subir Excel / CSV'}
          </button>
          <input
            ref={inputArchivo}
            type="file"
            accept=".xlsx,.csv"
            className="sr-only"
            aria-label="Subir archivo de hoja de cálculo"
            onChange={(e) => { subirArchivo(e.target.files[0]); e.target.value = ''; }}
          />
        </form>
        {error && <p id="error-url" className="campo"><span className="error">{error}</span></p>}
        <p className="muted" style={{ fontSize: '.8rem' }}>Nunca te pediremos tu contraseña de Google. Solo leemos las hojas que compartes con ese correo, o el archivo Excel/CSV que subas aquí.</p>
      </section>

      <section aria-labelledby="fuentes-titulo" className={s.lista}>
        <h2 id="fuentes-titulo">Fuentes conectadas</h2>
        {!datos ? <p className="muted">Cargando…</p> : datos.fuentes.length === 0 ? (
          <EmptyState texto="Aún no conectas ninguna hoja. Empieza por tu hoja de ventas." icono={FileSpreadsheet} />
        ) : datos.fuentes.map((f) => {
          const e = ESTADOS[f.estado] || ESTADOS.error;
          const Icono = e.icono;
          const viendoEsta = fuenteActivaId === f.id && detalleFuente;
          return (
            <article key={f.id} className={`${s.fuente} vidrio ${viendoEsta ? s.fuenteActiva : ''}`}>
              <FileSpreadsheet size={22} aria-hidden="true" className={s.iconoHoja} />
              <div className={s.fuenteTexto}>
                <strong>{f.nombre}</strong>
                <small className="muted">{TIPOS_FUENTE[f.tipo]?.nombre} · {f.filas != null ? `${f.filas} filas` : 'sin leer'} · Última sincronización: {hace(f.ultima_sync)}</small>
                {f.error && <small className={s.textoError}>{f.error}</small>}
              </div>
              <span className={`${s.estado} ${s[e.clase]}`}><Icono size={14} aria-hidden="true" className={e.clase === 'cargando' ? s.gira : ''} /> {e.texto}</span>
              <div className={s.accionesFuente}>
                <button
                  type="button"
                  className={`btn btn-chico ${viendoEsta ? 'btn-primario' : ''}`}
                  disabled={f.estado !== 'ok'}
                  onClick={() => {
                    if (viendoEsta) {
                      setFuenteActivaId(null);
                      setDetalleFuente(null);
                    } else {
                      verDatos(f.id);
                    }
                  }}
                >
                  {viendoEsta ? <><EyeOff size={14} aria-hidden="true" /> Ocultar datos</> : <><Eye size={14} aria-hidden="true" /> Ver datos</>}
                </button>
                <button type="button" className="btn btn-chico" onClick={() => sincronizar(f.id)} disabled={f.estado === 'sincronizando'}>
                  <RefreshCw size={14} aria-hidden="true" /> Sincronizar ahora
                </button>
              </div>
            </article>
          );
        })}
      </section>

      {(cargandoDetalle || detalleFuente) && (
        <section aria-labelledby="visor-titulo" className={`${s.visor} vidrio vidrio-opaco`}>
          <div className={s.visorCabeza}>
            <div>
              <h2 id="visor-titulo">
                {detalleFuente ? `Datos de la hoja: ${detalleFuente.nombre}` : 'Cargando datos de la hoja…'}
              </h2>
              {detalleFuente && (
                <p className="muted">
                  Tipo: <strong>{TIPOS_FUENTE[detalleFuente.tipo]?.nombre || detalleFuente.tipo}</strong> · {filasFiltradas.length} {filasFiltradas.length === 1 ? 'fila' : 'filas'}
                </p>
              )}
            </div>
            {detalleFuente && (
              <div className={s.visorControles}>
                <label className={s.buscar}>
                  <Search size={15} aria-hidden="true" />
                  <span className="sr-only">Buscar en la hoja</span>
                  <input
                    className="input"
                    placeholder="Buscar cliente, producto, distrito…"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                  />
                </label>
              </div>
            )}
          </div>

          {cargandoDetalle ? (
            <p className="muted">Leyendo filas de la hoja…</p>
          ) : (
            <>
              <TablaHoja tipo={detalleFuente.tipo} filas={filasPagina} />
              {filasFiltradas.length > FILAS_POR_PAGINA && (
                <div className={s.paginacion}>
                  <small className="muted">
                    Mostrando {(paginaActual - 1) * FILAS_POR_PAGINA + 1}–{Math.min(paginaActual * FILAS_POR_PAGINA, filasFiltradas.length)} de {filasFiltradas.length} filas
                  </small>
                  <div className={s.paginacionBotones}>
                    <button
                      type="button"
                      className="btn btn-chico"
                      disabled={paginaActual <= 1}
                      onClick={() => setPagina((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft size={14} aria-hidden="true" /> Anterior
                    </button>
                    <span className={s.paginaTexto}>Página {paginaActual} de {totalPaginas}</span>
                    <button
                      type="button"
                      className="btn btn-chico"
                      disabled={paginaActual >= totalPaginas}
                      onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                    >
                      Siguiente <ChevronRight size={14} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

      <section aria-labelledby="columnas-titulo">
        <h2 id="columnas-titulo">Cómo preparar tu hoja</h2>
        <p className="muted">Usa la primera fila para estos títulos de columna (hoja predefinida). El orden no importa.</p>
        <div className={s.columnas}>
          {Object.entries(TIPOS_FUENTE).map(([k, v]) => (
            <article key={k} className={`${s.tipo} vidrio`}>
              <h3>{v.nombre}</h3>
              <ul>{v.columnas.map((c) => <li key={c}><code>{c}</code></li>)}</ul>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
