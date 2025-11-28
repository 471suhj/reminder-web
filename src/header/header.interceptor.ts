import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Response } from 'express';

@Injectable()
export class HeaderInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      tap(function(){
        if (context.getType() === 'http'){
          context.switchToHttp().getResponse<Response>().set('Cache-Control', 'private, no-cache');
        }
        console.log('abcdefg');
      })
    );
  }
}
