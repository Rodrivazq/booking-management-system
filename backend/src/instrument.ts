/**
 * Sentry instrumentation. Has to be imported BEFORE anything else (Express,
 * Prisma, app code). Sentry monkey-patches Node modules at init time, so any
 * module loaded before Sentry.init() won't be instrumented.
 *
 * If SENTRY_DSN is not set (dev local without a Sentry project), init is a
 * noop and the rest of the app behaves identically. Production sets the DSN
 * via Railway env vars.
 *
 * Tuned for the Real Sabor scale (200 internal employees):
 *   - tracesSampleRate 0.1 in prod: enough volume for trends, low overhead.
 *   - 4xx errors NOT sent: those are usually user mistakes, not bugs.
 *     Only 5xx and uncaught exceptions reach the dashboard.
 */

import * as Sentry from '@sentry/node';

const dsn = process.env.SENTRY_DSN;
const env = process.env.NODE_ENV || 'development';

if (dsn) {
    Sentry.init({
        dsn,
        environment: env,
        tracesSampleRate: env === 'production' ? 0.1 : 1.0,
        // Keep 4xx out of the dashboard noise; only ship 5xx and crashes.
        beforeSend(event, hint) {
            const error = hint?.originalException as { statusCode?: number } | undefined;
            if (error?.statusCode && error.statusCode < 500) return null;
            return event;
        },
    });
    // eslint-disable-next-line no-console
    console.log(`[Sentry] Initialized in ${env}`);
} else {
    // eslint-disable-next-line no-console
    console.log('[Sentry] No SENTRY_DSN configured, skipping init.');
}
