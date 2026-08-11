'use client';

import { apiRequest } from '@sst/api-client';
import { Button, Card } from '@sst/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SessionPersistence } from '@/components/guided';
import { SiteHeader } from '@/components/site-header';

export default function DiagnosticStartPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function start() {
    setLoading(true);
    setError('');
    try {
      const session = await apiRequest<{ id: string; resumeToken: string }>(
        '/solution-finder/sessions',
        { method: 'POST' },
      );
      SessionPersistence.save(session.id, session.resumeToken);
      router.push(`/diagnostico/${session.id}`);
    } catch {
      setError('No pudimos iniciar el diagnóstico. Intenta nuevamente.');
      setLoading(false);
    }
  }
  return (
    <>
      <SiteHeader />
      <main className="container hero">
        <Card className="stack">
          <div>
            <p className="eyebrow">Asesor de soluciones</p>
            <h1>Encuentra una ruta adecuada para tu operación.</h1>
            <p className="muted">
              Seis pasos, sin datos médicos ni información individual sensible. Puedes reanudar la
              sesión durante 30 días.
            </p>
          </div>
          <div>
            <Button onClick={start} disabled={loading}>
              {loading ? 'Creando sesión…' : 'Comenzar'}
            </Button>
          </div>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
        </Card>
      </main>
    </>
  );
}
