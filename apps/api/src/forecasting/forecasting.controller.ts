import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { ForecastingService } from './forecasting.service';
import { SimulateDto } from './dto/simulate.dto';

@UseGuards(JwtGuard)
@Controller('forecasting')
export class ForecastingController {
  constructor(private readonly forecastingService: ForecastingService) {}

  @Post('simulate')
  simulate(@Body() dto: SimulateDto) {
    return this.forecastingService.simulate(dto);
  }

  @Post('scenarios')
  simulateScenarios(@Body() dto: SimulateDto) {
    return this.forecastingService.simulateScenarios(dto);
  }
}
