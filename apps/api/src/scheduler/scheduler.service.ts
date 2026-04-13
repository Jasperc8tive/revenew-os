import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IntegrationStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { IntegrationsService } from '../integrations/integrations.service';

@Injectable()
export class IntegrationSyncScheduler {
	private readonly logger = new Logger(IntegrationSyncScheduler.name);

	constructor(
		private readonly prisma: PrismaService,
		private readonly integrationsService: IntegrationsService,
	) {}

	@Cron(CronExpression.EVERY_30_MINUTES)
	async enqueueScheduledSyncs() {
		let integrations: Awaited<ReturnType<typeof this.prisma.integration.findMany>>;

		try {
			integrations = await this.prisma.integration.findMany({
				where: { status: IntegrationStatus.ACTIVE },
			});
		} catch (err) {
			this.logger.error('Failed to fetch active integrations for scheduled sync', err);
			return;
		}

		if (integrations.length === 0) {
			return;
		}

		const results = await Promise.allSettled(
			integrations.map((integration) =>
				this.integrationsService.enqueueSync(integration.organizationId, integration.id),
			),
		);

		const succeeded = results.filter((r) => r.status === 'fulfilled').length;
		const failed = results.filter((r) => r.status === 'rejected').length;

		for (let i = 0; i < results.length; i++) {
			const result = results[i];
			if (result.status === 'rejected') {
				this.logger.error(
					`Failed to enqueue sync for integration ${integrations[i].id} ` +
						`(org: ${integrations[i].organizationId})`,
					result.reason,
				);
			}
		}

		this.logger.log(
			`Scheduled sync: ${succeeded} enqueued, ${failed} failed out of ${integrations.length} active integrations.`,
		);
	}
}
