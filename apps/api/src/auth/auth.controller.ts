import { Body, Controller, Post, HttpCode } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthService } from './auth.service';
import { Public } from '../common/decorators/public.decorator';

@Public()
@Throttle({ default: { ttl: 60_000, limit: 10 } })
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Post('register')
  @HttpCode(201)
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }
}
