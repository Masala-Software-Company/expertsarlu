import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from './audit.service';

const SENSITIVE = new Set([
  'dossiers',
  'cotation',
  'facturation',
  'tarification',
  'users',
  'ged',
]);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const method = req.method as string;
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const path: string = req.route?.path ?? req.url ?? '';
    const segment = path.split('/').filter(Boolean)[0] ?? 'unknown';
    if (!SENSITIVE.has(segment) && !path.includes('dossiers')) {
      return next.handle();
    }

    const user = req.user;
    const started = Date.now();

    return next.handle().pipe(
      tap({
        next: (result) => {
          void this.audit.log({
            userId: user?.id,
            action: `${method}_AUTO`,
            tableCible: segment,
            recordId: req.params?.id,
            nouvelleValeur: {
              path: req.url,
              durationMs: Date.now() - started,
              resultId: (result as { id?: string })?.id,
            },
            ip: req.ip,
            userAgent: req.headers['user-agent'],
          });
        },
      }),
    );
  }
}
