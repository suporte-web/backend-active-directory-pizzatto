// src/ad/ad-user.controller.ts
import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { UserAdService } from './userAd.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';

@ApiTags('Ad-Users')
@Controller('ad-users')
@UseGuards(AuthGuard)
export class UserAdController {
  constructor(private readonly adUserService: UserAdService) {}

  @Post('create-user-ad')
  @ApiOperation({ summary: 'Cria o Usuario na Active Directory' })
  async createUserAd(@Body() body: any) {
    return await this.adUserService.createUser(body);
  }

  @Get('get-all-users-ad')
  @ApiOperation({ summary: 'Encontra todos os Usuarios do AD' })
  async getAllUsersAd() {
    return await this.adUserService.getAllUsers();
  }

  @Post('get-users-ad-by-filter')
  @ApiOperation({ summary: 'Encontra Usuarios do AD filtrando' })
  async getUsersPaginated(@Body() body: any) {
    return await this.adUserService.getUsersPaginated(body);
  }

  @Post('update')
  @ApiOperation({ summary: 'Atualiza as informações do Usuario no AD' })
  async updateUser(@Body() body: any) {
    return await this.adUserService.updateUserAd(body);
  }

  @Get('groups')
  @ApiOperation({ summary: 'Encontra todos os Grupos no AD' })
  async getGroups() {
    return await this.adUserService.getAllGroups();
  }

  @Get('get-all-users-for-manager')
  @ApiOperation({ summary: 'Encontra todos os Usuarios no AD para Gestor' })
  async getAllUsersForManager() {
    return await this.adUserService.getAllUsersForManager();
  }

  @Post('reset-password')
  @ApiOperation({
    summary:
      'Reseta a senha de Usuario no AD e força troca quando entrar novamente',
  })
  async resetPasswordAndForceChange(@Body() body: any) {
    return await this.adUserService.resetPasswordAndForceChange(body);
  }

  @Patch('enable')
  async enableUserAd(@Body() body: any) {
    return await this.adUserService.enableUserAd(body);
  }

  @Patch('disable')
  async disableUserAd(@Body() body: any) {
    return await this.adUserService.disableUserAd(body);
  }

  @Get('get-all-setores-users-ad')
  @ApiOperation({
    summary: 'Encontra todos os setores dos colaboradores no AD',
  })
  async getAllSetoresUsersAd() {
    return await this.adUserService.getAllSetoresUsersAd();
  }

  @Get('get-all-users-ad-actives')
  @ApiOperation({
    summary: 'Encontra todos os setores dos colaboradores no AD',
  })
  async getAllActiveUsers() {
    return await this.adUserService.getAllActiveUsers();
  }
}
