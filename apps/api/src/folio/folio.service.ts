import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FolioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createFolio(
    organizationId: string,
    propertyId: string,
    createFolioDto: any,
  ) {
    const folio = await this.prisma.folio.create({
      data: {
        organizationId,
        propertyId,
        concept: createFolioDto.concept,
        amount: createFolioDto.amount,
        currencyCode: createFolioDto.currencyCode,
        status: createFolioDto.status,
        number: createFolioDto.number,
        stayId: createFolioDto.stayId,
        reservationId: createFolioDto.reservationId,
        description: createFolioDto.description,
      },
      select: {
        id: true,
        organizationId: true,
        propertyId: true,
        concept: true,
        amount: true,
        currencyCode: true,
        status: true,
        number: true,
      },
    });

    return folio;
  }

  async getFolio(folioId: string) {
    const folio = await this.prisma.folio.findFirstOrThrow({
      where: { id: folioId },
      select: {
        id: true,
        organizationId: true,
        propertyId: true,
        concept: true,
        amount: true,
        currencyCode: true,
        status: true,
        number: true,
      },
    });

    return {
      ...folio,
      totalPaid: 0,
      totalCharged: folio.amount,
      balance: folio.amount,
    };
  }

  async recordPayment(
    organizationId: string,
    propertyId: string,
    createPaymentDto: any,
  ) {
    if (createPaymentDto.folioId) {
      await this.prisma.folio.findFirst({
        where: { id: createPaymentDto.folioId, propertyId, organizationId },
      });
    }

    const payment = await this.prisma.payment.create({
      data: {
        organizationId,
        propertyId,
        folioId: createPaymentDto.folioId,
        stayId: createPaymentDto.stayId,
        reservationId: createPaymentDto.reservationId,
        amount: createPaymentDto.amount,
        currencyCode: createPaymentDto.currencyCode,
        method: createPaymentDto.method,
        status: createPaymentDto.status,
        referenceId: createPaymentDto.referenceId,
        description: createPaymentDto.description,
      },
      select: {
        id: true,
        organizationId: true,
        propertyId: true,
        folio: { select: { id: true, concept: true } },
        stay: { select: { id: true } },
        reservation: { select: { id: true } },
        amount: true,
        currencyCode: true,
        method: true,
        status: true,
        referenceId: true,
      },
    });

    return payment;
  }

  async createCashSession(
    organizationId: string,
    propertyId: string,
    createCashSessionDto: any,
  ) {
    const session = await this.prisma.cashSession.create({
      data: {
        organizationId,
        propertyId,
        name: createCashSessionDto.name,
        operationalDate: createCashSessionDto.operationalDate,
        openingAmount: createCashSessionDto.openingAmount,
        openingByUserId: createCashSessionDto.openingByUserId,
        status: createCashSessionDto.status,
      },
      select: {
        id: true,
        organizationId: true,
        propertyId: true,
        name: true,
        operationalDate: true,
        openingAmount: true,
        closingAmount: true,
        status: true,
      },
    });

    return session;
  }

  async closeCashSession(
    cashSessionId: string,
    closingAmount: number,
    closedByUserId: string,
  ) {
    const session = await this.prisma.cashSession.update({
      where: { id: cashSessionId },
      data: {
        closingAmount,
        closedAt: new Date(),
        closedByUserId,
        status: 'CLOSED',
      },
      select: {
        id: true,
        organizationId: true,
        propertyId: true,
        name: true,
        operationalDate: true,
        openingAmount: true,
        closingAmount: true,
        status: true,
        closedAt: true,
        closedByUserId: true,
      },
    });

    return session;
  }

  async recordCashMovement(
    organizationId: string,
    propertyId: string,
    createCashMovementDto: any,
  ) {
    const movement = await this.prisma.cashMovement.create({
      data: {
        organizationId,
        propertyId,
        cashSessionId: createCashMovementDto.cashSessionId,
        type: createCashMovementDto.type,
        amount: createCashMovementDto.amount,
        currencyCode: createCashMovementDto.currencyCode,
        description: createCashMovementDto.description,
      },
      select: {
        id: true,
        organizationId: true,
        propertyId: true,
        cashSession: {
          select: { id: true, name: true },
        },
        type: true,
        amount: true,
        currencyCode: true,
        description: true,
        createdAt: true,
      },
    });

    return movement;
  }

  async getCashSession(cashSessionId: string) {
    const session = await this.prisma.cashSession.findFirstOrThrow({
      where: { id: cashSessionId },
      select: {
        id: true,
        organizationId: true,
        propertyId: true,
        name: true,
        operationalDate: true,
        openingAmount: true,
        closingAmount: true,
        status: true,
      },
    });

    return {
      ...session,
      totalPaid: 0,
      currentBalance: Number(session.openingAmount),
    };
  }
}