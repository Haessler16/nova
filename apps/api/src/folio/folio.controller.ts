import {
  Body,
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TenantContext } from '../common/http/request-context';
import { FolioService } from './folio.service';
import { CreateFolioDto } from './dto/create-folio.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateCashSessionDto } from './dto/create-cash-session.dto';
import { CreateCashMovementDto } from './dto/create-cash-movement.dto';

@ApiTags('Folio')
@ApiBearerAuth()
@UseGuards()
@Controller('folio')
export class FolioController {
  constructor(private readonly folioService: FolioService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new folio' })
  @ApiResponse({ status: 201, description: 'Folio created' })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: { organizationId: string; propertyId: string; createFolioDto: CreateFolioDto }) {
    return this.folioService.createFolio(body.organizationId, body.propertyId, body.createFolioDto);
  }

  @Get(':folioId')
  @ApiOperation({ summary: 'Get folio details' })
  @ApiResponse({ status: 200, description: 'Folio retrieved' })
  async get(@Param('folioId') folioId: string) {
    return this.folioService.getFolio(folioId);
  }

  @Post('payments')
  @ApiOperation({ summary: 'Record a payment' })
  @ApiResponse({ status: 201, description: 'Payment recorded' })
  @HttpCode(HttpStatus.CREATED)
  async recordPayment(
    @Body() body: { organizationId: string; propertyId: string; createPaymentDto: CreatePaymentDto },
  ) {
    return this.folioService.recordPayment(body.organizationId, body.propertyId, body.createPaymentDto);
  }

  @Post('cash-sessions')
  @ApiOperation({ summary: 'Create a cash session' })
  @ApiResponse({ status: 201, description: 'Cash session created' })
  @HttpCode(HttpStatus.CREATED)
  async createCashSession(
    @Body() body: { organizationId: string; propertyId: string; createCashSessionDto: CreateCashSessionDto },
  ) {
    return this.folioService.createCashSession(body.organizationId, body.propertyId, body.createCashSessionDto);
  }

  @Post('cash-sessions/:cashSessionId/close')
  @ApiOperation({ summary: 'Close a cash session' })
  @ApiResponse({ status: 200, description: 'Cash session closed' })
  async closeCashSession(
    @Param('cashSessionId') cashSessionId: string,
    @Body() body: { closingAmount: number; closedByUserId: string },
  ) {
    return this.folioService.closeCashSession(cashSessionId, body.closingAmount, body.closedByUserId);
  }

  @Post('cash-movements')
  @ApiOperation({ summary: 'Record a cash movement' })
  @ApiResponse({ status: 201, description: 'Cash movement recorded' })
  @HttpCode(HttpStatus.CREATED)
  async recordCashMovement(
    @Body() body: { organizationId: string; propertyId: string; createCashMovementDto: CreateCashMovementDto },
  ) {
    return this.folioService.recordCashMovement(body.organizationId, body.propertyId, body.createCashMovementDto);
  }

  @Get('cash-sessions/:cashSessionId')
  @ApiOperation({ summary: 'Get cash session details' })
  @ApiResponse({ status: 200, description: 'Cash session retrieved' })
  async getCashSession(@Param('cashSessionId') cashSessionId: string) {
    return this.folioService.getCashSession(cashSessionId);
  }
}