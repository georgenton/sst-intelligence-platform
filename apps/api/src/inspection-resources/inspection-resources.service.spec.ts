import { ServiceUnavailableException } from '@nestjs/common';
import {
  INSPECTION_DRAFTING_MAX_OFFICIAL_TEXT_CHARACTERS,
  INSPECTION_DRAFTING_MAX_UNIT_CHARACTERS,
  InspectionResourcesService,
  selectBoundedOfficialContext,
} from './inspection-resources.service';

describe('inspection official drafting context', () => {
  const unit = (id: string, officialText: string) => ({ id, officialText });

  it('keeps complete units in deterministic order and stops before the total limit', () => {
    const first = unit('unit-a', 'A'.repeat(INSPECTION_DRAFTING_MAX_UNIT_CHARACTERS));
    const second = unit('unit-b', 'B'.repeat(INSPECTION_DRAFTING_MAX_UNIT_CHARACTERS));
    const excluded = unit('unit-c', 'C');

    expect(selectBoundedOfficialContext([first, second, excluded])).toEqual([first, second]);
    expect(first.officialText).toHaveLength(INSPECTION_DRAFTING_MAX_UNIT_CHARACTERS);
    expect(second.officialText).toHaveLength(INSPECTION_DRAFTING_MAX_UNIT_CHARACTERS);
    expect(INSPECTION_DRAFTING_MAX_OFFICIAL_TEXT_CHARACTERS).toBe(
      INSPECTION_DRAFTING_MAX_UNIT_CHARACTERS * 2,
    );
  });

  it('rejects an oversized official unit instead of silently truncating it', () => {
    expect(() =>
      selectBoundedOfficialContext([
        unit('oversized', 'X'.repeat(INSPECTION_DRAFTING_MAX_UNIT_CHARACTERS + 1)),
      ]),
    ).toThrow(ServiceUnavailableException);
  });

  it('does not persist a proposal when the provider times out', async () => {
    const resourceFindFirst = jest.fn().mockResolvedValue({
      id: '71200000-0000-4000-8000-000000000001',
      name: 'Tomacorriente',
      level: 'MINOR',
    });
    const proposalCreate = jest.fn();
    const service = new InspectionResourcesService(
      {
        inspectionResource: {
          findFirst: resourceFindFirst,
        },
        regulatoryUnit: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: '74000000-0000-4000-8000-000000000001',
              identifier: 'ART-1',
              locator: 'Art. 1',
              heading: 'Seguridad eléctrica',
              officialText: 'Texto oficial verificado.',
              sourceVersionId: '74000000-0000-4000-8000-000000000003',
              sourceVersion: { sourceId: '74000000-0000-4000-8000-000000000002' },
            },
          ]),
        },
        inspectionDraftProposal: { create: proposalCreate },
      } as never,
      { propose: jest.fn().mockRejectedValue(new Error('OPENAI_TIMEOUT')) } as never,
      { record: jest.fn() } as never,
    );

    await expect(
      service.createProposal(
        '72000000-0000-4000-8000-000000000001',
        '72000000-0000-4000-8000-000000000002',
        {
          resourceId: '71200000-0000-4000-8000-000000000001',
          keywords: ['eléctrica'],
        },
        { requestId: 'request-a' },
      ),
    ).rejects.toThrow('OPENAI_TIMEOUT');
    expect(resourceFindFirst).toHaveBeenCalledWith({
      where: {
        id: '71200000-0000-4000-8000-000000000001',
        taxonomyVersion: { status: 'ACTIVE', taxonomy: { organizationId: null } },
      },
      select: { id: true, name: true, level: true },
    });
    expect(proposalCreate).not.toHaveBeenCalled();
  });
});
