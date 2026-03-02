// ============================================================
// src/statistics/statistics.controller.ts - COMPLETE
// ============================================================
import {
  Controller,
  Get,
  Query,
  UseGuards,
  ParseIntPipe,
  BadRequestException,
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
@Roles(UserRole.ADMIN) // ADMIN only - SALER cannot access statistics
@ApiBearerAuth()
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

 // ✅ YANGI ENDPOINT - Dashboard uchun
  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard stats for a specific date' })
  @ApiQuery({ name: 'date', required: false, description: 'Date in YYYY-MM-DD format' })
  async getDashboardByDate(@Query('date') date?: string) {
    console.log('📊 Dashboard API called with date:', date);
    return this.statisticsService.getDashboardByDate(date);
  }

  // ✅ YANGI ENDPOINT - Statistics summary uchun
  @Get('summary')
  @ApiOperation({ summary: 'Get statistics summary for time range' })
  @ApiQuery({ name: 'range', enum: ['daily', 'weekly', 'monthly', 'yearly'] })
  async getSummary(
    @Query('range') range: 'daily' | 'weekly' | 'monthly' | 'yearly',
  ) {
    console.log('📊 Summary API called with range:', range);
    return this.statisticsService.getSummaryByRange(range);
  }


//   @Get('dashboard')
// @ApiOperation({ summary: 'Get dashboard stats for a specific date' })
// @ApiQuery({ name: 'date', required: false, description: 'Date in YYYY-MM-DD format' })
// async getDashboardByDate(@Query('date') date?: string) {
//   const targetDate = date ? new Date(date) : new Date();
  
//   // Get today's stats
//   const todayStats = await this.statisticsService.getStatistics(
//     StatisticsPeriod.DAILY,
//     targetDate.toISOString(),
//   );

//   // Get recent sales
//   const recentSales = await this.statisticsService.getRecentSales(targetDate, 20);

//   // Get low stock products
//   const lowStock = await this.statisticsService.getLowStockProducts(10);

//   // Get best selling products for today
//   const bestSelling = await this.statisticsService.getBestSellingProducts(
//     targetDate,
//     targetDate,
//     10,
//   );

//   return {
//     todayRevenue: todayStats.totalRevenue,
//     grossProfit: todayStats.grossProfit,
//     cashTotal: todayStats.cashAmount,
//     debtTotal: todayStats.debtAmount,
//     recentSales: recentSales.map(sale => ({
//       id: sale.id,
//       createdAt: sale.createdAt,
//       customerName: sale.customerName || null,
//       paymentMethod: sale.paymentMethod,
//       total: Number(sale.grandTotal),
//     })),
//     lowStockProducts: lowStock.map(p => ({
//       id: p.id,
//       name: p.name,
//       stockQty: Number(p.stockQuantity),
//     })),
//     bestSellingProducts: bestSelling.map(p => ({
//       id: p.productId,
//       name: p.productName,
//       qty: p.totalQuantitySold,
//       total: p.totalRevenue,
//     })),
//   };
// }

  @Get()
  @ApiOperation({ summary: 'Get statistics for a specific period (ADMIN)' })
  @ApiQuery({ name: 'period', enum: StatisticsPeriod, required: true })
  @ApiQuery({ name: 'referenceDate', required: false, description: 'ISO date string (default: now)' })
  @ApiQuery({ name: 'customStart', required: false, description: 'ISO date for custom period start' })
  @ApiQuery({ name: 'customEnd', required: false, description: 'ISO date for custom period end' })
  async getStatistics(
    @Query('period') period: StatisticsPeriod,
    @Query('referenceDate') referenceDate?: string,
    @Query('customStart') customStart?: string,
    @Query('customEnd') customEnd?: string,
  ) {
    if (period === StatisticsPeriod.CUSTOM && (!customStart || !customEnd)) {
      throw new BadRequestException('customStart and customEnd are required for CUSTOM period');
    }
    return this.statisticsService.getStatistics(period, referenceDate, customStart, customEnd);
  }

  @Get('monthly-breakdown')
  @ApiOperation({ summary: 'Get monthly statistics breakdown for a year (ADMIN)' })
  @ApiQuery({ name: 'year', required: true, example: 2024 })
  async getMonthlyBreakdown(@Query('year', ParseIntPipe) year: number) {
    if (year < 2000 || year > 2100) {
      throw new BadRequestException('Year must be between 2000 and 2100');
    }
    return this.statisticsService.getMonthlyBreakdown(year);
  }

  @Get('product-performance')
  @ApiOperation({ summary: 'Get product performance report (ADMIN)' })
  @ApiQuery({ name: 'startDate', required: true, description: 'ISO date' })
  @ApiQuery({ name: 'endDate', required: true, description: 'ISO date' })
  @ApiQuery({ name: 'limit', required: false, description: 'Top N products (default: 20)' })
  async getProductPerformance(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('limit') limit?: string,
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const topN = limit ? parseInt(limit, 10) : 20;

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    return this.statisticsService.getProductPerformance(start, end, topN);
  }

  @Get('category-performance')
  @ApiOperation({ summary: 'Get category performance report (ADMIN)' })
  @ApiQuery({ name: 'startDate', required: true, description: 'ISO date' })
  @ApiQuery({ name: 'endDate', required: true, description: 'ISO date' })
  async getCategoryPerformance(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    return this.statisticsService.getCategoryPerformance(start, end);
  }

  @Get('sales-trend')
  @ApiOperation({ summary: 'Get sales trend for the last N days (ADMIN)' })
  @ApiQuery({ name: 'days', required: false, description: 'Number of days (default: 30)' })
  async getSalesTrend(@Query('days') days?: string) {
    const numDays = days ? parseInt(days, 10) : 30;

    if (numDays < 1 || numDays > 365) {
      throw new BadRequestException('Days must be between 1 and 365');
    }

    return this.statisticsService.getSalesTrend(numDays);
  }
}