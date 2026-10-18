import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';

const LANDING = (import.meta.env.VITE_LANDING_URL || '').replace(/\/+$/, '');
export const hayLanding = /^https?:\/\//.test(LANDING);

/**
 * La puerta de entrada es la landing, nunca el login: la raíz de la app, las rutas desconocidas y /app sin sesión
 * mandan a VITE_LANDING_URL, y desde ahí el botón "Iniciar sesión" lleva a /login.
 * Sin VITE_LANDING_URL (desarrollo local) no hay adónde ir y se muestra el login.
 */
export default function IrALanding() {
  useEffect(() => {
    if (hayLanding) window.location.replace(`${LANDING}/`);
  }, []);
  if (!hayLanding) return <Navigate to="/login" replace />;
  return <p className="muted" style={{ padding: '2rem' }}>Llevándote a la página principal…</p>;
}
