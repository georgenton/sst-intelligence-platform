import { assertPublishedVersionMatches } from './adaptive-reference-integrity';

describe('adaptive immutable reference integrity', () => {
  const versionOne = {
    version: '1.0.0',
    questionText: 'Pregunta v1',
    targetTitle: 'Objetivo v1',
    ruleExpression: {
      kind: 'PREDICATE',
      factKey: 'workCenter.hasWorkAtHeight',
      operator: 'BOOLEAN_IS',
      value: true,
    },
    groupMembership: ['RULE_A', 'RULE_B'],
    packMembership: {
      facts: ['FACT_V1'],
      targets: ['TARGET_V1'],
      rules: ['RULE_V1'],
      groups: ['GROUP_V1'],
    },
  };

  it('accepts exact repeated content and an explicit distinct version', () => {
    expect(() =>
      assertPublishedVersionMatches('REFERENCE:1.0.0', versionOne, structuredClone(versionOne)),
    ).not.toThrow();
    const versionTwo = { ...structuredClone(versionOne), version: '2.0.0' };
    expect(() =>
      assertPublishedVersionMatches('REFERENCE:2.0.0', versionTwo, structuredClone(versionTwo)),
    ).not.toThrow();
  });

  it.each([
    ['questionText', (value: typeof versionOne) => (value.questionText = 'Pregunta alterada')],
    ['target title', (value: typeof versionOne) => (value.targetTitle = 'Objetivo alterado')],
    ['rule expression', (value: typeof versionOne) => (value.ruleExpression.value = false)],
    ['group membership', (value: typeof versionOne) => value.groupMembership.push('RULE_C')],
    ['pack membership', (value: typeof versionOne) => value.packMembership.facts.push('FACT_V2')],
  ])('rejects same-version %s drift', (_label, mutate) => {
    const drifted = structuredClone(versionOne);
    mutate(drifted);
    expect(() => assertPublishedVersionMatches('REFERENCE:1.0.0', versionOne, drifted)).toThrow(
      'PUBLISHED_VERSION_DRIFT:REFERENCE:1.0.0',
    );
  });
});
