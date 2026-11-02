import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status =
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
        errorDetails = resp.details || (resp.blockers ? { blockers: resp.blockers, studentId: resp.studentId } : null) || (Array.isArray(resp.message) ? resp.message : null);
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const known: Record<string, [number, string]> = { P2002: [409, 'Mã hoặc thông tin định danh đã tồn tại'], P2025: [404, 'Không tìm thấy dữ liệu'], P2003: [400, 'Dữ liệu không tồn tại hoặc đang được sử dụng; hãy kiểm tra các liên kết'] };
      const mapped = known[exception.code];
      if (mapped) { status = mapped[0]; errorMessage = mapped[1]; errorCode = exception.code; }
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
