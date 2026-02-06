import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { BootstrapAdminService } from "./bootstrap.admin.service";
import { UserEntity } from "../../user/entities/user.entity";

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  providers: [BootstrapAdminService],
})
export class BootstrapModule {}
