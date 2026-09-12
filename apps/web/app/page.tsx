import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero">
          <div className="container hero-grid">
            <div>
              <p className="eyebrow">SST modular y multiempresa</p>
              <h1>Convierte necesidades dispersas en una ruta clara de gestión.</h1>
              <p>
                Diagnostica tu operación, recibe recomendaciones explicables y activa un espacio de
                demostración con información sintética. Sin promesas de cumplimiento automático.
              </p>
              <Link className="button" href="/evaluacion-sst">
                Evaluar mi empresa
              </Link>
            </div>
            <aside className="hero-panel" aria-label="Principios de la plataforma">
              <p className="eyebrow">Cómo funciona</p>
              <h2>Reglas primero. IA para explicar.</h2>
              <p>
                Las reglas determinísticas calculan. La IA opcional explica. Tu equipo autorizado
                decide.
              </p>
              <div className="stack">
                <span>✓ Organizaciones aisladas</span>
                <span>✓ Módulos y límites transparentes</span>
                <span>✓ Demo conceptual identificada</span>
              </div>
            </aside>
          </div>
        </section>
      </main>
    </>
  );
}
