import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePsychosocialAssessmentCycleDto } from './dto';

describe('B3 psychosocial privacy boundary', () => {
  it('rejects individual response fields at the DTO boundary', async () => {
    const dto = plainToInstance(CreatePsychosocialAssessmentCycleDto, {
      instrumentName: 'Cuestionario declarado',
      instrumentSourceType: 'OTHER_DECLARED',
      workerId: '00000000-0000-4000-8000-000000000001',
      answers: { question1: 'Nunca' },
      individualScore: 4,
      diagnosis: 'no debe registrarse',
    });

    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['workerId', 'answers', 'individualScore', 'diagnosis']),
    );
  });

  it('keeps the cycle response aggregate-only', () => {
    const aggregateCycle = {
      instrumentName: 'Cuestionario declarado',
      instrumentSourceType: 'OTHER_DECLARED',
      targetPopulationCount: 20,
      participantCount: 18,
      aggregateReportAvailable: true,
      aggregateReportUrl: 'https://example.test/report.pdf',
    };
    const serialized = JSON.stringify(aggregateCycle);
    for (const prohibited of [
      'workerId',
      'answers',
      'individualScore',
      'scoreByWorker',
      'diagnosis',
    ])
      expect(serialized).not.toContain(prohibited);
  });
});
