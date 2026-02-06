import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from "bcrypt";

import { UserEntity } from "../../user/entities/user.entity"; // sizda path boshqacha bo‘lishi mumkin
import { UserRole } from "../../common/dto/roles.enum"; // sizda enum nomi boshqacha bo‘lishi mumkin

@Injectable()
export class BootstrapAdminService implements OnModuleInit {
  private readonly logger = new Logger(BootstrapAdminService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    // faqat development/test/prod ham bo‘lishi mumkin.
    // Siz xohlasangiz bu joyga shart qo‘shib qo‘yishingiz mumkin.

    const adminExists = await this.usersRepo
  .createQueryBuilder("u")
  .withDeleted()
  .where("u.role = :role", { role: "ADMIN" })
  .getExists();

    if (adminExists) {
      this.logger.log("Admin already exists. Bootstrap skipped.");
      return;
    }

    const username = process.env.BOOTSTRAP_ADMIN_USERNAME;
    const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

    const firstName = process.env.BOOTSTRAP_ADMIN_FIRST_NAME || "System";
    const lastName = process.env.BOOTSTRAP_ADMIN_LAST_NAME || "Admin";

    if (!username || !email || !password) {
      this.logger.warn(
        "No ADMIN found, but bootstrap admin env variables are missing. Skipping bootstrap.",
      );
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const admin = this.usersRepo.create({
      username,
      email,
      password: passwordHash,
      firstName,
      lastName,
      role: UserRole.ADMIN,
      isActive: true,
    });

    await this.usersRepo.save(admin);

    this.logger.log("Bootstrap ADMIN created successfully.");
    this.logger.warn(
      `Bootstrap credentials: username=${username}, email=${email}`,
    );
  }
}
