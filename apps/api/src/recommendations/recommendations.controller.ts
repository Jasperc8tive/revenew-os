import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import {
  DEFAULT_RECOMMENDATION_GUARDRAILS,
  RecommendationsService,
} from './recommendations.service';
import { EvaluateRecommendationGuardrailsDto } from './dto/evaluate-guardrails.dto';

@Controller('recommendations')
@UseGuards(JwtGuard)
export class RecommendationsController {
  constructor(private readonly recommendationsService: RecommendationsService) {}

  @Post('guardrails/evaluate')
  evaluateGuardrails(@Body() body: EvaluateRecommendationGuardrailsDto) {
    const decision = this.recommendationsService.evaluateGuardrails(body);

    return {
      policy: DEFAULT_RECOMMENDATION_GUARDRAILS,
      input: body,
      decision,
    };
  }
}
