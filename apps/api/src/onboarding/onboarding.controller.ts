import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { OnboardingQueryDto } from './dto/onboarding-query.dto';
import { UpdateOnboardingStepDto } from './dto/update-onboarding-step.dto';
import { OnboardingService } from './onboarding.service';

@UseGuards(JwtGuard)
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('progress')
  getProgress(@Query() query: OnboardingQueryDto) {
    return this.onboardingService.getProgress(query.organizationId);
  }

  @Patch('steps/:step')
  updateStep(
    @Param('step') step: string,
    @Query() query: OnboardingQueryDto,
    @Body() body: UpdateOnboardingStepDto,
  ) {
    return this.onboardingService.updateStep(
      query.organizationId,
      step as Parameters<OnboardingService['updateStep']>[1],
      body.completed,
    );
  }

  @Get('gates')
  async getGates(@Query() query: OnboardingQueryDto) {
    const progress = await this.onboardingService.getProgress(query.organizationId);
    return {
      organizationId: query.organizationId,
      gates: progress.gates,
      progress: progress.progress,
    };
  }
}
