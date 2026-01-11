import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma';
import { RegisterDto, LoginDto } from './dto';

export type UserRole = 'user' | 'customer';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { username: dto.username }],
      },
    });

    if (existingUser) {
      throw new ConflictException(
        'User with this email or username already exists',
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email,
        password: hashedPassword,
      },
    });

    const token = this.generateToken(
      user.id,
      user.username,
      user.email,
      'user',
    );

    return {
      message: 'User created successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: 'user' as UserRole,
      },
      token,
    };
  }

  async login(dto: LoginDto) {
    // First try to find a user
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (user) {
      const isPasswordValid = await bcrypt.compare(dto.password, user.password);

      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const token = this.generateToken(
        user.id,
        user.username,
        user.email,
        'user',
      );

      return {
        message: 'Login successful',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: 'user' as UserRole,
        },
        token,
      };
    }

    // If no user found, try to find a customer
    const customer = await this.prisma.customer.findFirst({
      where: { email: dto.email },
    });

    if (!customer) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      customer.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.generateToken(
      customer.id,
      customer.companyName,
      customer.email,
      'customer',
    );

    return {
      message: 'Login successful',
      user: {
        id: customer.id,
        username: customer.companyName,
        email: customer.email,
        role: 'customer' as UserRole,
        companyName: customer.companyName,
        contactPersonName: customer.contactPersonName,
      },
      token,
    };
  }

  async validateUser(userId: string, role: UserRole) {
    if (role === 'customer') {
      const customer = await this.prisma.customer.findUnique({
        where: { id: userId },
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
        throw new UnauthorizedException('Customer not found');
      }

      return {
        ...customer,
        username: customer.companyName,
        role: 'customer' as UserRole,
      };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return { ...user, role: 'user' as UserRole };
  }

  private generateToken(
    userId: string,
    username: string,
    email: string,
    role: UserRole,
  ) {
    const payload = { sub: userId, username, email, role };
    return this.jwtService.sign(payload);
  }
}
