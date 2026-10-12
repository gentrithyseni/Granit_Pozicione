import { Link } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';

export function NotFoundPage() {
  return (
    <main className="not-found-page">
      <div className="not-found-mark"><Compass size={28} /></div>
      <span className="eyebrow accent">Gabim 404</span>
      <h1>Faqja nuk u gjet</h1>
      <p className="muted">Adresa që kërkove nuk ekziston ose është zhvendosur.</p>
      <Link className="primary-button not-found-action" to="/">
        <ArrowLeft size={16} /> Kthehu në ballinë
      </Link>
    </main>
  );
}