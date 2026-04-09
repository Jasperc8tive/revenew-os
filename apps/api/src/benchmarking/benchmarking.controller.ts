import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { BenchmarkAggregationService } from './benchmark-aggregation.service';
import { BenchmarkingService } from './benchmarking.service';
import { BenchmarkQueryDto } from './dto/benchmark-query.dto';

@Controller('benchmarks')
@UseGuards(JwtGuard)
export class BenchmarkingController {
  constructor(
    private readonly benchmarkingService: BenchmarkingService,
    private readonly benchmarkAggregationService: BenchmarkAggregationService,
  ) {}

  @Get()
  async getBenchmarks(@Query() query: BenchmarkQueryDto) {
    return this.benchmarkingService.getBenchmarks(query);
  }

  @Get('deep')
  async getDeepBenchmarks(@Query() query: BenchmarkQueryDto) {
    return this.benchmarkingService.getDeepBenchmarks(query);
  }

  @Post('aggregate')
  async aggregateBenchmarks(
    @Body('startDate') startDate?: string,
    @Body('endDate') endDate?: string,
  ) {
    return this.benchmarkAggregationService.aggregate({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }
}
