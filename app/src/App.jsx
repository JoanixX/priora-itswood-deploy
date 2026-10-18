import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppProvider } from './context/AppContext.jsx';
import Layout from './components/Layout.jsx';
import RequiereSesion from './components/RequiereSesion.jsx';
import IrALanding from './components/IrALanding.jsx';

const Login = lazy(() => import('./pages/Login.jsx'));
const Inicio = lazy(() => import('./pages/Inicio.jsx'));
const Pedidos = lazy(() => import('./pages/Pedidos.jsx'));
const Mermin = lazy(() => import('./pages/Mermin.jsx'));
const Fidelizacion = lazy(() => import('./pages/Fidelizacion.jsx'));
const Catalogo = lazy(() => import('./pages/Catalogo.jsx'));
const Datos = lazy(() => import('./pages/Datos.jsx'));
const Ajustes = lazy(() => import('./pages/Ajustes.jsx'));

// El AppProvider (que carga pedidos y avisos) va dentro de RequiereSesion: no llama al backend antes del login.
const Panel = () => (
  <RequiereSesion>
    <AppProvider>
      <Layout />
    </AppProvider>
  </RequiereSesion>
);

export default function App() {
  return (
    <Suspense fallback={<p className="muted" style={{ padding: '2rem' }}>Cargando…</p>}>
      <Routes>
        {/* La entrada es la landing (VITE_LANDING_URL); el login solo se abre desde su botón "Iniciar sesión". */}
        <Route path="/" element={<IrALanding />} />
        <Route path="/login" element={<Login />} />
        <Route path="/app" element={<Panel />}>
          <Route index element={<Inicio />} />
          <Route path="pedidos" element={<Pedidos />} />
          <Route path="mermin" element={<Mermin />} />
          <Route path="fidelizacion" element={<Fidelizacion />} />
          <Route path="catalogo" element={<Catalogo />} />
          <Route path="datos" element={<Datos />} />
          <Route path="ajustes" element={<Ajustes />} />
        </Route>
        <Route path="*" element={<IrALanding />} />
      </Routes>
    </Suspense>
  );
}
