import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import PriorityBadge, { EstadoBadge } from '../components/PriorityBadge.jsx';
import OrderDetail from '../components/OrderDetail.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { formatoFecha, formatoSoles, textoDias } from '../lib/format.js';
import { descargarCsv } from '../lib/csv.js';
import s from './Pedidos.module.css';

const POR_PAGINA = 25;
const VACIO = { estado: '', prioridad: '', tipo: '', canal: '', desde: '', hasta: '', origen: '', q: '' };
const ETIQUETAS = {
  estado: 'Estado', prioridad: 'Prioridad', tipo: 'Tipo', canal: 'Canal', desde: 'Desde', hasta: 'Hasta', origen: 'Origen', q: 'Busca',
};
const PRIORIDAD_TXT = { derivado: 'Derivado', alta: 'Alta', media: 'Media', automatico: 'Automático' };
const ORIGEN_TXT = { mermin: 'Mermín', historico: 'Histórico' };

function textoFiltro(k, v) {
  if (k === 'prioridad') return PRIORIDAD_TXT[v];
  if (k === 'origen') return ORIGEN_TXT[v];
  if (k === 'tipo') return v === 'empresa' ? 'Empresa' : 'Persona';
  if (k === 'desde' || k === 'hasta') return formatoFecha(v);
  return v;
}

