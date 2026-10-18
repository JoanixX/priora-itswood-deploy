import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bar, BarChart, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Clock, MessageSquareText, Building2, Receipt, Users, Check, Eye } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { usePolling } from '../hooks/usePolling.js';
import { obtenerMetricasChat } from '../services/metricas.js';
import { obtenerVentasHistoricas } from '../services/pedidos.js';
import { calcularMetricas, mesesDisponibles } from '../lib/metricas.js';
import { formatoNumero, formatoPct, formatoSoles, nombreMes, textoDias } from '../lib/format.js';
import { ordenarBandeja } from '../lib/prioridad.js';
import InfoTip from '../components/InfoTip.jsx';
import PriorityBadge from '../components/PriorityBadge.jsx';
import EmptyState from '../components/EmptyState.jsx';
import s from './Inicio.module.css';

const FUENTE_HIST = 'Fuente: datos reales anonimizados de la hoja Ventas 2026 (jun–oct 2026).';
const FUENTE_MERMIN = 'Fuente: registros de Mermín.';
// Recharts pinta atributos SVG: ahí no funcionan las variables CSS.
const SERIE_1 = '#a0521f';
const TINTA = '#3E2F25';
const TINTA_SUAVE = '#5E4A3B';

function TooltipSoles({ active, payload, label, etiqueta }) {
  if (!active || !payload?.length) return null;
  return (
    <div className={`${s.tooltip} vidrio vidrio-opaco`}>
      <strong>{etiqueta ? etiqueta(label) : label}</strong>
      <span>{formatoSoles(payload[0].value)}</span>
    </div>
  );
}

