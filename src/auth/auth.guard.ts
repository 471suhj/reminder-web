import { CanActivate, ExecutionContext, Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { HttpArgumentsHost } from '@nestjs/common/interfaces';
import { Reflector } from '@nestjs/core';
import { AuthDec } from './auth.decorator';
import { Request, Response } from 'express';
import { MysqlService } from '../mysql/mysql.service';
import mysql from 'mysql2/promise';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private reflector: Reflector, private mysqlService: MysqlService){}
  readonly #strTokenCookie = '__Host-Http-userToken';

  private readonly logger = new Logger('auth guard');

  async inspectToken(token: string): Promise<false|number>{
    const pool: mysql.Pool = await this.mysqlService.getSQL();
    let result: mysql.RowDataPacket[];
    [result] = await pool.execute<mysql.RowDataPacket[]>('select user_serial from session where token=?', [token]);
    if (result.length <= 0){
      return false;
    }
    if (result.length >= 2){
      this.logger.error('two or more sessions on token=' + token);
      return false; // for security
    }
    return result[0]['user_serial'] as number;
  }

  getToken(request: Request){
    return request.cookies[this.#strTokenCookie];
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() === 'http'){
      const authVal: string = this.reflector.getAllAndOverride(AuthDec, [context.getHandler(), context.getClass()]);
      const ctx: HttpArgumentsHost = context.switchToHttp();
      const request: Request = ctx.getRequest<Request>();
      const response: Response = ctx.getResponse<Response>();
      const token: undefined|string = request.cookies[this.#strTokenCookie];
      let user: false|number;
      if (token){
        user = await this.inspectToken(token);
      } else {
        user = false;
      }
      if (authVal === 'anony-only'){
        if (user){
          response.redirect('/home');
          return false;
        } else {
          return true;
        }
      } else {
        if (user){
          request['user'] = user;
          return true;
        } else {
          response.redirect('/');
          return false;
        }
      }
    } else {
      return true;
    }
  }
}
