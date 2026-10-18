import { useEffect, useRef, useState } from 'react';
import { Copy, Lightbulb, Megaphone, Users, Check } from 'lucide-react';
import { listarSegmentos, obtenerRecomendaciones } from '../services/segmentos.js';
import { DIAS_INACTIVO } from '../lib/segmentos.js';
import { formatoFecha, formatoSoles } from '../lib/format.js';
import EmptyState from '../components/EmptyState.jsx';
import s from './Fidelizacion.module.css';

function BotonCopiar({ texto, etiqueta = 'Copiar mensaje' }) {
  const [listo, setListo] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setListo(true);
      setTimeout(() => setListo(false), 2000);
    } catch {
      setListo(false);
    }
  };
  return (
    <button type="button" className="btn btn-chico" onClick={copiar} aria-live="polite">
      {listo ? <><Check size={14} aria-hidden="true" /> Copiado</> : <><Copy size={14} aria-hidden="true" /> {etiqueta}</>}
    </button>
  );
}

const PASOS = [
  { paso: 'Gracias', cuando: '1 día después de la entrega' },
  { paso: '¿Cómo te fue?', cuando: '1 semana después' },
  { paso: 'Próxima ocasión', cuando: '3 semanas antes de la siguiente fecha' },
];

export default function Fidelizacion() {
  const [segmentos, setSegmentos] = useState(null);
  const [activo, setActivo] = useState(null);
  const [recos, setRecos] = useState(null);
  const [borrador, setBorrador] = useState('');
  const detalle = useRef(null);

  useEffect(() => { listarSegmentos().then(setSegmentos).catch(() => setSegmentos([])); }, []);

  const seg = segmentos?.find((x) => x.id === activo);
  const lista = recos?.recomendaciones || [];
  const secuencia = (recos?.secuencia_postventa || []).map((texto, i) => ({ texto, ...(PASOS[i] || { paso: `Mensaje ${i + 1}`, cuando: '' }) }));

  useEffect(() => {
    if (!seg) return;
    setRecos(null);
    obtenerRecomendaciones(seg)
      .then((r) => { setRecos(r); setBorrador(r.recomendaciones?.[0]?.mensaje_borrador || ''); })
      .catch(() => setRecos({ recomendaciones: [], secuencia_postventa: [] }));
    detalle.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo]);

  return (
    <div className="pagina">
      <div className="cabecera">
        <div>
          <h1>Fidelización</h1>
          <p className="muted">Ideas para que tus clientes vuelvan. Tú decides qué enviar.</p>
        </div>
      </div>

      {!segmentos ? <p className="muted">Calculando segmentos…</p> : segmentos.length === 0 ? (
        <EmptyState texto="Aún no hay clientes suficientes para armar segmentos. Conecta tu hoja de ventas en Datos." accion="Ir a Datos" enlace="/app/datos" />
      ) : (
        <div className={s.tarjetas} role="list">
          {segmentos.map((x) => (
            <button key={x.id} role="listitem" className={`${s.tarjeta} vidrio ${activo === x.id ? s.activa : ''}`} onClick={() => setActivo(x.id)} aria-pressed={activo === x.id}>
              <span className={s.nombre}>{x.nombre}</span>
              <span className={s.tamano}>{x.tamano}<small> clientes</small></span>
              <span className="muted">{x.descripcion}</span>
              <span className={s.datos}>
                <span>{formatoSoles(x.monto)} comprados</span>
                <span>Última compra: {formatoFecha(x.ultima)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      <p className="muted" style={{ fontSize: '.78rem' }}>
        Segmentos calculados con el histórico anonimizado. “Inactivo” = más de {DIAS_INACTIVO} días sin comprar <span className="supuesto">SUPUESTO</span>. No segmentamos por edad: no tenemos ese dato.
      </p>

      {seg && (
        <section ref={detalle} className={s.detalle} aria-labelledby="seg-titulo">
          <h2 id="seg-titulo">{seg.nombre}</h2>

          <div className={s.columnas}>
            <article className={`${s.bloque} vidrio`}>
              <h3><Lightbulb size={16} aria-hidden="true" /> Recomendaciones postventa</h3>
              {!recos ? <p className="muted">Cargando…</p> : lista.length === 0 ? <p className="muted">Sin recomendaciones para este segmento.</p> : (
                <ul className={s.recos}>
                  {lista.map((r) => (
                    <li key={r.titulo}><strong>{r.titulo}</strong><span><em>¿Por qué?</em> {r.motivo}</span></li>
                  ))}
                </ul>
              )}
            </article>

            <article className={`${s.bloque} vidrio`}>
              <h3><Megaphone size={16} aria-hidden="true" /> Canal y campaña sugeridos</h3>
              <p><strong>{seg.canal}</strong></p>
              <p className="muted">{seg.campana}</p>
              <label className="campo">Borrador del mensaje (puedes editarlo)
                <textarea rows={5} value={borrador} onChange={(e) => setBorrador(e.target.value)} />
              </label>
              <div className={s.filaBotones}>
                <BotonCopiar texto={borrador} />
                <small className="muted">En la demo no se envía nada.</small>
              </div>
              <h3 className={s.subtitulo}>Seguimiento en 3 mensajes</h3>
              <ol className={s.secuencia}>
                {secuencia.map((m) => (
                  <li key={m.paso}>
                    <div><strong>{m.paso}</strong> <small className="muted">· {m.cuando}</small></div>
                    <p>{m.texto}</p>
                    <BotonCopiar texto={m.texto} />
                  </li>
                ))}
              </ol>
            </article>
          </div>

          <article className={`${s.bloque} vidrio vidrio-opaco`}>
            <h3><Users size={16} aria-hidden="true" /> Clientes del segmento ({seg.tamano})</h3>
            <div className={s.tablaCaja}>
              <table className={s.tabla}>
                <thead><tr><th scope="col">Cliente</th><th scope="col">Pedidos</th><th scope="col">Monto</th><th scope="col">Última compra</th></tr></thead>
                <tbody>
                  {seg.clientes.slice(0, 50).map((c) => (
                    <tr key={c.alias}><td>{c.alias}</td><td>{c.pedidos}</td><td>{formatoSoles(c.monto)}</td><td>{formatoFecha(c.ultima)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            {seg.clientes.length > 50 && <p className="muted">Mostrando los 50 de mayor monto.</p>}
          </article>
        </section>
      )}
    </div>
  );
}
