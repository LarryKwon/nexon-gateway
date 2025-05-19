// src/gateway/gateway.controller.ts (예시)
import {All, Controller, Req, Res, UseGuards, HttpException, HttpStatus, Get} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import settings from "./settings";
import {Roles} from "./auth/decorators/roles.decorator";
import {RolesGuard} from "./auth/guards/roles.guard";

@Controller() // 모든 경로를 잡기 위해 prefix를 비워두거나 '/api' 등으로 설정
export class GatewayController {
  constructor(
    private readonly httpService: HttpService,
  ) {}

  private getServiceUrl(path: string): string | null {
    if (path.startsWith('/api/events') || path.startsWith('/api/admin/reward-logs')) { // AUDITOR 경로 추가
      return settings().serviceConfig().event
    }
    if (path.startsWith('/api/auth')) {
      return settings().serviceConfig().auth
    }
    if (path.startsWith('/api/rewards')) { // User의 보상 요청 경로
      return settings().serviceConfig().event
    }
    return null;
  }

  private rewritePath(originalPath: string): string {
    if (originalPath.startsWith('/api/events')) {
      return originalPath.replace('/api/events', '/events');
    }
    if (originalPath.startsWith('/api/auth')) {
      return originalPath.replace('/api/auth', '/auth');
    }
    if (originalPath.startsWith('/api/rewards')) {
      return originalPath.replace('/api/rewards', '/rewards');
    }
    if (originalPath.startsWith('/api/admin/reward-logs')) { // AUDITOR 경로 재작성
      return originalPath.replace('/api/admin/reward-logs', '/admin/reward-logs'); // Event Server의 실제 경로
    }
    return originalPath;
  }

  // Helper method for proxying
  private async proxyRequest(req: Request, res: Response, targetUrl: string) {
    try {
      const { data, headers, status } = await firstValueFrom(
        this.httpService.request({
          method: req.method as any,
          url: targetUrl,
          data: req.body,
          headers: { ...req.headers, host: new URL(targetUrl).host },
          params: req.query,
        }),
      );
      res.status(status).set(headers).send(data);
    } catch (error) {
      const status = error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
      const message = error.response?.data || `Error proxying to ${targetUrl}`;
      throw new HttpException(typeof message === 'string' ? message : 'Proxying error', status);
    }
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('OPERATOR', 'ADMIN')
  @All('/api/events*')
  async proxyToEventService(@Req() req: Request, @Res() res: Response) {
    const serviceUrl = this.getServiceUrl(req.originalUrl);
    if (!serviceUrl) {
      throw new HttpException('Cannot process request: Service URL not found', HttpStatus.NOT_FOUND);
    }

    const targetUrl = `${serviceUrl}${this.rewritePath(req.originalUrl)}`;
    await this.proxyRequest(req,res,targetUrl);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('USER')
  @All('/api/rewards*') // 가상의 보상 요청 경로
  async proxyToRewardsService(@Req() req: Request, @Res() res: Response) {
    const serviceUrl = settings().serviceConfig().event;
    if (!serviceUrl) {
      throw new HttpException('Cannot process request: Service URL not found', HttpStatus.NOT_FOUND);
    }
    const targetPath = req.originalUrl.replace('/api/rewards', '/rewards'); // 실제 서비스의 경로로 변경
    const targetUrl = `${serviceUrl}${targetPath}`;

    await this.proxyRequest(req,res,targetUrl);
  }

  // --- AUDITOR (및 OPERATOR, ADMIN)를 위한 보상 요청 내역 조회 ---
  // "운영자 / 감사자 / 관리자는 전체 유저의 요청 기록을 조회할 수 있어야 합니다." [cite: 25]
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('AUDITOR', 'OPERATOR', 'ADMIN') // AUDITOR, OPERATOR, ADMIN 접근 가능
  @Get('/api/admin/reward-logs') // GET 요청으로 보상 이력 조회
  async getRewardLogs(@Req() req: Request, @Res() res: Response) {
    const serviceUrl = this.getServiceUrl(req.originalUrl);
    if (!serviceUrl) {
      throw new HttpException('Cannot process request: Service URL not found for reward logs', HttpStatus.NOT_FOUND);
    }
    // Event Server에서는 이 경로가 /admin/reward-logs (예시) 일 수 있음
    const targetUrl = `${serviceUrl}${this.rewritePath(req.originalUrl)}`;
    await this.proxyRequest(req, res, targetUrl);
  }

  @All('/api/auth*')
  async proxyToAuthService(@Req() req: Request, @Res() res: Response) {
    const serviceUrl = this.getServiceUrl(req.originalUrl);
    if (!serviceUrl) {
      throw new HttpException('Cannot process request: Service URL not found', HttpStatus.NOT_FOUND);
    }
    const targetUrl = `${serviceUrl}${this.rewritePath(req.originalUrl)}`;
    await this.proxyRequest(req,res,targetUrl);
  }
}