import { Injectable } from '@nestjs/common';
import { CheckInReadinessQuery } from './application/check-in-readiness.query';
import { CheckInUseCase } from './application/check-in.use-case';
import { CheckOutUseCase } from './application/check-out.use-case';
import { IncidentsService } from './application/incidents.service';
import { NoShowUseCase } from './application/no-show.use-case';
import { OverviewQuery } from './application/overview.query';
import { RoomMoveUseCase } from './application/room-move.use-case';
import { TenantContext } from '../common/http/request-context';
import {
  type CheckInReadiness,
  type CheckOutResponse,
  type CheckoutReadiness,
  type FrontOfficeOverview,
  type IncidentResponse,
  type ReservationSummaryResponse,
  type RoomMoveCandidates,
  type StayResponse,
} from './application/front-office.contracts';
import {
  CheckOutDto,
  CreateIncidentDto,
  FrontOfficeOverviewQueryDto,
  ListIncidentsQueryDto,
  MoveStayRoomDto,
  NoShowDto,
  ResolveIncidentDto,
} from './dto/front-office.dto';

// Public surface kept by the facade: the contracts module owns the shapes, the
// facade re-exports them so controllers and callers keep their imports.
export type {
  CheckInReadiness,
  CheckInRoomOption,
  CheckInWindow,
  CheckOutResponse,
  CheckoutFolioSummary,
  CheckoutReadiness,
  CheckoutSummary,
  FrontOfficeOverview,
  IncidentResponse,
  ReservationSummaryResponse,
  RoomMoveCandidate,
  RoomMoveCandidates,
  RoomMoveCandidateType,
  RoomRackItem,
  StayResponse,
} from './application/front-office.contracts';

/**
 * Front-office facade. Every operation is delegated to a single use case or
 * query, so the controller keeps one stable entry point while each flow owns
 * its rules, locking order and read model.
 */
@Injectable()
export class FrontOfficeService {
  constructor(
    private readonly checkInUseCase: CheckInUseCase,
    private readonly checkInReadinessQuery: CheckInReadinessQuery,
    private readonly checkOutUseCase: CheckOutUseCase,
    private readonly overviewQuery: OverviewQuery,
    private readonly roomMoveUseCase: RoomMoveUseCase,
    private readonly noShowUseCase: NoShowUseCase,
    private readonly incidents: IncidentsService,
  ) {}

  overview(
    context: TenantContext,
    query: FrontOfficeOverviewQueryDto,
  ): Promise<FrontOfficeOverview> {
    return this.overviewQuery.overview(context, query);
  }

  /**
   * Read-only check-in checklist for the guided front-desk flow. It mirrors the
   * backend rules used by `checkIn` so the operator sees why a room is not
   * selectable, but the confirmation transaction remains the authority.
   */
  checkInReadiness(context: TenantContext, reservationId: string): Promise<CheckInReadiness> {
    return this.checkInReadinessQuery.readiness(context, reservationId);
  }

  checkIn(
    context: TenantContext,
    reservationId: string,
  ): Promise<{ reservation: ReservationSummaryResponse; stay: StayResponse }> {
    return this.checkInUseCase.execute(context, reservationId);
  }

  checkoutReadiness(context: TenantContext, stayId: string): Promise<CheckoutReadiness> {
    return this.checkOutUseCase.readiness(context, stayId);
  }

  checkOut(context: TenantContext, stayId: string, dto: CheckOutDto): Promise<CheckOutResponse> {
    return this.checkOutUseCase.execute(context, stayId, dto);
  }

  /**
   * Read-only destination list for the guided room move: every room of the
   * property with the same eligibility rules the transactional move applies.
   */
  roomMoveCandidates(context: TenantContext, stayId: string): Promise<RoomMoveCandidates> {
    return this.roomMoveUseCase.candidates(context, stayId);
  }

  moveRoom(context: TenantContext, stayId: string, dto: MoveStayRoomDto): Promise<StayResponse> {
    return this.roomMoveUseCase.execute(context, stayId, dto);
  }

  noShow(
    context: TenantContext,
    reservationId: string,
    dto: NoShowDto,
  ): Promise<ReservationSummaryResponse> {
    return this.noShowUseCase.execute(context, reservationId, dto);
  }

  listIncidents(
    context: TenantContext,
    query: ListIncidentsQueryDto,
  ): Promise<{ items: IncidentResponse[] }> {
    return this.incidents.list(context, query);
  }

  createIncident(context: TenantContext, dto: CreateIncidentDto): Promise<IncidentResponse> {
    return this.incidents.create(context, dto);
  }

  resolveIncident(
    context: TenantContext,
    incidentId: string,
    dto: ResolveIncidentDto,
  ): Promise<IncidentResponse> {
    return this.incidents.resolve(context, incidentId, dto);
  }
}
