import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let errorCode = 'INTERNAL_SERVER_ERROR';
    let errorMessage = 'Đã xảy ra lỗi nội bộ máy chủ';
    let errorDetails: any = null;

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        errorMessage = exceptionResponse;
        errorCode = exception.name || 'HTTP_ERROR';
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as any;
        errorMessage = Array.isArray(resp.message) ? resp.message.join(', ') : resp.message || exception.message;
        errorCode = resp.error || exception.name || 'HTTP_ERROR';
        errorDetails = resp.details || (Array.isArray(resp.message) ? resp.message : null);
      }
    } else if (exception instanceof Error) {
      errorMessage = exception.message;
      errorCode = exception.name;
    }

    response.status(status).json({
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
        details: errorDetails,
      },
      meta: {
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    });
  }
}
