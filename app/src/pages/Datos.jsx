import { useCallback, useState } from 'react';
import { Copy, Check, RefreshCw, Link2, AlertCircle, CheckCircle2, Loader2, FileSpreadsheet } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { usePolling } from '../hooks/usePolling.js';
import { listarFuentes, conectarFuente, sincronizarFuente, TIPOS_FUENTE, esUrlGoogle } from '../services/fuentes.js';
import EmptyState from '../components/EmptyState.jsx';
import s from './Datos.module.css';

const ESTADOS = {
  ok: { texto: 'Sincronizada', icono: CheckCircle2, clase: 'ok' },
  sincronizando: { texto: 'Sincronizando…', icono: Loader2, clase: 'cargando' },
  error: { texto: 'Error', icono: AlertCircle, clase: 'error' },
};

function hace(iso) {
  if (!iso) return 'Nunca';
  const min = Math.round((Date.now() - new Date(iso)) / 60000);
  if (min < 1) return 'Hace un momento';
  if (min < 60) return `Hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `Hace ${h} h` : new Date(iso).toLocaleDateString('es-PE');
}

export default function Datos() {
  const { toast, refrescarNotificaciones } = useApp();
  const [datos, setDatos] = useState(null);
  const [url, setUrl] = useState('');
  const [tipo, setTipo] = useState('ventas');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const cargar = useCallback(() => listarFuentes().then(setDatos).catch(() => setDatos({ fuentes: [] })), []);
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
      await conectarFuente({ url, tipo });
      setUrl('');
      toast({ titulo: 'Hoja conectada', texto: 'Estamos leyendo tus datos. Te avisamos al terminar.' });
      await cargar();
    } catch (ex) {
      setError(ex.message);
    } finally {
      setEnviando(false);
    }
  };

  const sincronizar = async (id) => {
    await sincronizarFuente(id).catch((ex) => toast({ titulo: 'No se pudo sincronizar', texto: ex.message, tono: 'coral' }));
    await cargar();
    setTimeout(refrescarNotificaciones, 2800);
  };

  const copiarCorreo = async () => {
    try {
      await navigator.clipboard.writeText(datos.correo_servicio);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { /* el usuario puede copiarlo a mano */ }
  };

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
        </form>
        {error && <p id="error-url" className="campo"><span className="error">{error}</span></p>}
        <p className="muted" style={{ fontSize: '.8rem' }}>Nunca te pediremos tu contraseña de Google. Solo leemos las hojas que compartes con ese correo.</p>
      </section>

      <section aria-labelledby="fuentes-titulo" className={s.lista}>
        <h2 id="fuentes-titulo">Fuentes conectadas</h2>
        {!datos ? <p className="muted">Cargando…</p> : datos.fuentes.length === 0 ? (
          <EmptyState texto="Aún no conectas ninguna hoja. Empieza por tu hoja de ventas." icono={FileSpreadsheet} />
        ) : datos.fuentes.map((f) => {
          const e = ESTADOS[f.estado] || ESTADOS.error;
          const Icono = e.icono;
          return (
            <article key={f.id} className={`${s.fuente} vidrio`}>
              <FileSpreadsheet size={22} aria-hidden="true" className={s.iconoHoja} />
              <div className={s.fuenteTexto}>
                <strong>{f.nombre}</strong>
                <small className="muted">{TIPOS_FUENTE[f.tipo]?.nombre} · {f.filas != null ? `${f.filas} filas` : 'sin leer'} · Última sincronización: {hace(f.ultima_sync)}</small>
                {f.error && <small className={s.textoError}>{f.error}</small>}
              </div>
              <span className={`${s.estado} ${s[e.clase]}`}><Icono size={14} aria-hidden="true" className={e.clase === 'cargando' ? s.gira : ''} /> {e.texto}</span>
              <button className="btn btn-chico" onClick={() => sincronizar(f.id)} disabled={f.estado === 'sincronizando'}><RefreshCw size={14} aria-hidden="true" /> Sincronizar ahora</button>
            </article>
          );
        })}
      </section>

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
