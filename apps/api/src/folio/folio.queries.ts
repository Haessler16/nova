import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { addCalendarDays, propertyDayStart } from '../common/time/property-day';
import type { PrismaService } from '../prisma/prisma.service';
import type { ListFoliosQueryDto } from './dto/folio.dto';
import { FOLIO_SELECT, mapFolio, type FolioResponse } from './folio.contracts';
import { loadFolioProperty } from './folio.support';

export async function getFolio(
  prisma: PrismaService,
  organizationId: string,
  propertyId: string,
  folioId: string,
): Promise<FolioResponse> {
  const folio = await prisma.folio.findFirst({
    where: { id: folioId, organizationId, propertyId },
    select: FOLIO_SELECT,
  });
  if (folio === null) {
    throw new NotFoundException({ code: 'folio_not_found', message: 'Folio not found.' });
  }
  return mapFolio(folio);
}

export async function listFolios(
  prisma: PrismaService,
  organizationId: string,
  propertyId: string,
  query: ListFoliosQueryDto,
): Promise<{ items: FolioResponse[] }> {
  const where: Prisma.FolioWhereInput = { organizationId, propertyId };
  if (query.status !== undefined) {
    where.status = query.status;
  }
  if (query.stayId !== undefined) {
    where.stayId = query.stayId;
  }
  if (query.reservationId !== undefined) {
    where.reservationId = query.reservationId;
  }
  if (query.search !== undefined && query.search.trim() !== '') {
    const search = query.search.trim();
    where.OR = [
      { number: { contains: search, mode: 'insensitive' } },
      { reservation: { code: { contains: search, mode: 'insensitive' } } },
      { reservation: { guest: { fullName: { contains: search, mode: 'insensitive' } } } },
      { stay: { guest: { fullName: { contains: search, mode: 'insensitive' } } } },
      { stay: { room: { number: { contains: search, mode: 'insensitive' } } } },
      { reservation: { room: { number: { contains: search, mode: 'insensitive' } } } },
    ];
  }
  if (query.date !== undefined) {
    const property = await loadFolioProperty(prisma, organizationId, propertyId);
    where.createdAt = {
      gte: propertyDayStart(query.date, property.timezone),
      lt: propertyDayStart(addCalendarDays(query.date, 1), property.timezone),
    };
  }

  const rows = await prisma.folio.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 100,
    select: FOLIO_SELECT,
  });

  return { items: rows.map(mapFolio) };
}
