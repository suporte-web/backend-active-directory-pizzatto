import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    if (!request.headers.authorization) {
      return false;
    }

    const token = request.headers.authorization.split(' ')[1];

    try {
      const userPayload = await this.authService.validateUser(token);

      // Salva o payload do usuário na request
      request.user = userPayload;
      return true;
    } catch (error) {
      console.log('🚨 AuthGuard: Token inválido -', error.message);
      return false;
    }
  }
}
