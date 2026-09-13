import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

const STATUS_CODE_NAMES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE_ENTITY',
  500: 'INTERNAL_ERROR',
};

/**
 * Normalizes every thrown error (NestJS HttpExceptions, Prisma errors, anything else)
 * into the standard { error: { code, message, details? } } shape from
 * docs/API_ARCHITECTURE.md §4 — no route should ever leak a raw stack trace or a
 * differently-shaped error body.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const { status, body } = this.resolve(exception);

    if (status >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.stack : exception,
      );
    }

    response.status(status).json(body);
  }

  private resolve(exception: unknown): { status: number; body: ErrorEnvelope } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();

      let message = exception.message;
      let details: unknown;

      if (typeof res === 'object' && res !== null) {
        const r = res as Record<string, unknown>;
        if (Array.isArray(r.message)) {
          details = r.message;
          message = 'Validation failed';
        } else if (typeof r.message === 'string') {
          message = r.message;
        }
      }

      return {
        status,
        body: {
          error: {
            code: STATUS_CODE_NAMES[status] ?? exception.constructor.name,
            message,
            details,
          },
        },
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return {
          status: HttpStatus.CONFLICT,
          body: {
            error: {
              code: 'DUPLICATE_VALUE',
              message: `A record with this ${(exception.meta?.target as string[] | undefined)?.join(', ') ?? 'value'} already exists`,
            },
          },
        };
      }
      if (exception.code === 'P2025') {
        return {
          status: HttpStatus.NOT_FOUND,
          body: { error: { code: 'NOT_FOUND', message: 'Record not found' } },
        };
      }
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      },
    };
  }
}
