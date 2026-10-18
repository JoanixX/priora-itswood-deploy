import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, AlertTriangle, Star, BarChart3, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { tituloNotificacion } from '../lib/notificaciones.js';
import s from './NotificationDrawer.module.css';

const ICONOS = { pedido_alta: Star, pedido: Star, pedido_derivado: AlertTriangle, resumen_diario: BarChart3, sync: RefreshCw };

function hace(iso) {
  const min = Math.round((Date.now() - new Date(iso)) / 60000);
  if (min < 1) return 'Ahora';
  if (min < 60) return `Hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `Hace ${h} h` : `Hace ${Math.round(h / 24)} d`;
}

export default function NotificationDrawer({ abierto, cerrar }) {
  const { notificaciones, marcarLeida } = useApp();
  const navegar = useNavigate();
  const panel = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;
    panel.current?.querySelector('button')?.focus();
    const esc = (e) => e.key === 'Escape' && cerrar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [abierto, cerrar]);

  if (!abierto) return null;

  const abrir = (n) => {
    marcarLeida(n.id);
    cerrar();
    navegar(n.enlace || '/app');
  };

  return (
    <div className={s.fondo} onClick={cerrar}>
      <aside ref={panel} className={`${s.panel} vidrio vidrio-opaco`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Notificaciones">
        <div className={s.cabeza}>
          <h2>Notificaciones</h2>
          {notificaciones.some((n) => !n.leida) && (
            <button className="btn btn-chico" onClick={() => notificaciones.filter((n) => !n.leida).forEach((n) => marcarLeida(n.id))}>Marcar todo como leído</button>
          )}
          <button className="btn btn-icono" onClick={cerrar} aria-label="Cerrar notificaciones"><X size={18} /></button>
        </div>
        {notificaciones.length === 0 && <p className="muted">No tienes avisos. Cuando entre un pedido importante, te avisamos aquí.</p>}
        <ul className={s.lista}>
          {notificaciones.map((n) => {
            const Icono = ICONOS[n.tipo] || Star;
            return (
              <li key={n.id}>
                <button className={`${s.aviso} ${n.leida ? '' : s.nueva} ${n.tipo === 'pedido_derivado' ? s.derivado : ''}`} onClick={() => abrir(n)}>
                  <Icono size={18} aria-hidden="true" className={s.icono} />
                  <span className={s.texto}>
                    <strong>{tituloNotificacion(n)}</strong>
                    {n.titulo && <span>{n.texto}</span>}
                    <small>{hace(n.creado_en)}{!n.leida && ' · sin leer'}</small>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>
    </div>
  );
}
