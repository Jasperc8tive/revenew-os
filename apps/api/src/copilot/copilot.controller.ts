import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { ConversationQueryDto, ChatMessageDto, CreateConversationDto } from './dto/copilot.dto';
import { CopilotService } from './copilot.service';

@UseGuards(JwtGuard)
@Controller('copilot')
export class CopilotController {
  constructor(private readonly copilotService: CopilotService) {}

  @Post('conversations')
  createConversation(@Body() body: CreateConversationDto) {
    return this.copilotService.createConversation(body);
  }

  @Get('conversations/:id')
  getConversation(@Param('id') id: string, @Query() query: ConversationQueryDto) {
    return this.copilotService.getConversation(id, query.organizationId);
  }

  @Post('conversations/:id/messages')
  chat(@Param('id') id: string, @Body() body: ChatMessageDto) {
    return this.copilotService.chat({
      conversationId: id,
      organizationId: body.organizationId,
      content: body.content,
    });
  }
}
