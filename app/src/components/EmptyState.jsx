import { Link } from 'react-router-dom';
import { Inbox } from 'lucide-react';

export default function EmptyState({ titulo, texto, accion, enlace, icono: Icono = Inbox }) {
  return (
    <div className="vidrio" style={{ padding: '2rem', textAlign: 'center', display: 'grid', justifyItems: 'center', gap: '.5rem' }}>
      <Icono size={28} aria-hidden="true" color="var(--taupe-oscuro)" />
      {titulo && <h2>{titulo}</h2>}
      <p className="muted" style={{ maxWidth: '40ch' }}>{texto}</p>
      {accion && enlace && <Link className="btn btn-primario" to={enlace}>{accion}</Link>}
    </div>
  );
}
