import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from './audit.service';

/** Modules métier à journaliser (segment d’URL après /api). */
const MODULES = new Set([
  'dossiers',
  'cotation',
  'facturation',
  'tarification',
  'users',
  'ged',
  'patients',
  'prospects',
  'partenaires',
  'logistique',
  'communications',
  'inbox',
  'notifications',
]);

const METHOD_ACTION: Record<string, string> = {
  POST: 'CREATE',
  PATCH: 'UPDATE',
  PUT: 'UPDATE',
  DELETE: 'DELETE',
};

function moduleFromUrl(url: string): string {
  const clean = url.split('?')[0].replace(/^\/api\/?/, '').replace(/^\//, '');
  const segment = clean.split('/').filter(Boolean)[0] ?? 'systeme';
  return segment;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const method = req.method as string;
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const url: string = req.originalUrl ?? req.url ?? '';
    const module = moduleFromUrl(url);
    if (!MODULES.has(module)) {
      return next.handle();
    }

    const user = req.user;
    const started = Date.now();
    const recordId =
      req.params?.id ??
      req.params?.dossierId ??
      req.params?.factureId ??
      undefined;

    return next.handle().pipe(
      tap({
        next: (result) => {
          const resultObj = result as { id?: string; numero?: string } | null;
          void this.audit.log({
            userId: user?.id,
            action: METHOD_ACTION[method] ?? 'UPDATE',
            tableCible: module,
            recordId: recordId ?? resultObj?.id,
            nouvelleValeur: {
              path: url,
              durationMs: Date.now() - started,
              numero: resultObj?.numero,
              resultId: resultObj?.id,
            },
            ip: req.ip,
            userAgent: req.headers['user-agent'],
          });
        },
      }),
    );
  }
}
