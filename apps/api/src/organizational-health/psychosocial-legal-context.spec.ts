import { resolvePsychosocialLegalContext } from './psychosocial-legal-context';

describe('psychosocial legal context', () => {
  it('requires Ecuador context before showing Art. 19', () => {
    expect(resolvePsychosocialLegalContext({ country: 'Ecuador' }).status).toBe('CONTEXT_REQUIRED');
    expect(
      resolvePsychosocialLegalContext({ country: 'Ecuador', totalWorkerCount: 11, sourceAvailable: true }),
    ).toMatchObject({ status: 'VERIFIED_CONTEXT', totalWorkerCount: 11 });
  });

  it('does not show Art. 19 for Ecuador organizations with 1 to 10 workers', () => {
    expect(
      resolvePsychosocialLegalContext({ country: 'EC', totalWorkerCount: 10, sourceAvailable: true }),
    ).toMatchObject({ status: 'NO_DIRECT_LEGAL_BASIS', totalWorkerCount: 10 });
  });

  it('never leaks an Ecuador source to Colombia or another country', () => {
    const colombia = resolvePsychosocialLegalContext({
      country: 'CO',
      totalWorkerCount: 25,
      sourceAvailable: true,
    });
    expect(colombia).toMatchObject({ status: 'JURISDICTION_NOT_SUPPORTED' });
    expect(colombia).not.toHaveProperty('source');
    const peru = resolvePsychosocialLegalContext({
      country: 'Perú',
      totalWorkerCount: 25,
      sourceAvailable: true,
    });
    expect(peru).toMatchObject({ status: 'JURISDICTION_NOT_SUPPORTED' });
    expect(peru).not.toHaveProperty('source');
  });
});
