import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import s from './Toasts.module.css';

export default function Toasts() {
  const { toasts, cerrarToast } = useApp();
  const navegar = useNavigate();
  return (
    <div className={s.zona} role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`${s.toast} ${s[t.tono] || ''} vidrio vidrio-opaco`}>
          <div className={s.cuerpo}>
            <strong>{t.titulo}</strong>
            {t.texto && <span>{t.texto}</span>}
            {t.enlace && (
              <button className="btn btn-chico btn-primario" onClick={() => { cerrarToast(t.id); navegar(t.enlace); }}>
                {t.accion || 'Ver pedido'}
              </button>
            )}
          </div>
          <button className="btn btn-icono" onClick={() => cerrarToast(t.id)} aria-label="Cerrar aviso"><X size={14} /></button>
        </div>
      ))}
    </div>
  );
}
