import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcrypt';
import { MembershipRole } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(payload: LoginDto) {
    const email = payload.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const validPassword = await compare(payload.password, user.passwordHash);
    if (!validPassword) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const membership = user.memberships[0];
    if (!membership) {
      throw new UnauthorizedException('No organization membership found for user');
    }

    const jwtPayload = {
      sub: user.id,
      email: user.email,
      organizationId: membership.organizationId,
      role: membership.role,
    };

    const secret = this.configService.getOrThrow<string>('JWT_SECRET');
    const accessToken = await this.jwtService.signAsync(jwtPayload, {
      secret,
    });

    return {
      accessToken,
      userId: user.id,
      email: user.email,
      organizationId: membership.organizationId,
      role: membership.role,
      user: {
        id: user.id,
        email: user.email,
        organizationId: membership.organizationId,
      },
    };
  }

  async register(payload: RegisterDto) {
    const email = payload.email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered. Please use a different email or sign in.');
    }

    // Hash password
    const passwordHash = await hash(payload.password, 10);

    // Create user, organization, and membership atomically so a failure
    // at any step does not leave orphaned records in the database.
    const { user, organization, membership } = await this.prisma.$transaction(
      async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email,
            passwordHash,
          },
        });

        const newOrganization = await tx.organization.create({
          data: {
            name: payload.organizationName,
            industry: payload.industry,
          },
        });

        const newMembership = await tx.membership.create({
          data: {
            userId: newUser.id,
            organizationId: newOrganization.id,
            role: MembershipRole.OWNER,
          },
        });

        return { user: newUser, organization: newOrganization, membership: newMembership };
      },
    );

    // Generate JWT token for auto-login
    const jwtPayload = {
      sub: user.id,
      email: user.email,
      organizationId: organization.id,
      role: membership.role,
    };

    const secret = this.configService.getOrThrow<string>('JWT_SECRET');
    const accessToken = await this.jwtService.signAsync(jwtPayload, {
      secret,
    });

    return {
      accessToken,
      userId: user.id,
      email: user.email,
      organizationId: organization.id,
      role: membership.role,
      user: {
        id: user.id,
        email: user.email,
        organizationId: organization.id,
      },
    };
  }
}
