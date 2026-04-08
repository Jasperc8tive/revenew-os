import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import {
  CreateAlertRuleDto,
  DeleteAlertRuleQueryDto,
  ListAlertEventsQueryDto,
  ListAlertRulesQueryDto,
} from './dto/alert-rule.dto';
import { AlertRulesService } from './alert-rules.service';

@Controller('alerts')
@UseGuards(JwtGuard)
export class NotificationsController {
  constructor(private readonly alertRulesService: AlertRulesService) {}

  @Post('rules')
  async createRule(@Body() body: CreateAlertRuleDto) {
    return this.alertRulesService.createRule(body);
  }

  @Get('rules')
  async listRules(@Query() query: ListAlertRulesQueryDto) {
    return this.alertRulesService.listRules(query);
  }

  @Delete('rules/:id')
  async deleteRule(@Param('id') id: string, @Query() query: DeleteAlertRuleQueryDto) {
    return this.alertRulesService.deleteRule(id, query.organizationId);
  }

  @Get('events')
  async listEvents(@Query() query: ListAlertEventsQueryDto) {
    return this.alertRulesService.listEvents(query);
  }

  @Post('evaluate')
  async evaluateAll() {
    return this.alertRulesService.evaluateAll();
  }
}
