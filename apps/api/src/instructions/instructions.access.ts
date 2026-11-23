import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { InstructionCategory, InstructionVisibility } from '@prisma/client';
import { PERMISSIONS } from '../access/permissions';
import type { TenantContext } from '../common/http/request-context';
import type { PrismaService } from '../prisma/prisma.service';
import { INSTRUCTION_SELECT, type InstructionRow } from './instructions.contracts';

export function allowedVisibilities(context: TenantContext): InstructionVisibility[] {
  const result: InstructionVisibility[] = [InstructionVisibility.ALL_AUTHORIZED];
  const permissions = context.permissions;

  if (
    permissions.has(PERMISSIONS.FRONT_OFFICE_READ) ||
    permissions.has(PERMISSIONS.FRONT_OFFICE_MANAGE)
  ) {
    result.push(InstructionVisibility.FRONT_DESK);
  }
  if (permissions.has(PERMISSIONS.RESERVATIONS_MANAGE)) {
    result.push(InstructionVisibility.RESERVATIONS);
  }
  if (permissions.has(PERMISSIONS.REPORTS_FINANCIAL)) {
    result.push(InstructionVisibility.FINANCE);
  }
  if (
    permissions.has(PERMISSIONS.PROPERTY_MANAGE) ||
    permissions.has(PERMISSIONS.AUDIT_READ) ||
    permissions.has(PERMISSIONS.ORGANIZATION_PROPERTIES_MANAGE)
  ) {
    result.push(InstructionVisibility.MANAGEMENT);
  }
  return result;
}

export function canSeeConfidential(context: TenantContext): boolean {
  return (
    context.permissions.has(PERMISSIONS.AUDIT_READ) ||
    context.permissions.has(PERMISSIONS.PROPERTY_MANAGE) ||
    context.permissions.has(PERMISSIONS.ORGANIZATION_PROPERTIES_MANAGE)
  );
}

export function assertCanWriteVisibility(
  context: TenantContext,
  visibility: InstructionVisibility | undefined,
  category: InstructionCategory | undefined,
): void {
  if (category === InstructionCategory.CONFIDENTIAL && !canSeeConfidential(context)) {
    throw new ForbiddenException({
      code: 'instruction_confidential_forbidden',
      message: 'Your role cannot create or update confidential instructions.',
    });
  }

  if (visibility === undefined) {
    return;
  }

  if (!allowedVisibilities(context).includes(visibility)) {
    throw new ForbiddenException({
      code: 'instruction_visibility_forbidden',
      message: 'Your role cannot target that visibility.',
      details: { visibility },
    });
  }
}

export async function assertReservationInScope(
  prisma: PrismaService,
  context: TenantContext,
  propertyId: string,
  reservationId: string,
): Promise<void> {
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, organizationId: context.organizationId, propertyId },
    select: { id: true },
  });
  if (reservation === null) {
    throw new NotFoundException({
      code: 'reservation_not_found',
      message: 'Reservation not found in the selected property.',
    });
  }
}

export async function assertGuestInScope(
  prisma: PrismaService,
  context: TenantContext,
  propertyId: string,
  guestId: string,
): Promise<void> {
  const guest = await prisma.guest.findFirst({
    where: { id: guestId, organizationId: context.organizationId, propertyId },
    select: { id: true },
  });
  if (guest === null) {
    throw new NotFoundException({
      code: 'guest_not_found',
      message: 'Guest not found in the selected property.',
    });
  }
}

export async function findVisibleInstruction(
  prisma: PrismaService,
  context: TenantContext,
  propertyId: string,
  reservationId: string,
  instructionId: string,
): Promise<InstructionRow> {
  const includeConfidential = canSeeConfidential(context);

  const instruction = await prisma.reservationInstruction.findFirst({
    where: {
      id: instructionId,
      organizationId: context.organizationId,
      propertyId,
      reservationId,
      visibility: { in: allowedVisibilities(context) },
      ...(includeConfidential ? {} : { category: { not: InstructionCategory.CONFIDENTIAL } }),
    },
    select: INSTRUCTION_SELECT,
  });

  if (instruction === null) {
    throw new NotFoundException({
      code: 'instruction_not_found',
      message: 'Instruction not found or not visible to your role.',
    });
  }

  return instruction;
}
