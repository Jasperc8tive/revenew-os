import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const Org = createParamDecorator((_: unknown, context: ExecutionContext) => {
	const request = context.switchToHttp().getRequest();
	return request.body?.organizationId ?? request.query?.organizationId ?? request.params?.organizationId;
});
