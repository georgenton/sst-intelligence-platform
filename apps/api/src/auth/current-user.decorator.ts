import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { ApiRequest } from '../common/request-context';

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const user = context.switchToHttp().getRequest<ApiRequest>().user;
  if (!user) throw new Error('Authenticated user was not resolved');
  return user;
});
