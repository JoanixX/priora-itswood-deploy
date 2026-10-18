import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { puedeEntrar } from '../services/auth.js';
import { alCerrarSesion } from '../services/sesion.js';

/** Protege /app/*: sin sesión (cuando el login está activo) lleva a /login y vuelve a la misma página después. */
export default function RequiereSesion({ children }) {
  const { pathname, search } = useLocation();
  const [estado, setEstado] = useState('revisando');

  useEffect(() => {
    let vivo = true;
    puedeEntrar().then((ok) => vivo && setEstado(ok ? 'ok' : 'login'));
    const quitar = alCerrarSesion((motivo) => setEstado(motivo === 'vencida' ? 'vencida' : 'login'));
    return () => { vivo = false; quitar(); };
  }, []);

  if (estado === 'revisando') return <p className="muted" style={{ padding: '2rem' }}>Cargando…</p>;
  if (estado !== 'ok') {
    const volver = encodeURIComponent(`${pathname}${search}`);
    return <Navigate to={`/login?volver=${volver}${estado === 'vencida' ? '&vencida=1' : ''}`} replace />;
  }
  return children;
}
