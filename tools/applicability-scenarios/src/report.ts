import type { ScenarioValidationReport } from './validation.js';

function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function escapeCell(value: string): string {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ');
}

export function renderScenarioReportMarkdown(report: ScenarioValidationReport): string {
  const lines: string[] = [
    '# Adaptive SST Scenario Validation Report',
    '',
    `> ${report.legalBoundary}`,
    '',
    '## Engine identity',
    '',
    `- Key: \`${report.engine.key}\``,
    `- Version: \`${report.engine.version}\``,
    `- Source: \`${report.engine.sourceType}\``,
    `- Demo: \`${String(report.engine.isDemo)}\``,
    `- Regulatory: \`${String(report.engine.regulatory)}\``,
    `- Disclaimer: ${report.engine.disclaimer}`,
    '',
    '## Summary',
    '',
    `- Scenarios: ${report.scenarioCount}`,
    `- Engine expectations: ${report.expectationParity ? 'PASS' : 'FAIL'}`,
    `- Deterministic repeat: ${report.deterministicRepeat ? 'PASS' : 'FAIL'}`,
    `- Forward/reverse order: ${report.forwardReverseOrderStable ? 'PASS' : 'FAIL'}`,
    `- Six states: ${report.coveredStates.join(', ')}`,
    `- Predicate results: ${report.coveredPredicateResults.join(', ')}`,
    '',
    '## Scenario coverage matrix',
    '',
    '| Scenario | Profile fields used | TRUE | FALSE | MISSING | Decision states | Unmodeled variables | Expert status |',
    '| --- | --- | ---: | ---: | ---: | --- | --- | --- |',
  ];

  for (const outcome of report.outcomes) {
    const profile = outcome.scenario.profileV1Input;
    const profileFields = [
      'country',
      ...(profile.organization.sector === undefined ? [] : ['sector']),
      'workCenterCount',
      ...(profile.organization.workerCount === undefined ? [] : ['workerCount']),
      ...(profile.operations.hasChemicalProcesses === undefined ? [] : ['hasChemicalProcesses']),
      ...(profile.operations.hasHighEnergyOperations === undefined
        ? []
        : ['hasHighEnergyOperations']),
    ];
    const predicateCounts = { TRUE: 0, FALSE: 0, MISSING: 0 };
    for (const decision of outcome.actualEvaluation.decisions) {
      for (const trace of decision.trace) {
        for (const predicate of trace.predicates) predicateCounts[predicate.result] += 1;
      }
    }
    lines.push(
      `| ${outcome.scenario.id} | ${profileFields.join(', ')} | ${predicateCounts.TRUE} | ${predicateCounts.FALSE} | ${predicateCounts.MISSING} | ${outcome.stateCoverage.join(', ')} | ${outcome.scenario.futureContextNotEvaluated.join(', ')} | ${outcome.scenario.expertValidation.status} |`,
    );
  }

  lines.push('', '## Profile V2 discovery', '');
  for (const discovery of report.profileV2Discovery) {
    lines.push(`- ${discovery.field}: ${discovery.scenarioCount} scenario(s)`);
  }

  for (const outcome of report.outcomes) {
    lines.push(
      '',
      `## ${outcome.scenario.id}`,
      '',
      outcome.scenario.description,
      '',
      `- Synthetic: \`${String(outcome.scenario.synthetic)}\``,
      `- Scenario version: \`${outcome.scenario.scenarioVersion}\``,
      `- Match: ${outcome.expectationMatches ? 'PASS' : 'FAIL'}`,
      `- Expert status: \`${outcome.scenario.expertValidation.status}\``,
      `- Future context: \`${outcome.futureContextStatus}\``,
      '',
      '### ENGINE_INPUT_V1',
      '',
      '```json',
      json(outcome.scenario.profileV1Input),
      '```',
      '',
      '### FUTURE_CONTEXT_NOT_EVALUATED',
      '',
      ...outcome.scenario.futureContextNotEvaluated.map((field) => `- ${field}`),
      '',
      'Work-center detail collapsed by Profile V1:',
      '',
      '```json',
      json(outcome.scenario.workCenters),
      '```',
      '',
      '### Expected and actual decisions',
      '',
      '| Target | Expected | Actual | Winning rule |',
      '| --- | --- | --- | --- |',
    );
    for (const actual of outcome.actualDecisionSummary) {
      const expected = outcome.expectedDecisions.find(
        ({ targetKey }) => targetKey === actual.targetKey,
      );
      lines.push(
        `| ${actual.targetKey} | ${expected?.state ?? 'MISSING_EXPECTATION'} | ${actual.state} | ${actual.winningRuleId ?? 'none'} |`,
      );
    }
    lines.push('', '### Relevant trace', '');
    for (const decision of outcome.actualEvaluation.decisions) {
      lines.push(`- **${decision.targetKey}** → ${decision.state}`);
      for (const trace of decision.trace) {
        const predicates = trace.predicates
          .map(
            (predicate) =>
              `${predicate.field} ${predicate.operator}: ${String(predicate.actual)} → ${predicate.result}`,
          )
          .join('; ');
        lines.push(
          `  - ${trace.ruleId}: ${trace.result}; contributes ${trace.contributedState ?? 'none'}; ${escapeCell(predicates)}`,
        );
      }
    }
    lines.push('', '### Missing profile information', '');
    lines.push(
      outcome.missingProfileInformation.length > 0
        ? outcome.missingProfileInformation.map((field) => `- ${field}`).join('\n')
        : '- None',
    );
    lines.push('', '### Questions for expert validation', '');
    lines.push(...outcome.scenario.expertValidation.questions.map((question) => `- ${question}`));
  }

  lines.push('', `## Final result: ${report.overallPass ? 'PASS' : 'FAIL'}`, '');
  return lines.join('\n');
}

export function renderTerminalSummary(report: ScenarioValidationReport): string {
  return [
    `Adaptive SST scenario validation: ${report.overallPass ? 'PASS' : 'FAIL'}`,
    `Engine: ${report.engine.key}@${report.engine.version}`,
    `Scenarios: ${report.scenarioCount}`,
    `States: ${report.coveredStates.join(', ')}`,
    `Trace results: ${report.coveredPredicateResults.join(', ')}`,
    `Expectations: ${report.expectationParity ? 'PASS' : 'FAIL'}`,
    `Determinism: ${report.deterministicRepeat ? 'PASS' : 'FAIL'}`,
    `Forward/reverse: ${report.forwardReverseOrderStable ? 'PASS' : 'FAIL'}`,
    `Expert review: ${report.allExpertStatusesPending ? 'PENDING' : 'MIXED'}`,
  ].join('\n');
}
