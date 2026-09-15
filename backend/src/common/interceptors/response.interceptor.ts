import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { IS_RAW_RESPONSE_KEY } from '../decorators/raw-response.decorator';

interface Paginated {
  data: unknown;
  meta: unknown;
}

function isPaginated(value: unknown): value is Paginated {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    'meta' in value
  );
}

/**
 * Wraps every successful response in the standard { data } / { data, meta } envelope
 * (see docs/API_ARCHITECTURE.md §4) so controllers just return the resource/list and
 * never hand-build the envelope themselves. Routes marked @RawResponse() (e.g. a CSV
 * download, where the body must match the Content-Type header exactly) are passed through.
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const isRaw = this.reflector.getAllAndOverride<boolean>(
      IS_RAW_RESPONSE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isRaw) {
      return next.handle();
    }

    return next.handle().pipe(
      map((value) => {
        if (isPaginated(value)) {
          return value;
        }
        return { data: value };
      }),
    );
  }
}
