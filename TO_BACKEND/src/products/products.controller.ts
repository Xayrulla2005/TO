// ============================================================
// src/products/products.controller.ts
// ============================================================
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { ProductsService } from "./products.service";
import { CreateProductDto, UpdateProductDto } from "./dto/create-product.dto";
import { ProductQueryDto } from "../common/dto/pagination.query.dto";
import { JwtAuthGuard } from "../common/guards/jwt.auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decarators/roles.decarator";
import { CurrentUser } from "../common/decarators/current.user.decarator";
import { UserRole } from "../common/dto/roles.enum";
import { multerOptions } from "./config/multer.config";

@ApiTags("Products")
@Controller("api/v1/products")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // ─── Create ───────────────────────────────────────────────
  @Post()
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor("image", multerOptions))
  @ApiOperation({ summary: "Yangi mahsulot yaratish (faqat ADMIN)" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["name", "purchasePrice", "salePrice", "unit"],
      properties: {
        name:          { type: "string",  example: "Laptop" },
        categoryId:    { type: "string",  format: "uuid" },
        purchasePrice: { type: "number",  example: 500 },
        salePrice:     { type: "number",  example: 650 },
        unit:          { type: "string",  example: "piece" },
        stockQuantity: { type: "number",  example: 10 },
        minStockLimit: { type: "number",  example: 5 },
        image:         { type: "string",  format: "binary" },
      },
    },
  })
  @ApiResponse({ status: 201, description: "Mahsulot yaratildi" })
  @ApiResponse({ status: 409, description: "Bu nomli mahsulot allaqachon mavjud" })
  async create(
    @Body()                       dto:    CreateProductDto,
    @UploadedFile()               file:   Express.Multer.File,
    @CurrentUser("id")            userId: string,
  ) {
    return this.productsService.create(dto, file, userId);
  }

  // ─── Update ───────────────────────────────────────────────
  @Put(":id")
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor("image", multerOptions))
  @ApiOperation({ summary: "Mahsulotni yangilash (faqat ADMIN)" })
  @ApiConsumes("multipart/form-data")
  @ApiParam({ name: "id", description: "Mahsulot UUID" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        name:          { type: "string"  },
        categoryId:    { type: "string", format: "uuid" },
        purchasePrice: { type: "number" },
        salePrice:     { type: "number" },
        unit:          { type: "string" },
        stockQuantity: { type: "number" },
        minStockLimit: { type: "number" },
        image:         { type: "string", format: "binary" },
      },
    },
  })
  @ApiResponse({ status: 200, description: "Mahsulot yangilandi" })
  @ApiResponse({ status: 404, description: "Mahsulot topilmadi" })
  async update(
    @Param("id", ParseUUIDPipe)   id:     string,
    @Body()                       dto:    UpdateProductDto,
    @UploadedFile()               file:   Express.Multer.File,
    @CurrentUser("id")            userId: string,
  ) {
    return this.productsService.update(id, dto, file, userId);
  }

  // ─── List ─────────────────────────────────────────────────
  @Get()
  @ApiOperation({ summary: "Mahsulotlar ro'yxati (pagination + qidiruv)" })
  @ApiQuery({ name: "page",   required: false, description: "Sahifa raqami (default: 1)"  })
  @ApiQuery({ name: "limit",  required: false, description: "Sahifadagi soni (default: 20)" })
  @ApiQuery({ name: "search", required: false, description: "Mahsulot nomi bo'yicha qidiruv" })
  @ApiResponse({ status: 200, description: "Mahsulotlar ro'yxati" })
  async findAll(@Query() query: ProductQueryDto) {
    // ✅ ProductQueryDto — search fieldi mavjud
    return this.productsService.findAll(query);
  }

  // ─── Low Stock ────────────────────────────────────────────
  @Get("low-stock")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Kam qoldiqli mahsulotlar (faqat ADMIN)" })
  @ApiQuery({ name: "threshold", required: false, description: "Chegara miqdori" })
  @ApiResponse({ status: 200, description: "Kam qoldiqli mahsulotlar" })
  async getLowStock(@Query("threshold") threshold?: string) {
    const numThreshold = threshold ? parseInt(threshold, 10) : undefined;

    if (threshold && (isNaN(numThreshold!) || numThreshold! < 0)) {
      throw new BadRequestException("threshold musbat son bo'lishi kerak");
    }

    return this.productsService.getLowStock(numThreshold);
  }

  // ─── Get One ──────────────────────────────────────────────
  @Get(":id")
  @ApiOperation({ summary: "ID bo'yicha mahsulot olish" })
  @ApiParam({ name: "id", description: "Mahsulot UUID" })
  @ApiResponse({ status: 200, description: "Mahsulot ma'lumotlari" })
  @ApiResponse({ status: 404, description: "Mahsulot topilmadi" })
  async findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.productsService.findOne(id);
  }

  // ─── Delete ───────────────────────────────────────────────
  @Delete(":id")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Mahsulotni o'chirish (soft delete, faqat ADMIN)" })
  @ApiParam({ name: "id", description: "Mahsulot UUID" })
  @ApiResponse({ status: 200, description: "Mahsulot o'chirildi" })
  @ApiResponse({ status: 404, description: "Mahsulot topilmadi" })
  async remove(
    @Param("id", ParseUUIDPipe) id:     string,
    @CurrentUser("id")          userId: string,
  ) {
    return this.productsService.softDelete(id, userId);
  }

  // ─── Restore ──────────────────────────────────────────────
  @Post(":id/restore")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "O'chirilgan mahsulotni tiklash (faqat ADMIN)" })
  @ApiParam({ name: "id", description: "Mahsulot UUID" })
  @ApiResponse({ status: 200, description: "Mahsulot tiklandi" })
  @ApiResponse({ status: 404, description: "Mahsulot topilmadi" })
  async restore(
    @Param("id", ParseUUIDPipe) id:     string,
    @CurrentUser("id")          userId: string,
  ) {
    return this.productsService.restore(id, userId);
  }

  // ─── Delete Image ─────────────────────────────────────────
  @Delete(":id/image")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Mahsulot rasmini o'chirish (faqat ADMIN)" })
  @ApiParam({ name: "id", description: "Mahsulot UUID" })
  @ApiResponse({ status: 200, description: "Rasm o'chirildi" })
  @ApiResponse({ status: 400, description: "Mahsulotda rasm yo'q" })
  async deleteImage(
    @Param("id", ParseUUIDPipe) id:     string,
    @CurrentUser("id")          userId: string,
  ) {
    return this.productsService.deleteImage(id, userId);
  }

  // ─── Cleanup Images ───────────────────────────────────────
  @Post("cleanup-images")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Eski rasmlarni tozalash (faqat ADMIN)" })
  @ApiResponse({ status: 200, description: "Tozalash natijasi" })
  async cleanupImages() {
    const deletedCount = await this.productsService.cleanupOrphanedImages();
    return {
      deletedCount,
      message: `${deletedCount} ta keraksiz rasm o'chirildi`,
    };
  }
}