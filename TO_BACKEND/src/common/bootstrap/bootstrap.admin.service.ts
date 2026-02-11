// src/common/bootstrap/bootstrap-admin.service.ts
import {
  ConflictException,
  Injectable,
  Logger,
  OnModuleInit,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from "bcrypt";

import { UserEntity } from "../../user/entities/user.entity";
import { UserRole } from "../../common/dto/roles.enum";
import { CreateUserDto } from "../../user/dto/create-user.dto";

@Injectable()
export class BootstrapAdminService implements OnModuleInit {
  private readonly logger = new Logger(BootstrapAdminService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
  ) {}

  async onModuleInit() {
    const admin = await this.usersRepo.findOne({
      where: { role: UserRole.ADMIN },
    });

    if (admin) {
      this.logger.log("Admin mavjud");
      return;
    }

    const fullName = process.env.BOOTSTRAP_ADMIN_FULLNAME || "Admin";
    const phone = process.env.BOOTSTRAP_ADMIN_PHONE || "+998000000000";
    const plainPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;

    if (!plainPassword) {
      this.logger.warn(
        "BOOTSTRAP_ADMIN_PASSWORD .env da topilmadi. Admin yaratilmadi.",
      );
      return;
    }

    const hashedPassword = await bcrypt.hash(plainPassword, 12);

    const newAdmin = this.usersRepo.create({
      fullName,
      phone,
      password: hashedPassword,
      role: UserRole.ADMIN,
      isActive: true,
    });

    await this.usersRepo.save(newAdmin);

    this.logger.log(
      `Admin yaratildi: fullName=${fullName}, phone=${phone}`,
    );
  }

  async create(dto: CreateUserDto) {
    // Phone bo'yicha tekshirish (phone unique)
    const existingUser = await this.usersRepo.findOne({
      where: { phone: dto.phone },
      withDeleted: true,
    });

    if (existingUser) {
      throw new ConflictException("Bu telefon raqami bilan foydalanuvchi mavjud");
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const user = this.usersRepo.create({
      fullName: dto.fullName, // ✅ TO'G'RI
      phone: dto.phone,
      password: hashedPassword,
      role: dto.role || UserRole.SALER,
      isActive: dto.isActive ?? true,
    });

    return await this.usersRepo.save(user);
  }
}