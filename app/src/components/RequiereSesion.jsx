import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { puedeEntrar } from '../services/auth.js';
import { alCerrarSesion } from '../services/sesion.js';
import IrALanding from './IrALanding.jsx';

/**
 * Protege /app/*. Sin sesión (o al cerrar sesión) vuelve a la landing: el login nunca es la primera página, se abre
 * desde el botón "Iniciar sesión" de la landing. Solo si la sesión venció estando dentro, va directo a /login y
 * después regresa a la misma página.
 */
export default function RequiereSesion({ children }) {
  const { pathname, search } = useLocation();
  const [estado, setEstado] = useState('revisando');

  useEffect(() => {
    let vivo = true;
    puedeEntrar().then((ok) => vivo && setEstado(ok ? 'ok' : 'sin_sesion'));
    const quitar = alCerrarSesion((motivo) => setEstado(motivo === 'vencida' ? 'vencida' : 'sin_sesion'));
    return () => { vivo = false; quitar(); };
  }, []);

  if (estado === 'revisando') return <p className="muted" style={{ padding: '2rem' }}>Cargando…</p>;
  if (estado === 'vencida') {
    const volver = encodeURIComponent(`${pathname}${search}`);
    return <Navigate to={`/login?volver=${volver}&vencida=1`} replace />;
  }
  if (estado !== 'ok') return <IrALanding />;
  return children;
}
