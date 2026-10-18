import { useEffect, useRef, useState } from 'react';
import { X, Check, Share2 } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import PriorityBadge, { EstadoBadge } from './PriorityBadge.jsx';
import { formatoFecha, formatoSoles, textoDias } from '../lib/format.js';
import s from './OrderDetail.module.css';

export default function OrderDetail({ pedido, cerrar }) {
  const { actualizarPedido, toast } = useApp();
  const [guardando, setGuardando] = useState(false);
  const panel = useRef(null);

  useEffect(() => {
    panel.current?.querySelector('button')?.focus();
    const esc = (e) => e.key === 'Escape' && cerrar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [cerrar]);

  if (!pedido) return null;
  const editable = pedido.origen === 'mermin';

  const cambiar = async (estado, mensaje) => {
    setGuardando(true);
    try {
      await actualizarPedido(pedido.id, { estado });
      toast({ titulo: mensaje, tono: estado === 'derivado' ? 'coral' : undefined });
    } catch (e) {
      toast({ titulo: 'No se pudo guardar', texto: e.message, tono: 'coral' });
    } finally {
      setGuardando(false);
    }
  };

  const filas = [
    ['Cliente', pedido.cliente],
    ['Tipo', pedido.tipo === 'empresa' ? 'Empresa' : 'Persona'],
    ['Ocasión', pedido.ocasion],
    ['Cantidad', `${pedido.cantidad} u.`],
    ['Monto', formatoSoles(pedido.monto)],
    ['Ganancia estimada', formatoSoles(pedido.ganancia)],
    ['Entrega', `${formatoFecha(pedido.fecha_entrega)} · ${textoDias(pedido.dias)}`],
    ['Canal', pedido.canal],
    ['Origen', pedido.origen === 'mermin' ? 'Mermín' : 'Histórico (anonimizado)'],
  ].filter(([, v]) => v);

  return (
    <div className={s.fondo} onClick={cerrar}>
      <aside ref={panel} className={`${s.panel} vidrio vidrio-opaco`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="detalle-titulo">
        <div className={s.cabeza}>
          <div>
            <small className="muted">{pedido.id} {pedido.ejemplo && <span className="ejemplo-tag">Ejemplo</span>}</small>
            <h2 id="detalle-titulo">{pedido.producto}</h2>
          </div>
          <button className="btn btn-icono" onClick={cerrar} aria-label="Cerrar detalle"><X size={18} /></button>
        </div>

        <div className={s.motivo}>
          <PriorityBadge prioridad={pedido.prioridad} />
          <p><strong>¿Por qué?</strong> {pedido.motivo}</p>
        </div>

        <dl className={s.datos}>
          {filas.map(([k, v]) => (
            <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
          ))}
          <div><dt>Estado</dt><dd><EstadoBadge estado={pedido.estado} /></dd></div>
        </dl>

        {pedido.productos?.length > 0 && (
          <section>
            <h3>Productos</h3>
            <ul className={s.productos}>
              {pedido.productos.map((p) => (
                <li key={p.producto_id || p.nombre}>
                  <span>{p.cantidad} × {p.nombre}</span>
                  <span>{formatoSoles(p.cantidad * p.precio_unitario)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3>Personalización</h3>
          <p>{pedido.personalizacion ? (editable ? pedido.personalizacion : 'Sí, con grabado (el texto no se guarda en el histórico)') : 'No'}</p>
        </section>

        {pedido.resumen && (
          <section>
            <h3>Resumen de la conversación</h3>
            <p>{pedido.resumen}</p>
          </section>
        )}

        <div className={s.acciones}>
          {editable ? (
            <>
              <button className="btn btn-primario" disabled={guardando || pedido.estado_api === 'confirmado'} onClick={() => cambiar('confirmado', 'Pedido confirmado')}>
                <Check size={16} aria-hidden="true" /> {pedido.estado_api === 'confirmado' ? 'Confirmado' : 'Confirmar'}
              </button>
              <button className="btn" disabled={guardando || pedido.estado_api === 'derivado'} onClick={() => cambiar('derivado', 'Marcado como derivado')}>
                <Share2 size={16} aria-hidden="true" /> Marcar como derivado
              </button>
            </>
          ) : (
            <p className="muted">Este pedido viene del histórico: solo se puede consultar.</p>
          )}
        </div>
      </aside>
    </div>
  );
}
