import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ResponseEnvelope<T> {
  success: boolean;
  data: T;
  meta?: any;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ResponseEnvelope<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ResponseEnvelope<T>> {
    return next.handle().pipe(
      map((res) => {
        // Nếu response đã là envelope
        if (res && typeof res === 'object' && 'success' in res && 'data' in res) {
          return res;
        }

        // Nếu response có meta phân trang
        if (res && typeof res === 'object' && 'items' in res && 'total' in res) {
          const { items, ...meta } = res;
          return {
            success: true,
            data: items,
            meta,
          };
        }

        return {
          success: true,
          data: res,
          meta: {
            timestamp: new Date().toISOString(),
          },
        };
      }),
    );
  }
}
