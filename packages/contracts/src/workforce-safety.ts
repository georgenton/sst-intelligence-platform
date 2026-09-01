export const WORKER_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type WorkerStatus = (typeof WORKER_STATUSES)[number];

export function canReceiveNewWorkerAssignment(status: WorkerStatus) {
  return status === 'ACTIVE';
}

export function assertWorkerDateRange(startDate?: Date | null, endDate?: Date | null) {
  if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
    throw new RangeError('Worker end date cannot be before start date');
  }
}
