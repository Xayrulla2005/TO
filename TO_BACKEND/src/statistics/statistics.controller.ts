// ============================================================
// src/statistics/statistics.controller.ts
// ============================================================
import {
  Controller, Get, Query, UseGuards,
  ParseIntPipe, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt.auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decarators/roles.decarator';
import { UserRole } from '../common/dto/roles.enum';
import { StatisticsService, StatisticsPeriod } from './statistics.service';

@ApiTags('Statistics')
@Controller('api/v1/statistics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Dashboard stats for a specific date (Tashkent timezone)' })
  @ApiQuery({ name: 'date', required: false, description: 'YYYY-MM-DD' })
  async getDashboardByDate(@Query('date') date?: string) {
    return this.statisticsService.getDashboardByDate(date);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Statistics summary for time range' })
  @ApiQuery({ name: 'range', enum: ['daily', 'weekly', 'monthly', 'yearly'] })
  async getSummary(@Query('range') range: 'daily' | 'weekly' | 'monthly' | 'yearly') {
    return this.statisticsService.getSummaryByRange(range);
  }

  // ✅ YANGI: soatlik breakdown
  @Get('hourly')
  @ApiOperation({ summary: 'Hourly breakdown for a specific date' })
  @ApiQuery({ name: 'date', required: false, description: 'YYYY-MM-DD' })
  async getHourlyBreakdown(@Query('date') date?: string) {
    return this.statisticsService.getHourlyBreakdown(date);
  }

  @Get()
  @ApiOperation({ summary: 'Statistics for a specific period' })
  @ApiQuery({ name: 'period', enum: StatisticsPeriod })
  @ApiQuery({ name: 'referenceDate', required: false })
  @ApiQuery({ name: 'customStart',   required: false })
  @ApiQuery({ name: 'customEnd',     required: false })
  async getStatistics(
    @Query('period')        period: StatisticsPeriod,
    @Query('referenceDate') referenceDate?: string,
    @Query('customStart')   customStart?: string,
    @Query('customEnd')     customEnd?: string,
  ) {
    if (period === StatisticsPeriod.CUSTOM && (!customStart || !customEnd)) {
      throw new BadRequestException('customStart and customEnd required for CUSTOM period');
    }
    return this.statisticsService.getStatistics(period, referenceDate, customStart, customEnd);
  }

  @Get('monthly-breakdown')
  @ApiOperation({ summary: 'Monthly breakdown for a year (single query)' })
  @ApiQuery({ name: 'year', example: 2026 })
  async getMonthlyBreakdown(@Query('year', ParseIntPipe) year: number) {
    if (year < 2000 || year > 2100) throw new BadRequestException('Year must be 2000–2100');
    return this.statisticsService.getMonthlyBreakdown(year);
  }

  @Get('product-performance')
  @ApiOperation({ summary: 'Product performance (with profit margin)' })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate',   required: true })
  @ApiQuery({ name: 'limit',     required: false })
  async getProductPerformance(
    @Query('startDate') startDate: string,
    @Query('endDate')   endDate: string,
    @Query('limit')     limit?: string,
  ) {
    const start = new Date(startDate);
    const end   = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format');
    }
    return this.statisticsService.getProductPerformance(start, end, limit ? parseInt(limit, 10) : 20);
  }

  @Get('category-performance')
  @ApiOperation({ summary: 'Category performance (with profit margin)' })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate',   required: true })
  async getCategoryPerformance(
    @Query('startDate') startDate: string,
    @Query('endDate')   endDate: string,
  ) {
    const start = new Date(startDate);
    const end   = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format');
    }
    return this.statisticsService.getCategoryPerformance(start, end);
  }

  @Get('sales-trend')
  @ApiOperation({ summary: 'Sales trend with refunds' })
  @ApiQuery({ name: 'days', required: false, description: '1–365' })
  async getSalesTrend(@Query('days') days?: string) {
    const numDays = days ? parseInt(days, 10) : 30;
    if (numDays < 1 || numDays > 365) throw new BadRequestException('Days must be 1–365');
    return this.statisticsService.getSalesTrend(numDays);
  }
}