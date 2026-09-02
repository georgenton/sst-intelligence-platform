import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { ApiRequest, AuthenticatedUser } from '../common/request-context';
import { requestMetadata } from '../common/request-context';
import { OrganizationContext } from '../organizations/organization-context.decorator';
import { OrganizationGuard } from '../organizations/organization.guard';
import { ConversationalActionRegistryService } from './conversational-action-registry.service';
import { ConversationalOperationsService } from './conversational-operations.service';
import {
  CreateConversationThreadDto,
  RunConversationActionDto,
  SendConversationMessageDto,
} from './dto';

type OrganizationActor = { id: string; role: string };

@ApiTags('conversational-operations')
@ApiBearerAuth()
@Controller('conversations')
@UseGuards(AccessTokenGuard, OrganizationGuard)
export class ConversationalOperationsController {
  constructor(
    private readonly conversations: ConversationalOperationsService,
    private readonly registry: ConversationalActionRegistryService,
  ) {}

  @Get('action-registry')
  actionRegistry() {
    return {
      actions: this.registry.keys(),
      providerBoundary: 'ALLOWLISTED_SERVER_ACTIONS_ONLY',
      materialWritesRequireConfirmation: true,
    };
  }

  @Get()
  list(
    @OrganizationContext() organization: OrganizationActor,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.conversations.list(organization.id, user.id);
  }

  @Post()
  create(
    @OrganizationContext() organization: OrganizationActor,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateConversationThreadDto,
  ) {
    return this.conversations.create(organization.id, user.id, body);
  }

  @Get(':threadId')
  get(
    @OrganizationContext() organization: OrganizationActor,
    @CurrentUser() user: AuthenticatedUser,
    @Param('threadId') threadId: string,
  ) {
    return this.conversations.get(organization.id, user.id, threadId);
  }

  @Post(':threadId/messages')
  message(
    @OrganizationContext() organization: OrganizationActor,
    @CurrentUser() user: AuthenticatedUser,
    @Param('threadId') threadId: string,
    @Body() body: SendConversationMessageDto,
    @Req() request: ApiRequest,
  ) {
    return this.conversations.sendMessage(
      organization,
      user.id,
      threadId,
      body,
      requestMetadata(request),
    );
  }

  @Post(':threadId/actions')
  action(
    @OrganizationContext() organization: OrganizationActor,
    @CurrentUser() user: AuthenticatedUser,
    @Param('threadId') threadId: string,
    @Body() body: RunConversationActionDto,
    @Req() request: ApiRequest,
  ) {
    return this.conversations.runAction(
      organization,
      user.id,
      threadId,
      body,
      requestMetadata(request),
    );
  }

  @Post('action-runs/:actionRunId/confirm')
  confirm(
    @OrganizationContext() organization: OrganizationActor,
    @CurrentUser() user: AuthenticatedUser,
    @Param('actionRunId') actionRunId: string,
    @Req() request: ApiRequest,
  ) {
    return this.conversations.confirm(organization, user.id, actionRunId, requestMetadata(request));
  }

  @Post('action-runs/:actionRunId/reject')
  reject(
    @OrganizationContext() organization: OrganizationActor,
    @CurrentUser() user: AuthenticatedUser,
    @Param('actionRunId') actionRunId: string,
  ) {
    return this.conversations.reject(organization.id, user.id, actionRunId);
  }
}
