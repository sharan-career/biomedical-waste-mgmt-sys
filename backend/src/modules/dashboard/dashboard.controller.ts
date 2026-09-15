import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

// No @Roles() — any authenticated user gets an appropriately scoped view (per master
// spec, Management/Accounts Manager/Super Admin all see the dashboard).
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  getSummary() {
    return this.dashboardService.getSummary();
  }
}
