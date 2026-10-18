import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Home, ListOrdered, MessageCircle, HeartHandshake, Package, Database, Settings, Bell, Menu, X, ArrowLeft, FlaskConical, LogOut,
} from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { sesionActual, cerrarSesion } from '../services/sesion.js';
import NotificationDrawer from './NotificationDrawer.jsx';
import Toasts from './Toasts.jsx';
import s from './Layout.module.css';

const LANDING = import.meta.env.VITE_LANDING_URL || '/';

export const NAV = [
  { to: '/app', texto: 'Inicio', icono: Home, fin: true },
  { to: '/app/pedidos', texto: 'Pedidos', icono: ListOrdered },
  { to: '/app/mermin', texto: 'Mermín', icono: MessageCircle },
  { to: '/app/fidelizacion', texto: 'Fidelización', icono: HeartHandshake },
  { to: '/app/catalogo', texto: 'Catálogo', icono: Package },
  { to: '/app/datos', texto: 'Datos', icono: Database },
  { to: '/app/ajustes', texto: 'Ajustes', icono: Settings },
];

function Logo() {
  return (
    <a href={LANDING} className={s.logo} aria-label="Priora, ir a la página principal">
      <span className={s.logoMarca} aria-hidden="true" />
      <span>Priora</span>
    </a>
  );
}

function Navegacion({ alNavegar }) {
  const { config } = useApp();
  return (
    <nav className={s.nav} aria-label="Menú principal">
      <div className={s.marca}>
        <Logo />
        <span className={s.negocio}>{config.negocio}</span>
      </div>
      <ul>
        {NAV.map(({ to, texto, icono: Icono, fin }) => (
          <li key={to}>
            <NavLink to={to} end={fin} onClick={alNavegar} className={({ isActive }) => `${s.enlace} ${isActive ? s.activo : ''}`}>
              <Icono size={18} aria-hidden="true" />
              {to === '/app/mermin' ? config.asistente : texto}
            </NavLink>
          </li>
        ))}
      </ul>
      <a href={LANDING} className={s.volver}>
        <ArrowLeft size={14} aria-hidden="true" /> Volver a Priora
      </a>
    </nav>
  );
}

export default function Layout() {
  const { modoEjemplo, notificaciones } = useApp();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [avisosAbiertos, setAvisosAbiertos] = useState(false);
  const { pathname } = useLocation();
  // Solo hay sesión cuando el login está activo; sin login (como antes) no se muestra el botón.
  const sesion = sesionActual();
  const noLeidas = notificaciones.filter((n) => !n.leida).length;
  const actual = [...NAV].reverse().find((n) => pathname.startsWith(n.to));

  useEffect(() => {
    document.title = `${actual?.texto || 'Inicio'} · Priora`;
  }, [actual]);

  useEffect(() => {
    if (!menuAbierto) return undefined;
    const esc = (e) => e.key === 'Escape' && setMenuAbierto(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [menuAbierto]);

  return (
    <div className={s.shell}>
      <a href="#contenido" className={s.saltar}>Saltar al contenido</a>
      <aside className={`${s.lateral} vidrio`}>
        <Navegacion />
      </aside>

      {menuAbierto && (
        <div className={s.cajonFondo} onClick={() => setMenuAbierto(false)}>
          <div className={`${s.cajon} vidrio vidrio-opaco`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Menú">
            <button className="btn btn-icono" onClick={() => setMenuAbierto(false)} aria-label="Cerrar menú" autoFocus>
              <X size={18} />
            </button>
            <Navegacion alNavegar={() => setMenuAbierto(false)} />
          </div>
        </div>
      )}

      <div className={s.columna}>
        <header className={`${s.barra} vidrio`}>
          <button className={`btn btn-icono ${s.hamburguesa}`} onClick={() => setMenuAbierto(true)} aria-label="Abrir menú">
            <Menu size={18} />
          </button>
          <span className={s.titulo}>{actual?.texto === 'Mermín' ? 'Asistente' : actual?.texto}</span>
          <div className={s.acciones}>
            {modoEjemplo && (
              <span className={s.modo} title="No hay conexión con el servidor: se muestran datos de ejemplo y datos reales anonimizados.">
                <FlaskConical size={14} aria-hidden="true" /> Modo ejemplo
              </span>
            )}
            <button className={`btn btn-icono ${s.campana}`} onClick={() => setAvisosAbiertos(true)} aria-label={`Notificaciones, ${noLeidas} sin leer`}>
              <Bell size={18} />
              {noLeidas > 0 && <span className={s.contador} aria-hidden="true">{noLeidas}</span>}
            </button>
            {sesion && (
              <button className="btn btn-chico" onClick={() => cerrarSesion('salir')} aria-label={`Cerrar sesión de ${sesion.correo}`}>
                <LogOut size={14} aria-hidden="true" /> Cerrar sesión
              </button>
            )}
          </div>
        </header>
        <main id="contenido" className={s.main} tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      <NotificationDrawer abierto={avisosAbiertos} cerrar={() => setAvisosAbiertos(false)} />
      <Toasts />
    </div>
  );
}
