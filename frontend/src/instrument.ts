import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 0.1,
  environment: "production",
  enabled: import.meta.env.PROD, // disabled in local dev (import.meta.env.PROD is false)
  // Phase 74: Filter analytics-related errors (GA4, gtag, beacon) from Sentry
  beforeSend(event) {
    const msg = event.exception?.values?.[0]?.value ?? '';
    const frames = event.exception?.values?.[0]?.stacktrace?.frames ?? [];
    if (
      /gtag|google.*analytics|googletagmanager|beacon/i.test(msg) ||
      frames.some(f => /gtag|googletagmanager|analytics/i.test(f.filename ?? ''))
    ) {
      return null;
    }
    return event;
  },
});
