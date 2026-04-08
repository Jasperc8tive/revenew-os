import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AlertRulesService } from './alert-rules.service';

const EVERY_15_MINUTES = '0 */15 * * * *';

@Injectable()
export class AlertEvaluationScheduler {
  private readonly logger = new Logger(AlertEvaluationScheduler.name);

  constructor(private readonly alertRulesService: AlertRulesService) {}

  @Cron(EVERY_15_MINUTES)
  async evaluateScheduledAlerts() {
    try {
      const result = await this.alertRulesService.evaluateAll();
      this.logger.log(
        `Evaluated ${result.checked} active alert rules and triggered ${result.triggered} events.`,
      );
    } catch (error) {
      this.logger.error(
        `Scheduled alert evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}