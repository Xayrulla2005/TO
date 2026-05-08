// ============================================================
// src/statistics/statistics.controller.ts
// ============================================================
import {
  Controller,
  Get,
  Query,
  UseGuards,
  ParseIntPipe,
  BadRequestException,
  UseInterceptors,
  Res,
  Logger,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiResponse,
} from "@nestjs/swagger";
import { CacheInterceptor, CacheTTL } from "@nestjs/cache-manager";
import { JwtAuthGuard } from "../common/guards/jwt.auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decarators/roles.decarator";
import { UserRole } from "../common/dto/roles.enum";
import { StatisticsService, StatisticsPeriod } from "./statistics.service";

const VALID_RANGES = ["daily", "weekly", "monthly", "yearly"] as const;
type TimeRange = (typeof VALID_RANGES)[number];

@ApiTags("Statistics")
@Controller("api/v1/statistics")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class StatisticsController {
  private readonly logger = new Logger(StatisticsController.name);

  constructor(private readonly statisticsService: StatisticsService) {}

  // ─── Dashboard ────────────────────────────────────────────
  @Get("dashboard")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(120_000)
  @ApiOperation({ summary: "Berilgan sana uchun dashboard statistikasi" })
  @ApiQuery({ name: "date", required: false, description: "ISO format sana (default: bugun)" })
  @ApiResponse({ status: 200, description: "Dashboard ma'lumotlari" })
  @ApiResponse({ status: 500, description: "Server xatoligi" })
  async getDashboardByDate(@Query("date") date?: string) {
    return this.statisticsService.getDashboardByDate(date);
  }

  // ─── Summary ──────────────────────────────────────────────
  @Get("summary")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(120_000)
  @ApiOperation({ summary: "Tanlangan davr uchun umumiy statistika" })
  @ApiQuery({
    name:     "range",
    enum:     VALID_RANGES,
    required: true,
    description: "Davr: daily | weekly | monthly | yearly",
  })
  @ApiResponse({ status: 200, description: "Umumiy statistika" })
  @ApiResponse({ status: 400, description: "Noto'g'ri range qiymati" })
  async getSummary(@Query("range") range: TimeRange) {
    if (!VALID_RANGES.includes(range)) {
      throw new BadRequestException(
        `range qiymati noto'g'ri. Quyidagilardan biri bo'lishi kerak: ${VALID_RANGES.join(", ")}`,
      );
    }
    return this.statisticsService.getSummaryByRange(range);
  }

  // ─── Monthly Breakdown ────────────────────────────────────
  @Get("monthly-breakdown")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(600_000)
  @ApiOperation({ summary: "Yillik oylik tahlil" })
  @ApiQuery({ name: "year", required: true, description: "Yil (2000–2100)" })
  @ApiResponse({ status: 200, description: "12 oylik ma'lumotlar" })
  @ApiResponse({ status: 400, description: "Noto'g'ri yil" })
  async getMonthlyBreakdown(@Query("year", ParseIntPipe) year: number) {
    if (year < 2000 || year > 2100) {
      throw new BadRequestException("Yil 2000 va 2100 orasida bo'lishi kerak");
    }
    return this.statisticsService.getMonthlyBreakdown(year);
  }

  // ─── Product Performance ──────────────────────────────────
  @Get("product-performance")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300_000)
  @ApiOperation({ summary: "Mahsulotlar bo'yicha tahlil" })
  @ApiQuery({ name: "startDate", required: true,  description: "Boshlanish sanasi (ISO)" })
  @ApiQuery({ name: "endDate",   required: true,  description: "Tugash sanasi (ISO)" })
  @ApiQuery({ name: "limit",     required: false, description: "Natija soni (default: 20)" })
  @ApiResponse({ status: 200, description: "Mahsulot statistikasi" })
  @ApiResponse({ status: 400, description: "Noto'g'ri sana formati" })
  async getProductPerformance(
    @Query("startDate") startDate: string,
    @Query("endDate")   endDate:   string,
    @Query("limit")     limit?:    string,
  ) {
    const start = new Date(startDate);
    const end   = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException("Sana formati noto'g'ri. ISO format kerak (masalan: 2024-01-01T00:00:00)");
    }
    if (start > end) {
      throw new BadRequestException("startDate endDate dan oldin bo'lishi kerak");
    }

    const limitNum = limit ? parseInt(limit, 10) : 20;
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      throw new BadRequestException("limit 1 dan 100 gacha bo'lishi kerak");
    }

    return this.statisticsService.getProductPerformance(start, end, limitNum);
  }

  // ─── Category Performance ─────────────────────────────────
  @Get("category-performance")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300_000)
  @ApiOperation({ summary: "Kategoriyalar bo'yicha tahlil" })
  @ApiQuery({ name: "startDate", required: true,  description: "Boshlanish sanasi (ISO)" })
  @ApiQuery({ name: "endDate",   required: true,  description: "Tugash sanasi (ISO)" })
  @ApiResponse({ status: 200, description: "Kategoriya statistikasi" })
  @ApiResponse({ status: 400, description: "Noto'g'ri sana formati" })
  async getCategoryPerformance(
    @Query("startDate") startDate: string,
    @Query("endDate")   endDate:   string,
  ) {
    const start = new Date(startDate);
    const end   = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException("Sana formati noto'g'ri. ISO format kerak");
    }
    if (start > end) {
      throw new BadRequestException("startDate endDate dan oldin bo'lishi kerak");
    }

    return this.statisticsService.getCategoryPerformance(start, end);
  }

  // ─── General Statistics ───────────────────────────────────
  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(180_000)
  @ApiOperation({ summary: "Berilgan davr uchun statistika" })
  @ApiQuery({ name: "period",        enum: StatisticsPeriod, required: true  })
  @ApiQuery({ name: "referenceDate", required: false, description: "ISO format sana" })
  @ApiQuery({ name: "customStart",   required: false, description: "CUSTOM uchun boshlanish" })
  @ApiQuery({ name: "customEnd",     required: false, description: "CUSTOM uchun tugash" })
  @ApiResponse({ status: 200, description: "Statistika ma'lumotlari" })
  @ApiResponse({ status: 400, description: "Noto'g'ri parametrlar" })
  async getStatistics(
    @Query("period")        period:        StatisticsPeriod,
    @Query("referenceDate") referenceDate?: string,
    @Query("customStart")   customStart?:   string,
    @Query("customEnd")     customEnd?:     string,
  ) {
    const validPeriods = Object.values(StatisticsPeriod);
    if (!validPeriods.includes(period)) {
      throw new BadRequestException(
        `period qiymati noto'g'ri. Quyidagilardan biri: ${validPeriods.join(", ")}`,
      );
    }
    if (period === StatisticsPeriod.CUSTOM && (!customStart || !customEnd)) {
      throw new BadRequestException(
        "CUSTOM period uchun customStart va customEnd parametrlari majburiy",
      );
    }

    return this.statisticsService.getStatistics(period, referenceDate, customStart, customEnd);
  }

  // ─── Sales Trend ──────────────────────────────────────────
  @Get("sales-trend")
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(180_000)
  @ApiOperation({ summary: "So'nggi N kunlik savdo trendi" })
  @ApiQuery({ name: "days", required: false, description: "Kunlar soni (1–365, default: 30)" })
  @ApiResponse({ status: 200, description: "Kunlik savdo trendi" })
  @ApiResponse({ status: 400, description: "Noto'g'ri kunlar soni" })
  async getSalesTrend(@Query("days") days?: string) {
    const numDays = days ? parseInt(days, 10) : 30;

    if (isNaN(numDays) || numDays < 1 || numDays > 365) {
      throw new BadRequestException("days parametri 1 dan 365 gacha bo'lishi kerak");
    }

    return this.statisticsService.getSalesTrend(numDays);
  }

  // ─── Excel Export ─────────────────────────────────────────
  @Get("export/excel")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Statistikani Excel formatda yuklab olish (faqat ADMIN)" })
  @ApiQuery({ name: "type",      enum: ["monthly", "yearly", "custom"], required: false })
  @ApiQuery({ name: "year",      required: false, description: "Yil (default: joriy yil)" })
  @ApiQuery({ name: "startDate", required: false, description: "CUSTOM uchun boshlanish sanasi" })
  @ApiQuery({ name: "endDate",   required: false, description: "CUSTOM uchun tugash sanasi" })
  @ApiResponse({ status: 200, description: "Excel fayl" })
  @ApiResponse({ status: 500, description: "Excel yaratishda xatolik" })
  async exportExcel(
    @Res()          res:        any,
    @Query("type")  type?:      string,
    @Query("year")  year?:      string,
    @Query("startDate") startDate?: string,
    @Query("endDate")   endDate?:   string,
  ) {
    const exportType = (["monthly", "yearly", "custom"].includes(type ?? "")
      ? type
      : "yearly") as "monthly" | "yearly" | "custom";

    const yearNum  = year ? parseInt(year, 10) : new Date().getFullYear();
    const filename = `statistika_${exportType}_${yearNum}_${Date.now()}.xlsx`;

    const workbook = await this.statisticsService.generateExcelReport({
      type:      exportType,
      year:      yearNum,
      startDate,
      endDate,
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`,
    );
    res.setHeader("Cache-Control", "no-cache");

    await workbook.xlsx.write(res);
    res.end();
  }
}