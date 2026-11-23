import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import type { TenantContext } from '../common/http/request-context';
import { Clock } from '../common/time/clock';
import { csvCell } from '../exports/csv';
import { requirePropertyContext } from '../inventory/room-state.service';
import { PrismaService } from '../prisma/prisma.service';
import { parseCalendarDate } from '../reservations/reservation-dates';
import type { ExportReportDto, ReportFiltersDto, RunReportDto } from './dto/report.dto';
import {
  REPORT_DEFINITIONS,
  isReportKey,
  reportDefinition,
  type ReportDefinition,
  type ReportResult,
} from './report-definitions';
import { buildCashDailyReport } from './reports.cash-daily';
import { buildOccupancyReport } from './reports.occupancy';
import {
  buildArrivalsReport,
  buildDeparturesReport,
  buildReservationsReport,
} from './reports.reservations';
import {
  DEFAULT_PAGE_SIZE,
  MAX_RANGE_DAYS,
  MAX_ROWS,
  type BuiltReport,
  calendarDayCount,
  formatDateTime,
} from './reports.support';
import { renderReportPdf } from './report-pdf';

/**
 * Reports are deliberately synchronous and bounded in v1. The catalog is fixed
 * in code, every query is property-scoped, and clients never send SQL, column
 * names or arbitrary filters. Execution identifiers correlate the response with
 * an append-only audit event; report contents are not persisted.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clock: Clock,
  ) {}

  async catalog(context: TenantContext): Promise<{
    items: Array<{
      key: string;
      title: string;
      description: string;
      category: string;
      permission: string;
      allowed: boolean;
    }>;
  }> {
    requirePropertyContext(context);
    return {
      items: REPORT_DEFINITIONS.map((definition) => ({
        key: definition.key,
        title: definition.title,
        description: definition.description,
        category: definition.category,
        permission: definition.permission,
        allowed: context.permissions.has(definition.permission),
      })),
    };
  }

  async history(context: TenantContext): Promise<{ items: Array<Record<string, unknown>> }> {
    const propertyId = requirePropertyContext(context);
    const rows = await this.prisma.auditEvent.findMany({
      where: {
        organizationId: context.organizationId,
        propertyId,
        action: { in: ['report.executed', 'report.exported'] },
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: 50,
      select: { id: true, action: true, occurredAt: true, metadata: true },
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        action: row.action,
        occurredAt: row.occurredAt,
        metadata: row.metadata,
      })),
    };
  }

  async run(context: TenantContext, reportKey: string, dto: RunReportDto): Promise<ReportResult> {
    const definition = this.resolveDefinition(reportKey);
    this.assertPermission(context, definition);
    const propertyId = requirePropertyContext(context);
    const built = await this.build(context, definition, dto.filters);

    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? DEFAULT_PAGE_SIZE;
    const start = (page - 1) * pageSize;
    const executionId = randomUUID();
    const result = this.serialize(
      built,
      executionId,
      page,
      pageSize,
      built.rows.slice(start, start + pageSize),
    );

    await this.audit.append({
      organizationId: context.organizationId,
      propertyId,
      actorUserId: context.actor.id,
      action: 'report.executed',
      entityType: 'ReportExecution',
      entityId: executionId,
      correlationId: context.correlationId,
      metadata: {
        reportKey: definition.key,
        from: dto.filters.from,
        to: dto.filters.to,
        rowCount: result.totalRows,
        page,
        pageSize,
      },
    });

    return result;
  }

  async export(
    context: TenantContext,
    reportKey: string,
    dto: ExportReportDto,
  ): Promise<{ content: Buffer; mimeType: string; filename: string; rowCount: number }> {
    const definition = this.resolveDefinition(reportKey);
    this.assertPermission(context, definition);
    const propertyId = requirePropertyContext(context);
    const built = await this.build(context, definition, dto.filters);
    const executionId = randomUUID();
    const result = this.serialize(built, executionId, 1, MAX_ROWS, built.rows);

    const extension = dto.format === 'PDF' ? 'pdf' : 'csv';
    const content =
      dto.format === 'PDF'
        ? (await renderReportPdf(result)).buffer
        : Buffer.from(this.toCsv(built), 'utf8');

    await this.audit.append({
      organizationId: context.organizationId,
      propertyId,
      actorUserId: context.actor.id,
      action: 'report.exported',
      entityType: 'ReportExecution',
      entityId: executionId,
      correlationId: context.correlationId,
      metadata: {
        reportKey: definition.key,
        from: dto.filters.from,
        to: dto.filters.to,
        format: dto.format,
        rowCount: built.rows.length,
      },
    });

    return {
      content,
      mimeType: dto.format === 'PDF' ? 'application/pdf' : 'text/csv; charset=utf-8',
      filename: `nova-report-${definition.key}-${dto.filters.from}-${dto.filters.to}.${extension}`,
      rowCount: built.rows.length,
    };
  }

  private resolveDefinition(reportKey: string): ReportDefinition {
    if (!isReportKey(reportKey)) {
      throw new NotFoundException({
        code: 'report_not_found',
        message: 'The requested report is not part of the catalog.',
      });
    }
    return reportDefinition(reportKey);
  }

  private assertPermission(context: TenantContext, definition: ReportDefinition): void {
    if (!context.permissions.has(definition.permission)) {
      throw new ForbiddenException({
        code: 'permission_denied',
        message: 'You do not have permission to run this report.',
        details: { required: [definition.permission] },
      });
    }
  }

  private async build(
    context: TenantContext,
    definition: ReportDefinition,
    filters: ReportFiltersDto,
  ): Promise<BuiltReport> {
    const propertyId = requirePropertyContext(context);
    const fromDate = parseCalendarDate(filters.from, 'from');
    const toDate = parseCalendarDate(filters.to, 'to');
    const rangeDays = calendarDayCount(filters.from, filters.to);
    if (rangeDays < 1 || rangeDays > MAX_RANGE_DAYS) {
      throw new BadRequestException({
        code: 'report_filter_invalid',
        message: `El período debe tener entre 1 y ${MAX_RANGE_DAYS} días.`,
      });
    }

    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, organizationId: context.organizationId },
      select: {
        id: true,
        name: true,
        code: true,
        timezone: true,
        currencyCode: true,
      },
    });
    if (property === null) {
      throw new NotFoundException({
        code: 'property_not_found',
        message: 'Property not found in the current organization.',
      });
    }

    const base = {
      definition,
      organizationId: context.organizationId,
      property,
      generatedAt: this.clock.now(),
      filters: { from: filters.from, to: filters.to },
    };

    switch (definition.key) {
      case 'occupancy':
        return buildOccupancyReport(this.prisma, base, property, filters);
      case 'arrivals':
        return buildArrivalsReport(this.prisma, base, property, filters, fromDate, toDate);
      case 'departures':
        return buildDeparturesReport(this.prisma, base, property, filters, fromDate, toDate);
      case 'reservations':
        return buildReservationsReport(this.prisma, base, property, filters);
      case 'cash-daily':
        return buildCashDailyReport(this.prisma, base, property, filters, fromDate, toDate);
    }
  }

  private serialize(
    built: BuiltReport,
    executionId: string,
    page: number,
    pageSize: number,
    rows: Array<Record<string, string | number | null>>,
  ): ReportResult {
    const totalRows = built.rows.length;
    return {
      executionId,
      reportKey: built.definition.key,
      title: built.definition.title,
      description: built.definition.description,
      property: built.property,
      generatedAt: built.generatedAt.toISOString(),
      timezone: built.property.timezone,
      currencyCode: built.property.currencyCode,
      filters: built.filters,
      summary: built.summary,
      columns: built.definition.columns,
      rows,
      totalRows,
      page,
      pageSize,
      totalPages: totalRows === 0 ? 0 : Math.ceil(totalRows / pageSize),
    };
  }

  private toCsv(built: BuiltReport): string {
    const lines: string[] = [];
    const push = (cells: unknown[]): void => {
      lines.push(cells.map(csvCell).join(','));
    };

    push(['Reporte', built.definition.title]);
    push(['Propiedad', `${built.property.name} (${built.property.code})`]);
    push(['Desde', built.filters.from]);
    push(['Hasta', built.filters.to]);
    push(['Zona horaria', built.property.timezone]);
    push(['Generado', formatDateTime(built.generatedAt, built.property.timezone)]);
    lines.push('');
    push(['Resumen']);
    for (const item of built.summary) {
      push([item.label, item.value]);
    }
    lines.push('');
    push(built.definition.columns.map((column) => column.label));
    for (const row of built.rows) {
      push(built.definition.columns.map((column) => row[column.key] ?? ''));
    }
    return `\uFEFF${lines.join('\r\n')}\r\n`;
  }
}
