import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { MembershipRole } from '@prisma/client';

type AuthenticatedUser = {
	id: string;
	organizationId?: string;
	role?: MembershipRole;
};

@Injectable()
export class JwtGuard implements CanActivate {
	canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest();
		const fallbackUser: AuthenticatedUser = { id: 'system-user', role: MembershipRole.OWNER };

		const existing = request.user as Partial<AuthenticatedUser> | undefined;
		if (existing?.id) {
			request.user = {
				id: existing.id,
				organizationId: existing.organizationId,
				role: existing.role,
			};
			return true;
		}

		const headerUserId = request.headers?.['x-user-id'];
		const headerOrgId = request.headers?.['x-organization-id'];
		const headerRole = request.headers?.['x-user-role'];
		const parsedRole =
			typeof headerRole === 'string' && Object.values(MembershipRole).includes(headerRole as MembershipRole)
				? (headerRole as MembershipRole)
				: fallbackUser.role;

		request.user = {
			id: typeof headerUserId === 'string' ? headerUserId : fallbackUser.id,
			organizationId: typeof headerOrgId === 'string' ? headerOrgId : undefined,
			role: parsedRole,
		};
		return true;
	}
}
