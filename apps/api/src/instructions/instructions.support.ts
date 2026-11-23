import { BadRequestException } from '@nestjs/common';
import { InstructionEventType, InstructionStatus } from '@prisma/client';

export const ALLOWED_TRANSITIONS: Record<InstructionStatus, InstructionStatus[]> = {
  NEW: [
    InstructionStatus.ACKNOWLEDGED,
    InstructionStatus.IN_PROGRESS,
    InstructionStatus.COMPLETED,
    InstructionStatus.DISMISSED,
    InstructionStatus.NEEDS_CLARIFICATION,
  ],
  ACKNOWLEDGED: [
    InstructionStatus.IN_PROGRESS,
    InstructionStatus.COMPLETED,
    InstructionStatus.DISMISSED,
    InstructionStatus.NEEDS_CLARIFICATION,
  ],
  IN_PROGRESS: [
    InstructionStatus.COMPLETED,
    InstructionStatus.DISMISSED,
    InstructionStatus.NEEDS_CLARIFICATION,
  ],
  NEEDS_CLARIFICATION: [
    InstructionStatus.ACKNOWLEDGED,
    InstructionStatus.IN_PROGRESS,
    InstructionStatus.DISMISSED,
  ],
  COMPLETED: [],
  DISMISSED: [],
};

export function normalizeTags(tags: string[] | undefined): string[] {
  if (tags === undefined) {
    return [];
  }
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const value of tags) {
    const tag = value.trim().slice(0, 32);
    if (tag.length === 0) {
      continue;
    }
    const key = tag.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push(tag);
    if (normalized.length === 10) {
      break;
    }
  }
  return normalized;
}

export function assertValidityRange(
  validFrom: Date | undefined,
  validUntil: Date | undefined,
): void {
  if (validFrom !== undefined && validUntil !== undefined && validUntil <= validFrom) {
    throw new BadRequestException({
      code: 'instruction_invalid_validity',
      message: 'validUntil must be later than validFrom.',
    });
  }
}

export function parseOptionalDate(value: string | undefined, field: string): Date | undefined {
  if (value === undefined) {
    return undefined;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException({
      code: 'invalid_date',
      message: `${field} must be a valid ISO-8601 date.`,
    });
  }
  return date;
}

export function eventTypeForStatus(status: InstructionStatus): InstructionEventType {
  switch (status) {
    case InstructionStatus.ACKNOWLEDGED:
      return InstructionEventType.ACKNOWLEDGED;
    case InstructionStatus.IN_PROGRESS:
      return InstructionEventType.IN_PROGRESS;
    case InstructionStatus.COMPLETED:
      return InstructionEventType.COMPLETED;
    case InstructionStatus.DISMISSED:
      return InstructionEventType.DISMISSED;
    case InstructionStatus.NEEDS_CLARIFICATION:
      return InstructionEventType.NEEDS_CLARIFICATION;
    default:
      return InstructionEventType.UPDATED;
  }
}
