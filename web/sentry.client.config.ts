import * as Sentry from "@sentry/nextjs";
import { sentryDataCollection } from "./lib/sentry-options";

Sentry.init({
  dataCollection: sentryDataCollection,
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  // Only enable in production — avoids noise during local dev
  enabled: process.env.NODE_ENV === "production",
  // Ignore common benign errors
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "Non-Error promise rejection captured",
  ],
});
