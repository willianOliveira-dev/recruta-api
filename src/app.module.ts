import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health/health.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';

@Module({
  imports: [DatabaseModule, HealthModule, OrganizationsModule],
})
export class AppModule {}
