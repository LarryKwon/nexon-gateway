// src/gateway/gateway.controller.ts (예시)
import {
  All,
  Controller,
  Req,
  Res,
  UseGuards,
  HttpException,
  HttpStatus,
  Get,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { HttpService } from '@nestjs/axios';
import settings from './settings';
import { Roles } from './auth/decorators/roles.decorator';
import { RolesGuard } from './auth/guards/roles.guard';
import axios from 'axios';

@Controller() // 모든 경로를 잡기 위해 prefix를 비워두거나 '/api' 등으로 설정
export class GatewayController {
  constructor(private readonly httpService: HttpService) {}

  private getServiceUrl(path: string): string | null {
    if (
      path.startsWith('/api/events') ||
      path.startsWith('/api/admin/reward-logs')
    ) {
      // AUDITOR 경로 추가
      return settings().serviceConfig().event;
    }
    if (path.startsWith('/api/auth')) {
      return settings().serviceConfig().auth;
    }
    if (path.startsWith('/api/rewards')) {
      // User의 보상 요청 경로
      return settings().serviceConfig().event;
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
    if (originalPath.startsWith('/api/admin/reward-logs')) {
      // AUDITOR 경로 재작성
      return originalPath.replace(
        '/api/admin/reward-logs',
        '/admin/reward-logs',
      ); // Event Server의 실제 경로
    }
    return originalPath;
  }

  public async proxyRequest(req: Request, res: Response, targetUrl: string) {
    const headersToForward: Record<string, string | string[]> = {};

    // 1. Host 헤더 설정 (필수)
    headersToForward['host'] = new URL(targetUrl).host;

    // 2. Authorization 헤더 전달 (원본 요청에 있는 경우)
    if (req.headers.authorization) {
      headersToForward['authorization'] = req.headers.authorization;
    }

    // 3. Content-Type 헤더 전달 (원본 요청에 있고, 요청 본문(body)이 있는 경우)
    //    POST, PUT, PATCH 등의 요청은 보통 Content-Type과 body를 가집니다.
    //    GET, DELETE는 body가 없을 수 있으므로 Content-Type도 없을 수 있습니다.
    if (
      req.body &&
      Object.keys(req.body).length > 0 &&
      req.headers['content-type']
    ) {
      headersToForward['content-type'] = req.headers['content-type'];
    } else if (
      req.body &&
      Object.keys(req.body).length > 0 &&
      !req.headers['content-type']
    ) {
      // 만약 본문은 있는데 클라이언트가 Content-Type을 보내지 않았다면,
      // Axios가 data 타입을 보고 application/json 등으로 자동 설정하거나,
      // 또는 명시적으로 application/json을 설정해 줄 수 있습니다.
      // 여기서는 클라이언트가 보낸 경우만 전달하도록 유지합니다.
      // 필요시: headersToForward['content-type'] = 'application/json; charset=utf-8';
    }

    // 4. X-Forwarded-For 헤더 추가 (프록시 표준 헤더)
    const clientIp = req.ips && req.ips.length ? req.ips[0] : req.ip;
    const xForwardedFor =
      (req.headers['x-forwarded-for']
        ? req.headers['x-forwarded-for'] + ', '
        : '') + clientIp;
    headersToForward['x-forwarded-for'] = xForwardedFor;

    // (선택) X-Real-IP 헤더 (다른 프록시를 거친 경우)
    if (req.headers['x-real-ip']) {
      headersToForward['x-real-ip'] = req.headers['x-real-ip'];
    }

    // (선택) User-Agent 헤더 (일반적으로 전달하는 것이 좋음)
    if (req.headers['user-agent']) {
      headersToForward['user-agent'] = req.headers['user-agent'];
    }

    // (선택) Accept 헤더 (클라이언트가 어떤 타입의 응답을 원하는지 명시)
    if (req.headers['accept']) {
      headersToForward['accept'] = req.headers['accept'];
    }

    // 디버깅을 위한 로그
    console.log(`[Gateway] Proxying request to: ${req.method} ${targetUrl}`);
    // console.log('[Gateway] Forwarding headers:', JSON.stringify(headersToForward, null, 2));
    // if (req.body && Object.keys(req.body).length > 0) {
    //     console.log('[Gateway] Forwarding body:', req.body);
    // }

    try {
      const axiosConfig = {
        method: req.method as any,
        url: targetUrl,
        data: req.body,
        headers: headersToForward, // 수정된 헤더 객체 사용
        params: req.query,
      };
      console.log(axiosConfig);

      const {
        data,
        headers: responseHeaders,
        status,
      } = await this.httpService.axiosRef.request(axiosConfig);

      // 클라이언트에게 반환할 응답 헤더 (필요한 것만 선별 또는 대부분 전달)
      const clientResponseHeaders: Record<string, string | string[]> = {};
      const hopByHopHeaders = [
        // 응답에서도 hop-by-hop 헤더는 제외
        'connection',
        'keep-alive',
        'proxy-authenticate',
        'proxy-authorization',
        'te',
        'trailers',
        'transfer-encoding',
        'upgrade',
      ];
      for (const key in responseHeaders) {
        if (!hopByHopHeaders.includes(key.toLowerCase())) {
          clientResponseHeaders[key] = responseHeaders[key];
        }
      }
      if (responseHeaders['content-type']) {
        // Content-Type은 중요하므로 명시적 전달
        clientResponseHeaders['content-type'] = responseHeaders['content-type'];
      }
      // Content-Length도 Axios가 자동으로 계산해주거나, responseHeaders에 있는 값을 사용
      if (responseHeaders['content-length']) {
        clientResponseHeaders['content-length'] =
          responseHeaders['content-length'];
      }

      res.status(status).set(clientResponseHeaders).send(data);
    } catch (error) {
      console.error(`[Gateway] Proxy request to ${targetUrl} FAILED`);
      if (error.response) {
        console.error('[Gateway] Error response data:', error.response.data);
        console.error(
          '[Gateway] Error response status:',
          error.response.status,
        );
        // 다운스트림 서비스의 응답을 그대로 전달하거나, 가공하여 전달
        res.status(error.response.status).json(error.response.data);
      } else if (error.request) {
        console.error(
          '[Gateway] No response received from upstream. Error:',
          error.code,
          error.message,
        );
        res.status(HttpStatus.BAD_GATEWAY).json({
          statusCode: HttpStatus.BAD_GATEWAY,
          message: `Upstream server timeout or unreachable: ${error.code || error.message}`,
          targetUrl,
        });
      } else {
        console.error(
          '[Gateway] Error setting up proxy request:',
          error.message,
        );
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: `Proxy setup error: ${error.message}`,
        });
      }
    }
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('OPERATOR', 'ADMIN')
  @All('/api/events/*')
  async proxyToEventService(@Req() req: Request, @Res() res: Response) {
    const serviceUrl = this.getServiceUrl(req.originalUrl);
    if (!serviceUrl) {
      throw new HttpException(
        'Cannot process request: Service URL not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const targetUrl = `${serviceUrl}${this.rewritePath(req.originalUrl)}`;
    await this.proxyRequest(req, res, targetUrl);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('USER')
  @All('/api/rewards/*')
  async proxyToRewardsService(@Req() req: Request, @Res() res: Response) {
    const serviceUrl = this.getServiceUrl(req.originalUrl);
    if (!serviceUrl) {
      throw new HttpException(
        'Cannot process request: Service URL not found',
        HttpStatus.NOT_FOUND,
      );
    }
    const targetPath = req.originalUrl.replace('/api/rewards', '/rewards'); // 실제 서비스의 경로로 변경
    const targetUrl = `${serviceUrl}${targetPath}`;

    await this.proxyRequest(req, res, targetUrl);
  }

  // --- AUDITOR (및 OPERATOR, ADMIN)를 위한 보상 요청 내역 조회 ---
  // "운영자 / 감사자 / 관리자는 전체 유저의 요청 기록을 조회할 수 있어야 합니다."
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('AUDITOR', 'OPERATOR', 'ADMIN') // AUDITOR, OPERATOR, ADMIN 접근 가능
  @Get('/api/admin/reward-logs') // GET 요청으로 보상 이력 조회
  async getRewardLogs(@Req() req: Request, @Res() res: Response) {
    const serviceUrl = this.getServiceUrl(req.originalUrl);
    if (!serviceUrl) {
      throw new HttpException(
        'Cannot process request: Service URL not found for reward logs',
        HttpStatus.NOT_FOUND,
      );
    }
    // Event Server에서는 이 경로가 /admin/reward-logs (예시) 일 수 있음
    const targetUrl = `${serviceUrl}${this.rewritePath(req.originalUrl)}`;
    await this.proxyRequest(req, res, targetUrl);
  }

  @All('/api/auth/*')
  async proxyToAuthService(@Req() req: Request, @Res() res: Response) {
    const serviceUrl = this.getServiceUrl(req.originalUrl);
    if (!serviceUrl) {
      throw new HttpException(
        'Cannot process request: Service URL not found',
        HttpStatus.NOT_FOUND,
      );
    }
    const targetUrl = `${serviceUrl}${this.rewritePath(req.originalUrl)}`;
    console.log(targetUrl);
    await this.proxyRequest(req, res, targetUrl);
  }
}
