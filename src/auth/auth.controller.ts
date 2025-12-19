import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { User } from './decorator/user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('validate-token')
  async validateToken(@Body() body: { token: string }) {
    try {
      const payload = await this.authService.validateUser(body.token);
      return {
        valid: true,
        payload: payload,
        message: 'Token válido',
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
        message: 'Token inválido',
      };
    }
  }

  @Get('me')
  @ApiOperation({ summary: 'Retorna o usuário logado' })
  @UseGuards(AuthGuard)
  async me(@User() user) {
    return user;
  }
}
