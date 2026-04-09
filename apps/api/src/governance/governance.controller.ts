import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtGuard } from '../common/guards/jwt.guard';
import {
  CreateQualityGateDto,
  CreateReleaseRolloutDto,
  CreateRiskDto,
  GovernanceOrgQueryDto,
  UpsertWeeklyReviewDto,
} from './dto/governance.dto';
import { GovernanceService } from './governance.service';

@UseGuards(JwtGuard)
@Controller('governance')
export class GovernanceController {
  constructor(private readonly governanceService: GovernanceService) {}

  private getActorUserId(req: Request) {
    return (req as Request & { user?: { id?: string } }).user?.id ?? 'system-user';
  }

  @Get('weekly-reviews')
  weeklyReviews(@Req() req: Request, @Query() query: GovernanceOrgQueryDto) {
    return this.governanceService.listWeeklyReviews(query.organizationId, this.getActorUserId(req));
  }

  @Post('weekly-reviews')
  upsertWeeklyReview(
    @Req() req: Request,
    @Body() body: UpsertWeeklyReviewDto,
  ) {
    return this.governanceService.upsertWeeklyReview({
      organizationId: body.organizationId,
      phase: body.phase,
      workstream: body.workstream,
      evidence: body.evidence,
      blocker: body.blocker,
      actorUserId: this.getActorUserId(req),
    });
  }

  @Get('risks')
  risks(@Req() req: Request, @Query() query: GovernanceOrgQueryDto) {
    return this.governanceService.listRisks(query.organizationId, this.getActorUserId(req));
  }

  @Post('risks')
  createRisk(@Req() req: Request, @Body() body: CreateRiskDto) {
    return this.governanceService.createRisk({
      organizationId: body.organizationId,
      title: body.title,
      level: body.level,
      owner: body.owner,
      mitigation: body.mitigation,
      active: body.active,
      actorUserId: this.getActorUserId(req),
    });
  }

  @Post('quality-gates')
  qualityGates(@Req() req: Request, @Body() body: CreateQualityGateDto) {
    return this.governanceService.upsertQualityGate({
      organizationId: body.organizationId,
      feature: body.feature,
      testsPassed: body.testsPassed,
      observabilityReady: body.observabilityReady,
      rollbackReady: body.rollbackReady,
      actorUserId: this.getActorUserId(req),
    });
  }

  @Post('release-rollouts')
  releaseRollout(@Req() req: Request, @Body() body: CreateReleaseRolloutDto) {
    return this.governanceService.createReleaseRollout({
      organizationId: body.organizationId,
      feature: body.feature,
      stage: body.stage,
      canaryValidated: body.canaryValidated,
      notes: body.notes,
      actorUserId: this.getActorUserId(req),
    });
  }
}
