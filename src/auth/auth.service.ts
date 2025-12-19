import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET;

@Injectable()
export class AuthService {
  constructor() {} // Removida a dependência do UserModel

  async validateUser(token: string) {
    try {
      if (!SECRET || typeof SECRET !== 'string') {
        throw new HttpException('JWT secret is not defined', 500);
      }

      if (!token) {
        throw new HttpException('Token not provided', 401);
      }

      // ✅ Apenas verifica se o token é válido
      const decoded = jwt.verify(token, SECRET);

      // ✅ Retorna o payload decodificado (sem buscar no banco)
      return decoded;
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        throw new HttpException('Invalid token format', 401);
      }

      if (error.name === 'TokenExpiredError') {
        throw new HttpException('Token expired', 401);
      }

      throw new HttpException('Invalid token', 401);
    }
  }
}
