import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ADAPTIVE_LIMITS } from '@sst/contracts';
import { CreateAdaptiveSessionDto, SubmitAdaptiveAnswersDto } from './dto';

const uuid = (index: number) => `00000000-0000-4000-8000-${index.toString().padStart(12, '0')}`;

describe('adaptive request structural limits', () => {
  it('accepts the work-center boundary and rejects one above it', async () => {
    const build = (count: number) =>
      plainToInstance(CreateAdaptiveSessionDto, {
        profileVersionId: uuid(1),
        rulePackVersionId: uuid(2),
        workCenterIds: Array.from({ length: count }, (_, index) => uuid(index + 10)),
      });
    expect(await validate(build(ADAPTIVE_LIMITS.workCentersPerSession))).toHaveLength(0);
    expect(await validate(build(ADAPTIVE_LIMITS.workCentersPerSession + 1))).not.toHaveLength(0);
  });

  it('accepts the answer boundary and rejects one above it', async () => {
    const build = (count: number) =>
      plainToInstance(SubmitAdaptiveAnswersDto, {
        expectedSessionRevision: 0,
        answers: Array.from({ length: count }, (_, index) => ({
          scopeId: uuid(index + 10),
          factVersionId: uuid(index + 200),
          value: false,
        })),
      });
    expect(await validate(build(ADAPTIVE_LIMITS.answersPerRequest))).toHaveLength(0);
    expect(await validate(build(ADAPTIVE_LIMITS.answersPerRequest + 1))).not.toHaveLength(0);
  });
});
