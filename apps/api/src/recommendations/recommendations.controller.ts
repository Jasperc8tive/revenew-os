import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { BillingAccessService } from '../billing/billing-access.service';
import {
  DEFAULT_RECOMMENDATION_GUARDRAILS,
  RecommendationsService,
} from './recommendations.service';
import { EvaluateRecommendationGuardrailsDto } from './dto/evaluate-guardrails.dto';
import { ListRecommendationsDto } from './dto/list-recommendations.dto';
import { UpdateRecommendationStatusDto } from './dto/update-recommendation-status.dto';

@Controller('recommendations')
@UseGuards(JwtGuard)
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
    private readonly billingAccessService: BillingAccessService,
  ) {}

  @Get()
  async list(@Query() query: ListRecommendationsDto) {
    await this.billingAccessService.assertFeatureAccess(query.organizationId, 'analytics.full');

    return this.recommendationsService.listRecommendations(query);
  }

  @Post('guardrails/evaluate')
  async evaluateGuardrails(@Body() body: EvaluateRecommendationGuardrailsDto) {
    const decision = this.recommendationsService.evaluateGuardrails(body);

    return {
      policy: DEFAULT_RECOMMENDATION_GUARDRAILS,
      input: body,
      decision,
    };
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateRecommendationStatusDto,
  ) {
    await this.billingAccessService.assertFeatureAccess(body.organizationId, 'analytics.full');

    return this.recommendationsService.transitionRecommendationStatus({
      recommendationId: id,
      organizationId: body.organizationId,
      status: body.status,
      impactSummary: body.impactSummary,
    });
  }
}
