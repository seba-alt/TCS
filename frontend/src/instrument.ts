import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 0.1,
  environment: "production",
  enabled: import.meta.env.PROD, // disabled in local dev (import.meta.env.PROD is false)
});
