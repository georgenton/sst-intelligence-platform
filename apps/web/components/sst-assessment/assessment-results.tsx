import type { SstAssessmentResult } from '@sst/contracts';
import Link from 'next/link';
import {
  groupAssessmentResults,
  resultStateLabel,
  safeResultExplanation,
  assessmentFactLabel,
  assessmentTechnicalDetailsPolicy,
} from '@/lib/sst-assessment-presentation';
import { sstAssessmentClaimReturnPath } from '@/lib/auth-return-path';

export function AssessmentResults({
  result,
  sessionId,
  channel,
  continuation,
  onReassess,
}: {
  result: SstAssessmentResult;
  sessionId: string;
  channel: 'PUBLIC' | 'AUTHENTICATED';
  continuation?: 'public' | 'authenticated';
  onReassess?: () => void;
}) {
  const claimPath = sstAssessmentClaimReturnPath(sessionId);
  const technicalDetails = assessmentTechnicalDetailsPolicy(channel);
  return (
    <section className="assessment-results" aria-labelledby="assessment-results-title">
      <header>
        <p className="eyebrow">Diagnóstico ejecutivo</p>
        <h2 id="assessment-results-title">{result.summary.title}</h2>
        <p>{result.summary.disclaimer}</p>
      </header>
      {groupAssessmentResults(result.items).map((group) => (
        <section className="assessment-result-group" key={group.key}>
          <h3>{group.title}</h3>
          <div>
            {group.items.map((item) => (
              <article key={`${item.scopeKey}:${item.targetKey}`}>
                <span className="status-badge">{resultStateLabel(item)}</span>
                <h4>{item.title}</h4>
                <p>{safeResultExplanation(item)}</p>
                <p>
                  <strong>Siguiente paso:</strong> revisa este criterio con el responsable SST antes
                  de tomar una decisión.
                </p>
                <details>
                  <summary>Ver fundamento profesional</summary>
                  <dl>
                    <div>
                      <dt>Alcance</dt>
                      <dd>{item.scopeKey === 'organization' ? 'Empresa' : 'Centro de trabajo'}</dd>
                    </div>
                    <div>
                      <dt>Autoridad</dt>
                      <dd>
                        {item.authority === 'DEMO'
                          ? 'Criterio demostrativo'
                          : item.authority === 'CANDIDATE'
                            ? 'Criterio regulatorio en revisión'
                            : 'Criterio publicado'}
                      </dd>
                    </div>
                    <div>
                      <dt>Revisión</dt>
                      <dd>
                        {item.professionalReviewRequired
                          ? 'Revisión profesional requerida'
                          : 'Revisión recomendada'}
                      </dd>
                    </div>
                    {item.missingFactKeys.length ? (
                      <div>
                        <dt>Información pendiente</dt>
                        <dd>{item.missingFactKeys.map(assessmentFactLabel).join('; ')}</dd>
                      </div>
                    ) : null}
                  </dl>
                </details>
                {technicalDetails.available ? (
                  <details className="assessment-technical-details">
                    <summary>Detalles técnicos</summary>
                    <p>Clave de resultado: {item.targetKey}</p>
                    <p>Reglas: {item.ruleKeys.join(', ') || 'Sin reglas expuestas'}</p>
                  </details>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ))}
      <div className="assessment-completion">
        <h3>Diagnóstico listo</h3>
        <p>
          El siguiente paso será configurar tu espacio. Todavía no activamos módulos ni generamos un
          plan de trabajo.
        </p>
        {channel === 'PUBLIC' && continuation === 'public' ? (
          <div className="assessment-actions">
            <Link className="button" href={`/auth/register?next=${encodeURIComponent(claimPath)}`}>
              Crear cuenta y continuar
            </Link>
            <Link
              className="button secondary"
              href={`/auth/login?next=${encodeURIComponent(claimPath)}`}
            >
              Iniciar sesión
            </Link>
          </div>
        ) : channel === 'PUBLIC' ? (
          <Link className="button" href={claimPath}>
            Guardar este diagnóstico en mi empresa
          </Link>
        ) : onReassess ? (
          <button className="button secondary" type="button" onClick={onReassess}>
            Reevaluar empresa
          </button>
        ) : null}
      </div>
    </section>
  );
}
