import {
  isDemoActive,
  isModuleAccessActive,
  isWorkPermitsDemoPreviewActive,
  parseEntitlement,
  roleAllows,
} from './entitlement';

describe('entitlement rules', () => {
  it('parses persisted values without guessing arbitrary strings', () => {
    expect(parseEntitlement('true')).toBe(true);
    expect(parseEntitlement('12')).toBe(12);
    expect(parseEntitlement('custom')).toBe('custom');
  });

  it('expires demos at the boundary', () => {
    const now = new Date('2026-08-11T12:00:00.000Z');
    expect(isDemoActive(new Date('2026-08-11T12:00:01.000Z'), now)).toBe(true);
    expect(isDemoActive(new Date('2026-08-11T12:00:00.000Z'), now)).toBe(false);
  });

  it('expires trial and demo modules while allowing unbounded active modules', () => {
    const now = new Date('2026-08-11T12:00:00.000Z');
    const past = new Date('2026-08-11T11:59:59.000Z');
    const future = new Date('2026-08-11T12:00:01.000Z');
    expect(isModuleAccessActive('TRIAL', past, now)).toBe(false);
    expect(isModuleAccessActive('DEMO', future, now)).toBe(true);
    expect(isModuleAccessActive('ACTIVE', null, now)).toBe(true);
    expect(isModuleAccessActive('ACTIVE', past, now)).toBe(false);
  });

  it('limits the Work Permits preview to an unexpired DEMO organization', () => {
    const now = new Date('2026-08-27T12:00:00.000Z');
    const future = new Date('2026-08-28T12:00:00.000Z');
    const past = new Date('2026-08-26T12:00:00.000Z');

    expect(isWorkPermitsDemoPreviewActive('DEMO', future, now)).toBe(true);
    expect(isWorkPermitsDemoPreviewActive('DEMO', past, now)).toBe(false);
    expect(isWorkPermitsDemoPreviewActive('ACTIVE', future, now)).toBe(false);
    expect(isWorkPermitsDemoPreviewActive('DEMO', null, now)).toBe(false);
  });

  it('keeps role checks organization-specific and explicit', () => {
    expect(roleAllows('ORG_ADMIN', ['ORG_OWNER', 'ORG_ADMIN'])).toBe(true);
    expect(roleAllows('VIEWER', ['ORG_OWNER', 'ORG_ADMIN'])).toBe(false);
  });
});
