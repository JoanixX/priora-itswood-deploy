import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { RotateCcw, Send, ExternalLink, Play, Sparkles, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { enviarMensaje, ESCENARIOS } from '../services/chat.js';
import { calcularPrioridad } from '../lib/prioridad.js';
import { formatoFecha, formatoSoles } from '../lib/format.js';
import PriorityBadge from '../components/PriorityBadge.jsx';
import s from './Mermin.module.css';

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const hora = () => new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

export default function Mermin() {
  const { config, pedidos, refrescarPedidos, refrescarNotificaciones, toast } = useApp();
  const [mensajes, setMensajes] = useState([]);
  const [convId, setConvId] = useState(null);
  const [borrador, setBorrador] = useState(null);
  const [pedidoId, setPedidoId] = useState(null);
  const [escribiendo, setEscribiendo] = useState(false);
  const [texto, setTexto] = useState('');
  const [pestana, setPestana] = useState('chat');
  const [corriendo, setCorriendo] = useState(false);
  const turno = useRef(0); // invalida respuestas viejas al reiniciar
  const chatRef = useRef(null);

  const agregarBot = (ms) => setMensajes((xs) => [...xs, ...ms.map((m) => ({ ...m, de: 'bot', hora: hora() }))]);

  const procesar = useCallback(async (entrada, idConv, miTurno) => {
    setEscribiendo(true);
    try {
      const r = await enviarMensaje({ conversacion_id: idConv, ...entrada });
      if (miTurno !== turno.current) return null;
      setConvId(r.conversacion_id);
      agregarBot(r.mensajes || []);
      if (r.borrador) setBorrador(r.borrador);
      if (r.pedido_id) {
        setPedidoId(r.pedido_id);
        await Promise.all([refrescarPedidos(), refrescarNotificaciones()]);
      }
      return r;
    } catch (e) {
      if (miTurno === turno.current) agregarBot([{ texto: `No pude responder (${e.message}). Intenta de nuevo.` }]);
      return null;
    } finally {
      if (miTurno === turno.current) setEscribiendo(false);
    }
  }, [refrescarPedidos, refrescarNotificaciones]);

  const reiniciar = useCallback(async () => {
    const miTurno = ++turno.current;
    setMensajes([]);
    setBorrador(null);
    setPedidoId(null);
    setConvId(null);
    setCorriendo(false);
    return { miTurno, r: await procesar({}, null, miTurno) };
  }, [procesar]);

  // La bienvenida usa la configuración actual: si cambia en Ajustes y aún no hay conversación, se reinicia.
  const firmaConfig = JSON.stringify([config.asistente, config.textos, config.bienvenida, config.tono]);
  const hayUsuario = mensajes.some((m) => m.de === 'yo');
  useEffect(() => {
    if (!hayUsuario) reiniciar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firmaConfig]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [mensajes, escribiendo]);

  const enviar = async (entrada, textoVisible) => {
    if (escribiendo) return;
    setMensajes((xs) => [...xs, { de: 'yo', texto: textoVisible ?? entrada.texto, hora: hora() }]);
    await procesar(entrada, convId, turno.current);
  };

  const alEnviarTexto = (e) => {
    e.preventDefault();
    const t = texto.trim();
    if (!t) return;
    setTexto('');
    enviar({ texto: t });
  };

  const correrEscenario = async (esc) => {
    const { miTurno, r } = await reiniciar();
    if (!r) return;
    setCorriendo(true);
    let id = r.conversacion_id;
    for (const paso of esc.pasos) {
      await espera(700);
      if (miTurno !== turno.current) return;
      setMensajes((xs) => [...xs, { de: 'yo', texto: paso.texto, hora: hora() }]);
      const res = await procesar({ texto: paso.texto, boton_id: paso.boton_id || null }, id, miTurno);
      if (!res) return;
      id = res.conversacion_id;
    }
    if (miTurno === turno.current) setCorriendo(false);
  };

  const pedidoCerrado = pedidos.find((p) => p.id === pedidoId);
  const ultimoBot = [...mensajes].reverse().find((m) => m.de === 'bot');
  const botones = !escribiendo && !corriendo && ultimoBot?.botones?.length ? ultimoBot.botones : [];

  const enVivo = useMemo(() => {
    if (pedidoCerrado) return { ...pedidoCerrado, cerrado: true };
    if (!borrador) return null;
    const monto = (borrador.productos || []).reduce((a, p) => a + p.cantidad * p.precio_unitario, 0);
    const listo = borrador.tipo && borrador.cantidad;
    const calc = listo ? calcularPrioridad({ ...borrador, monto, fecha_entrega: borrador.fecha_requerida }, config) : null;
    return { ...borrador, monto, prioridad: calc?.prioridad, motivo: calc?.motivo, cerrado: false };
  }, [borrador, pedidoCerrado, config]);

  return (
    <div className="pagina">
      <div className="cabecera">
        <div>
          <h1>{config.asistente} en acción</h1>
          <p className="muted">Así atiende a tus clientes por WhatsApp y te deja el pedido listo y priorizado.</p>
        </div>
        <div className={s.controles}>
          <label className={s.escenario}>
            <span><Play size={14} aria-hidden="true" /> Escenario de demo</span>
            <select className="input" value="" onChange={(e) => { const esc = ESCENARIOS.find((x) => x.id === e.target.value); if (esc) correrEscenario(esc); }}>
              <option value="">Elige una conversación…</option>
              {ESCENARIOS.map((e) => <option key={e.id} value={e.id}>{e.titulo}</option>)}
            </select>
          </label>
          <button className="btn" onClick={reiniciar}><RotateCcw size={16} aria-hidden="true" /> Reiniciar conversación</button>
        </div>
      </div>

      <div className={s.pestanas} role="tablist" aria-label="Vista">
        <button role="tab" aria-selected={pestana === 'chat'} className={pestana === 'chat' ? s.pestanaActiva : ''} onClick={() => setPestana('chat')}>Chat</button>
        <button role="tab" aria-selected={pestana === 'pedido'} className={pestana === 'pedido' ? s.pestanaActiva : ''} onClick={() => setPestana('pedido')}>
          Pedido {enVivo?.prioridad && <span className={s.punto} aria-hidden="true" />}
        </button>
      </div>

      <div className={s.escena}>
        <section className={`${s.telefono} ${pestana !== 'chat' ? s.ocultoMovil : ''}`} aria-label="Simulación de WhatsApp para la demo">
          <header className={s.wspCabeza}>
            <span className={s.avatar} aria-hidden="true">{config.asistente.slice(0, 1)}</span>
            <div>
              <strong>{config.negocio}</strong>
              <small>{escribiendo ? 'escribiendo…' : `${config.asistente} · asistente`}</small>
            </div>
          </header>
          <p className={s.rotulo}>Simulación de WhatsApp para la demo</p>
          <div className={s.chat} ref={chatRef} aria-live="polite">
            {mensajes.map((m, i) => (
              <div key={i} className={`${s.burbuja} ${m.de === 'yo' ? s.yo : s.bot}`}>
                {m.texto && <p>{m.texto}</p>}
                {m.enlace && (
                  <a className={s.enlaceTienda} href={m.enlace.url} target="_blank" rel="noreferrer">
                    {m.enlace.texto} <ExternalLink size={14} aria-hidden="true" />
                  </a>
                )}
                {m.promo && <p className={s.promo}><Sparkles size={14} aria-hidden="true" /> {m.promo}</p>}
                <small>{m.hora}</small>
              </div>
            ))}
            {escribiendo && <div className={`${s.burbuja} ${s.bot} ${s.puntos}`} aria-label={`${config.asistente} está escribiendo`}><span /><span /><span /></div>}
          </div>
          {botones.length > 0 && (
            <div className={s.rapidos}>
              {botones.map((b) => <button key={b.id} className={s.rapido} onClick={() => enviar({ boton_id: b.id, texto: b.texto }, b.texto)}>{b.texto}</button>)}
            </div>
          )}
          <form className={s.entrada} onSubmit={alEnviarTexto}>
            <label className="sr-only" htmlFor="mensaje">Escribe un mensaje</label>
            <input id="mensaje" className="input" placeholder="Escribe como si fueras el cliente…" value={texto} onChange={(e) => setTexto(e.target.value)} disabled={corriendo} autoComplete="off" />
            <button className={s.enviar} aria-label="Enviar" disabled={escribiendo || corriendo || !texto.trim()}><Send size={18} /></button>
          </form>
        </section>

        <section className={`${s.pedido} vidrio ${pestana !== 'pedido' ? s.ocultoMovil : ''}`} aria-label="Pedido armándose en vivo">
          <h2>Pedido en vivo</h2>
          {!enVivo ? (
            <p className="muted">Cuando el cliente empiece a pedir, aquí ves el pedido armándose: ocasión, cantidad, fecha, productos y su prioridad.</p>
          ) : (
            <>
              <dl className={s.campos}>
                <Campo k="Cliente" v={enVivo.cliente ? (typeof enVivo.cliente === 'string' ? enVivo.cliente : enVivo.cliente.empresa || enVivo.cliente.nombre) : null} />
                <Campo k="Tipo" v={enVivo.tipo ? (enVivo.tipo === 'empresa' ? 'Empresa' : 'Persona') : null} />
                <Campo k="Ocasión" v={enVivo.ocasion} />
                <Campo k="Cantidad" v={enVivo.cantidad ? `${enVivo.cantidad} u.` : null} />
                <Campo k="Fecha de entrega" v={enVivo.fecha_requerida || enVivo.fecha_entrega ? formatoFecha(enVivo.fecha_requerida || enVivo.fecha_entrega) : null} />
                <Campo k="Personalización" v={enVivo.personalizacion} />
              </dl>
              <h3>Productos</h3>
              {enVivo.productos?.length ? (
                <ul className={s.productos}>
                  {enVivo.productos.map((p) => (
                    <li key={p.producto_id}><span>{p.cantidad} × {p.nombre}<small> · {formatoSoles(p.precio_unitario)} c/u (catálogo)</small></span><strong>{formatoSoles(p.cantidad * p.precio_unitario)}</strong></li>
                  ))}
                  <li className={s.total}><span>Total referencial</span><strong>{formatoSoles(enVivo.monto)}</strong></li>
                </ul>
              ) : <p className="muted">Aún sin elegir.</p>}

              {enVivo.prioridad && (
                <div className={`${s.prioridad} ${s[enVivo.prioridad] || ''}`}>
                  <div className={s.prioridadFila}>
                    <PriorityBadge prioridad={enVivo.prioridad} />
                    <span>{enVivo.cerrado ? 'Prioridad calculada' : 'Prioridad estimada'}</span>
                  </div>
                  <p>{enVivo.motivo}</p>
                  <small>Ganancia estimada: {formatoSoles(enVivo.monto * (config.prioridad?.margen_estimado ?? 0.5))} <span className="supuesto">SUPUESTO</span></small>
                </div>
              )}
              {enVivo.cerrado && (
                <div className={s.cerrado}>
                  <CheckCircle2 size={18} aria-hidden="true" />
                  <span>Pedido registrado. Ya aparece en Inicio y en Pedidos.</span>
                  <Link className="btn btn-chico btn-primario" to={`/app/pedidos?id=${enVivo.id}`}>Ver en Pedidos</Link>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function Campo({ k, v }) {
  return (
    <div className={v ? s.lleno : ''}>
      <dt>{k}</dt>
      <dd>{v || '—'}</dd>
    </div>
  );
}
