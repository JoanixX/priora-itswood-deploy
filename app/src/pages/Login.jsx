import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { iniciarSesion, puedeEntrar } from '../services/auth.js';
import s from './Login.module.css';

const LANDING = import.meta.env.VITE_LANDING_URL || '/';

/** Solo se vuelve a rutas de la app (nunca a otro sitio). */
const destino = (volver) => (volver && volver.startsWith('/app') ? volver : '/app');

export default function Login() {
  const [params] = useSearchParams();
  const navegar = useNavigate();
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState(params.get('vencida') ? 'Tu sesión venció. Vuelve a entrar.' : '');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    document.title = 'Entrar · Priora';
    // Si ya hay sesión (o no hace falta), directo al dashboard.
    if (!params.get('vencida')) puedeEntrar().then((ok) => ok && navegar(destino(params.get('volver')), { replace: true }));
  }, [navegar, params]);

  const entrar = async (e) => {
    e.preventDefault();
    if (!correo.trim() || !contrasena) {
      setError('Escribe tu correo y tu contraseña.');
      return;
    }
    setEnviando(true);
    setError('');
    try {
      await iniciarSesion(correo, contrasena);
      navegar(destino(params.get('volver')), { replace: true });
    } catch (ex) {
      setError(ex.status === 0 ? 'No hay conexión con el servidor. Prueba de nuevo en un minuto.' : ex.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <main className={s.fondo}>
      <form className={`${s.tarjeta} vidrio`} onSubmit={entrar} noValidate aria-labelledby="login-titulo">
        <a href={LANDING} className={s.logo} aria-label="Priora, ir a la página principal">
          <span className={s.logoMarca} aria-hidden="true" />
          <span>Priora</span>
        </a>
        <h1 id="login-titulo" className={s.titulo}>Entrar al panel</h1>
        <p className="muted">Pedidos, Mermín y clientes de tu negocio.</p>
        <label className="campo">Correo
          <input type="email" autoComplete="username" value={correo} onChange={(e) => setCorreo(e.target.value)} autoFocus required />
        </label>
        <label className="campo">Contraseña
          <input type="password" autoComplete="current-password" value={contrasena} onChange={(e) => setContrasena(e.target.value)} required />
        </label>
        {error && <p className={s.error} role="alert">{error}</p>}
        <button className="btn btn-primario" disabled={enviando}>
          <LogIn size={16} aria-hidden="true" /> {enviando ? 'Entrando…' : 'Entrar'}
        </button>
        <p className={`muted ${s.nota}`}>Cuenta de demostración del prototipo. Pídele los datos al equipo de Priora.</p>
      </form>
    </main>
  );
}
