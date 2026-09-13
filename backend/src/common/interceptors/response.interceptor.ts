import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

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
 * never hand-build the envelope themselves.
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
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