function TablaDatos({ filas, columnas }) {
  return (
    <details className={s.tablaDatos}>
      <summary>Ver como tabla</summary>
      <table>
        <thead><tr>{columnas.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
        <tbody>{filas.map((f) => <tr key={f[0]}>{f.map((v, i) => <td key={i}>{v}</td>)}</tr>)}</tbody>
      </table>
    </details>
  );
}

export default function Inicio() {
  const { pedidos, ventas: ventasCtx, actualizarPedido, toast, config } = useApp();
  const ventas = ventasCtx || obtenerVentasHistoricas();
  const navegar = useNavigate();
  const [periodo, setPeriodo] = useState('todo');
  const [chat, setChat] = useState(null);

  const cargarChat = useCallback(() => obtenerMetricasChat(periodo).then(setChat).catch(() => setChat(null)), [periodo]);
  usePolling(cargarChat, 10000);

  const m = useMemo(() => calcularMetricas(ventas, periodo, config.reglas.minimo_empresa), [ventas, periodo, config.reglas.minimo_empresa]);
  const meses = useMemo(() => mesesDisponibles(ventas), [ventas]);

  // "Atiende primero": lo recién llegado de Mermín arriba; luego lo urgente por prioridad y fecha.
  const bandeja = useMemo(() => ordenarBandeja(pedidos), [pedidos]);

  const confirmar = async (p) => {
    try {
      await actualizarPedido(p.id, { estado: 'confirmado' });
      toast({ titulo: 'Pedido confirmado', texto: `${p.cliente} · ${p.producto}` });
    } catch (e) {
      toast({ titulo: 'No se pudo confirmar', texto: e.message, tono: 'coral' });
    }
  };

  const mejorMes = m.ventasPorMes.reduce((a, b) => (b.monto > (a?.monto ?? -1) ? b : a), null);
  const canalTop = [...m.porCanal].sort((a, b) => b.monto - a.monto)[0];
  const antes = chat?.tiempo_primera_respuesta_antes_min ?? config.metricas?.tiempo_respuesta_antes_min ?? null;
  const despuesSeg = chat?.tiempo_primera_respuesta_seg;
  const textoPeriodo = periodo === 'todo' ? 'todo 2026' : nombreMes(periodo, true);

  return (
    <div className="pagina">
      <div className="cabecera">
        <div>
          <h1>¿Qué atiendo hoy?</h1>
          <p className="muted">{config.asistente} ya ordenó tus pedidos: primero lo que más vale y lo más urgente.</p>
        </div>
      </div>

      <section className={`${s.bandeja} vidrio`} aria-labelledby="atiende-titulo">
        <div className={s.bandejaCabeza}>
          <h2 id="atiende-titulo">Atiende primero</h2>
          <Link to="/app/pedidos" className="btn btn-chico">Ver todos los pedidos</Link>
        </div>
        {bandeja.length === 0 ? (
          <EmptyState texto="Aún no hay pedidos urgentes. Prueba la demo en Mermín." accion="Ir a Mermín" enlace="/app/mermin" />
        ) : (
          <ul className={s.listaBandeja}>
            {bandeja.map((p) => (
              <li key={p.id} className={`${s.item} ${p.prioridad === 'derivado' ? s.itemDerivado : ''}`}>
                <div className={s.itemTexto}>
                  <div className={s.itemFila}>
                    <PriorityBadge prioridad={p.prioridad} />
                    <strong>{p.cliente}</strong>
                    {p.ejemplo && <span className="ejemplo-tag">Ejemplo</span>}
                  </div>
                  <span className="muted">{p.motivo}</span>
                  <span className={s.itemDetalle}>{p.cantidad} × {p.producto} · {formatoSoles(p.monto)} · entrega {textoDias(p.dias).toLowerCase()}</span>
                </div>
                <div className={s.itemAcciones}>
                  <span className={s.dias}><strong>{p.dias ?? '—'}</strong><small>{p.dias === 1 ? 'día' : 'días'}</small></span>
                  <button className="btn btn-chico" onClick={() => navegar(`/app/pedidos?id=${p.id}`)}><Eye size={14} aria-hidden="true" /> Ver</button>
                  {p.origen === 'mermin' && (
                    <button className="btn btn-chico btn-primario" onClick={() => confirmar(p)}><Check size={14} aria-hidden="true" /> Confirmar</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className={s.periodo}>
        <h2>¿Cómo va mi negocio?</h2>
        <label>
          <span className="sr-only">Período</span>
          <select className="input" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            <option value="todo">Todo 2026</option>
            {meses.map((mes) => <option key={mes} value={mes}>{nombreMes(mes, true)}</option>)}
          </select>
        </label>
      </div>

      <section className={s.metricas} aria-label="Métricas clave">
        <article className={`${s.metrica} vidrio`}>
          <header><Clock size={18} aria-hidden="true" /><h3>Tiempo de primera respuesta</h3>
            <InfoTip titulo="Tiempo de primera respuesta">Cuánto espera un cliente desde su primer mensaje hasta la primera respuesta. “Antes” lo mide la dueña (sin Mermín); “ahora” sale de los registros de Mermín.</InfoTip>
          </header>
          {antes != null ? (
            <p className={s.valor}>{antes} min → {despuesSeg != null ? `${Math.round(despuesSeg)} s` : '—'}</p>
          ) : (
            <p className={s.valor}>{despuesSeg != null ? `${Math.round(despuesSeg)} s` : '—'}<small> ahora</small></p>
          )}
          <p className={s.sub}>Antes: {antes != null ? `${antes} min` : <em>Por medir con la dueña</em>}</p>
          <p className={s.fuente}>{FUENTE_MERMIN} {chat?.ejemplo && <span className="ejemplo-tag">Ejemplo</span>}</p>
        </article>

        <article className={`${s.metrica} vidrio`}>
          <header><MessageSquareText size={18} aria-hidden="true" /><h3>Consultas que terminan en pedido</h3>
            <InfoTip titulo="Consultas que terminan en pedido">Conversaciones con Mermín que cerraron un pedido, entre todas las conversaciones del período.</InfoTip>
          </header>
          <p className={s.valor}>{chat ? formatoPct(chat.conversion) : '—'}</p>
          <p className={s.sub}>{chat ? `${chat.conversaciones_con_pedido} de ${chat.conversaciones} conversaciones` : 'Sin datos aún'}</p>
          <p className={s.fuente}>{FUENTE_MERMIN} {chat?.ejemplo && <span className="ejemplo-tag">Ejemplo</span>}</p>
        </article>

        <article className={`${s.metrica} vidrio`}>
          <header><Building2 size={18} aria-hidden="true" /><h3>Pedidos corporativos al mes</h3>
            <InfoTip titulo="Pedidos corporativos al mes">Pedidos de empresa o de {config.reglas.minimo_empresa} unidades o más. En “Todo 2026” es el promedio mensual.</InfoTip>
          </header>
          <p className={s.valor}>{formatoNumero(Math.round(m.corporativosMes))}</p>
          <div className={s.sparkline} role="img" aria-label={`Tendencia mensual: ${m.corporativosPorMes.map((x) => `${nombreMes(x.mes)} ${x.pedidos}`).join(', ')}`}>
            <ResponsiveContainer width="100%" height={40}>
              <LineChart data={m.corporativosPorMes} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                <Line type="monotone" dataKey="pedidos" stroke={SERIE_1} strokeWidth={2} dot={{ r: 2.5, fill: SERIE_1 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className={s.fuente}>{FUENTE_HIST}</p>
        </article>

        <article className={`${s.metrica} vidrio`}>
          <header><Receipt size={18} aria-hidden="true" /><h3>Ticket promedio por pedido</h3>
            <InfoTip titulo="Ticket promedio">Monto promedio de los pedidos con monto registrado (incluye delivery).</InfoTip>
          </header>
          <p className={s.valor}>{formatoSoles(m.ticket)}</p>
          <p className={s.sub}>Empresa {formatoSoles(m.ticketEmpresa)} · Persona {formatoSoles(m.ticketPersona)}</p>
          <p className={s.fuente}>{FUENTE_HIST}</p>
        </article>

        <article className={`${s.metrica} vidrio`}>
          <header><Users size={18} aria-hidden="true" /><h3>Clientes registrados en la hoja</h3>
            <InfoTip titulo="Clientes registrados">Clientes distintos (por teléfono o nombre, anonimizados) en el período.</InfoTip>
          </header>
          <p className={s.valor}>{formatoNumero(m.clientes)}</p>
          <p className={s.sub}>Base para la recompra · {m.recurrentes} ya compraron 2 o más veces</p>
          <p className={s.fuente}>{FUENTE_HIST}</p>
        </article>
      </section>

      {m.registros === 0 ? (
        <EmptyState texto={`No hay ventas registradas en ${textoPeriodo}. Elige otro período.`} />
      ) : (
        <section className={s.graficos} aria-label="Gráficos">
          <article className={`${s.grafico} ${s.graficoAncho} vidrio`}>
            <h3>Los pedidos de {config.reglas.minimo_empresa}+ unidades son el {Math.round(m.pctGrandes * 100)} % del ingreso</h3>
            <p className="muted">{m.pedidosGrandes} de {m.registros} pedidos en {textoPeriodo}. Por eso {config.asistente} los pone primero.</p>
            <div className={s.apilada} role="img" aria-label={`Pedidos de ${config.reglas.minimo_empresa} o más unidades: ${formatoSoles(m.montoGrandes)}, ${Math.round(m.pctGrandes * 100)} %. Pedidos pequeños: ${formatoSoles(m.montoChicos)}.`}>
              <div className={s.segGrande} style={{ flexGrow: m.montoGrandes }}>
                <span>{config.reglas.minimo_empresa}+ unidades · {formatoSoles(m.montoGrandes)}</span>
              </div>
              <div className={s.segChico} style={{ flexGrow: m.montoChicos }}>
                <span>{Math.round((1 - m.pctGrandes) * 100)} %</span>
              </div>
            </div>
            <ul className={s.leyenda}>
              <li><i style={{ background: 'var(--serie-1)' }} />{config.reglas.minimo_empresa} o más unidades · {formatoPct(m.pctGrandes)}</li>
              <li><i style={{ background: 'var(--serie-2)' }} />Menos de {config.reglas.minimo_empresa} unidades · {formatoSoles(m.montoChicos)}</li>
            </ul>
          </article>

          <article className={`${s.grafico} vidrio`}>
            <h3>{mejorMes ? `${nombreMes(mejorMes.mes, true).replace(/^./, (c) => c.toUpperCase())} fue el mes más fuerte: ${formatoSoles(mejorMes.monto)}` : 'Ventas por mes'}</h3>
            <p className="muted">Ventas por mes de pedido, todo 2026.</p>
            <div role="img" aria-label={`Ventas por mes: ${m.ventasPorMes.map((x) => `${nombreMes(x.mes)} ${formatoSoles(x.monto)}`).join(', ')}`}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={m.ventasPorMes} margin={{ top: 20, right: 8, left: 8, bottom: 0 }}>
                  <XAxis dataKey="mes" tickFormatter={(v) => nombreMes(v)} axisLine={false} tickLine={false} tick={{ fill: TINTA_SUAVE, fontSize: 12 }} />
                  <YAxis hide />
                  <Tooltip cursor={{ fill: 'rgba(62,47,37,.06)' }} content={<TooltipSoles etiqueta={(v) => nombreMes(v, true)} />} />
                  <Bar dataKey="monto" fill={SERIE_1} radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false}>
                    <LabelList dataKey="monto" position="top" formatter={(v) => `${Math.round(v / 1000)} mil`} style={{ fill: TINTA_SUAVE, fontSize: 11 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <TablaDatos columnas={['Mes', 'Ventas']} filas={m.ventasPorMes.map((x) => [nombreMes(x.mes, true), formatoSoles(x.monto)])} />
          </article>

          <article className={`${s.grafico} vidrio`}>
            <h3>{canalTop.canal} trae el {Math.round(canalTop.pct * 100)} % de las ventas</h3>
            <p className="muted">Ventas por canal en {textoPeriodo}. Pautas = publicidad pagada; redes = TikTok e Instagram.</p>
            <div role="img" aria-label={`Ventas por canal: ${m.porCanal.map((c) => `${c.canal} ${formatoPct(c.pct)}`).join(', ')}`}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={m.porCanal} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="canal" width={80} axisLine={false} tickLine={false} tick={{ fill: TINTA, fontSize: 12 }} />
                  <Tooltip cursor={{ fill: 'rgba(62,47,37,.06)' }} content={<TooltipSoles />} />
                  <Bar dataKey="monto" fill={SERIE_1} radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false}>
                    <LabelList dataKey="pct" position="right" formatter={(v) => formatoPct(v)} style={{ fill: TINTA_SUAVE, fontSize: 12 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <TablaDatos columnas={['Canal', 'Ventas', '%']} filas={m.porCanal.map((c) => [c.canal, formatoSoles(c.monto), formatoPct(c.pct)])} />
          </article>
        </section>
      )}
      {periodo === 'todo' && <p className="muted" style={{ fontSize: '.8rem' }}>Incluye {ventas.filter((v) => !v.fecha_pedido).length} ventas sin fecha registrada; al elegir un mes no se cuentan.</p>}
    </div>
  );
}
