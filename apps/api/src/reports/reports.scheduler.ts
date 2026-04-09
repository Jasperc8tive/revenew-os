import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ReportsService } from './reports.service';

const EVERY_30_MINUTES = '0 */30 * * * *';

@Injectable()
export class ReportsScheduler {
  private readonly logger = new Logger(ReportsScheduler.name);

  constructor(private readonly reportsService: ReportsService) {}

  @Cron(EVERY_30_MINUTES)
  async runScheduledReports() {
    try {
      const result = await this.reportsService.runDueSchedules();
      this.logger.log(
        `Checked ${result.checked} report schedules and triggered ${result.triggered} runs.`,
      );
    } catch (error) {
      this.logger.error(
        `Report schedule execution failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