export default function Pedidos() {
  const { pedidos, cargandoPedidos, config } = useApp();
  const [params, setParams] = useSearchParams();
  const [f, setF] = useState(() => ({ ...VACIO, origen: params.get('origen') || '', prioridad: params.get('prioridad') || '' }));
  const [pagina, setPagina] = useState(0);
  const idAbierto = params.get('id');

  const opciones = useMemo(() => ({
    estados: [...new Set(pedidos.map((p) => p.estado))].sort(),
    canales: [...new Set(pedidos.map((p) => p.canal))].sort(),
  }), [pedidos]);

  const filtrados = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return pedidos.filter((p) =>
      (!f.estado || p.estado === f.estado)
      && (!f.prioridad || p.prioridad === f.prioridad)
      && (!f.tipo || p.tipo === f.tipo)
      && (!f.canal || p.canal === f.canal)
      && (!f.origen || p.origen === f.origen)
      && (!f.desde || (p.fecha_entrega && p.fecha_entrega >= f.desde))
      && (!f.hasta || (p.fecha_entrega && p.fecha_entrega <= f.hasta))
      && (!q || `${p.producto} ${p.cliente}`.toLowerCase().includes(q)));
  }, [pedidos, f]);

  const paginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, paginas - 1);
  const visibles = filtrados.slice(paginaActual * POR_PAGINA, (paginaActual + 1) * POR_PAGINA);
  const activos = Object.entries(f).filter(([, v]) => v);
  const abierto = pedidos.find((p) => p.id === idAbierto);

  const cambiar = (k, v) => { setF((x) => ({ ...x, [k]: v })); setPagina(0); };
  const abrir = (id) => setParams((p) => { p.set('id', id); return p; });
  const cerrar = () => setParams((p) => { p.delete('id'); return p; });

  const exportar = () => {
    // Sin datos personales: el histórico solo tiene alias y los pedidos de Mermín no exportan contacto.
    descargarCsv('pedidos_priora.csv', filtrados.map((p) => ({
      id: p.id, origen: ORIGEN_TXT[p.origen], prioridad: PRIORIDAD_TXT[p.prioridad], motivo: p.motivo,
      cliente: p.cliente, tipo: p.tipo, producto: p.producto, cantidad: p.cantidad, monto: p.monto,
      ganancia_estimada: p.ganancia, fecha_entrega: p.fecha_entrega || '', canal: p.canal, estado: p.estado,
    })));
  };

  const teclaFila = (e, id) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(id); }
    if (e.key === 'ArrowDown') { e.preventDefault(); e.currentTarget.nextElementSibling?.focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); e.currentTarget.previousElementSibling?.focus(); }
  };

  return (
    <div className="pagina">
      <div className="cabecera">
        <div>
          <h1>Pedidos</h1>
          <p className="muted">Ordenados por prioridad: lo que más vale y lo más urgente va primero. Ganancia estimada con margen de {Math.round((config.prioridad?.margen_estimado ?? 0.5) * 100)} % <span className="supuesto">SUPUESTO</span></p>
        </div>
        <button className="btn" onClick={exportar} disabled={!filtrados.length}><Download size={16} aria-hidden="true" /> Exportar CSV</button>
      </div>

      <section className={`${s.filtros} vidrio`} aria-label="Filtros">
        <label className={s.buscar}>
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Buscar por producto o cliente</span>
          <input className="input" placeholder="Buscar producto o cliente" value={f.q} onChange={(e) => cambiar('q', e.target.value)} />
        </label>
        <Selector etiqueta="Prioridad" valor={f.prioridad} onChange={(v) => cambiar('prioridad', v)} opciones={Object.entries(PRIORIDAD_TXT)} />
        <Selector etiqueta="Estado" valor={f.estado} onChange={(v) => cambiar('estado', v)} opciones={opciones.estados.map((e) => [e, e])} />
        <Selector etiqueta="Tipo" valor={f.tipo} onChange={(v) => cambiar('tipo', v)} opciones={[['empresa', 'Empresa'], ['persona', 'Persona']]} />
        <Selector etiqueta="Canal" valor={f.canal} onChange={(v) => cambiar('canal', v)} opciones={opciones.canales.map((c) => [c, c])} />
        <Selector etiqueta="Origen" valor={f.origen} onChange={(v) => cambiar('origen', v)} opciones={Object.entries(ORIGEN_TXT)} />
        <label className={s.fecha}>Entrega desde<input type="date" className="input" value={f.desde} onChange={(e) => cambiar('desde', e.target.value)} /></label>
        <label className={s.fecha}>hasta<input type="date" className="input" value={f.hasta} onChange={(e) => cambiar('hasta', e.target.value)} /></label>
      </section>

      {activos.length > 0 && (
        <div className={s.chips} aria-label="Filtros activos">
          {activos.map(([k, v]) => (
            <button key={k} className={s.chip} onClick={() => cambiar(k, '')} aria-label={`Quitar filtro ${ETIQUETAS[k]}`}>
              {ETIQUETAS[k]}: {textoFiltro(k, v)} <X size={12} aria-hidden="true" />
            </button>
          ))}
          <button className="btn btn-chico" onClick={() => { setF(VACIO); setPagina(0); }}>Limpiar</button>
        </div>
      )}

      <p className="muted" aria-live="polite">{filtrados.length} pedidos</p>

      {cargandoPedidos ? (
        <p className="muted">Cargando pedidos…</p>
      ) : filtrados.length === 0 ? (
        pedidos.length === 0
          ? <EmptyState titulo="Aún no hay pedidos nuevos" texto="Prueba la demo en Mermín y mira cómo llega un pedido priorizado." accion="Ir a Mermín" enlace="/app/mermin" />
          : <EmptyState titulo="Ningún pedido con esos filtros" texto="Quita algún filtro para ver más pedidos." />
      ) : (
        <>
          <div className={`${s.tablaCaja} vidrio vidrio-opaco`}>
            <table className={s.tabla}>
              <caption className="sr-only">Pedidos ordenados por prioridad. Usa las flechas para moverte y Enter para ver el detalle.</caption>
              <thead>
                <tr>
                  <th scope="col">Prioridad</th><th scope="col">Cliente</th><th scope="col">Tipo</th><th scope="col">Producto</th>
                  <th scope="col" className={s.num}>Cant.</th><th scope="col" className={s.num}>Monto</th><th scope="col" className={s.num}>Ganancia est.</th>
                  <th scope="col">Entrega</th><th scope="col">Faltan</th><th scope="col">Canal</th><th scope="col">Estado</th><th scope="col"><span className="sr-only">Acción</span></th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((p) => (
                  <tr key={p.id} tabIndex={0} onClick={() => abrir(p.id)} onKeyDown={(e) => teclaFila(e, p.id)} className={s.fila}>
                    <td data-label="Prioridad">
                      <PriorityBadge prioridad={p.prioridad} />
                      <span className={s.motivoCorto}>{p.motivo}</span>
                    </td>
                    <td data-label="Cliente">{p.cliente} {p.ejemplo && <span className="ejemplo-tag">Ejemplo</span>}</td>
                    <td data-label="Tipo">{p.tipo === 'empresa' ? 'Empresa' : 'Persona'}</td>
                    <td data-label="Producto" className={s.producto}>{p.producto}</td>
                    <td data-label="Cantidad" className={s.num}>{p.cantidad}</td>
                    <td data-label="Monto" className={s.num}>{formatoSoles(p.monto)}</td>
                    <td data-label="Ganancia est." className={s.num}>{formatoSoles(p.ganancia)}</td>
                    <td data-label="Entrega">{formatoFecha(p.fecha_entrega)}</td>
                    <td data-label="Faltan" className={p.dias !== null && p.dias >= 0 && p.dias <= config.reglas.dias_fecha_cercana ? s.cerca : ''}>{textoDias(p.dias)}</td>
                    <td data-label="Canal">{p.canal}</td>
                    <td data-label="Estado"><EstadoBadge estado={p.estado} /></td>
                    <td><span className="btn btn-chico" aria-hidden="true">Ver</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {paginas > 1 && (
            <nav className={s.paginacion} aria-label="Páginas">
              <button className="btn btn-chico" disabled={paginaActual === 0} onClick={() => setPagina(paginaActual - 1)}><ChevronLeft size={14} aria-hidden="true" /> Anterior</button>
              <span>Página {paginaActual + 1} de {paginas}</span>
              <button className="btn btn-chico" disabled={paginaActual >= paginas - 1} onClick={() => setPagina(paginaActual + 1)}>Siguiente <ChevronRight size={14} aria-hidden="true" /></button>
            </nav>
          )}
        </>
      )}

      {idAbierto && abierto && <OrderDetail pedido={abierto} cerrar={cerrar} />}
      {idAbierto && !abierto && !cargandoPedidos && (
        <p className="muted">No encontré ese pedido. <Link to="/app/pedidos">Ver todos</Link></p>
      )}
    </div>
  );
}

function Selector({ etiqueta, valor, onChange, opciones }) {
  return (
    <label className={s.selector}>
      <span className="sr-only">{etiqueta}</span>
      <select className="input" value={valor} onChange={(e) => onChange(e.target.value)}>
        <option value="">{etiqueta}: todos</option>
        {opciones.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </label>
  );
}
