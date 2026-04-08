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
		const integrations = await this.prisma.integration.findMany({
			where: {
				status: IntegrationStatus.ACTIVE,
			},
		});

		await Promise.all(
			integrations.map((integration) =>
				this.integrationsService.enqueueSync(integration.organizationId, integration.id),
			),
		);

		this.logger.log(`Queued ${integrations.length} active integrations for sync.`);
	}
}
