import * as Sentry from "@sentry/nextjs";
import { sentryDataCollection } from "./lib/sentry-options";

Sentry.init({
  dataCollection: sentryDataCollection,
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: process.env.NODE_ENV === "production",
});
