import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma';

type UserRole = 'user' | 'customer';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key',
    });
  }

  async validate(payload: {
    sub: string;
    username: string;
    email: string;
    role: UserRole;
  }) {
    if (payload.role === 'customer') {
      const customer = await this.prisma.customer.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          companyName: true,
          contactPersonName: true,
          email: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!customer) {
        throw new UnauthorizedException();
      }

      return {
        ...customer,
        username: customer.companyName,
        role: 'customer' as UserRole,
      };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    return { ...user, role: 'user' as UserRole };
  }
}
