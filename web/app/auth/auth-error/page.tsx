import { AuthErrorClient } from "./auth-error-client";

interface AuthErrorPageProps {
  searchParams: Promise<{
    error?: string;
    error_code?: string;
    error_description?: string;
    provider?: string;
  }>;
}

function getErrorMessage(error?: string, errorCode?: string, errorDescription?: string): string {
  if (errorDescription) {
    const decoded = decodeURIComponent(errorDescription.replace(/\+/g, " "));
    // Clean up Supabase's raw internal messages
    if (decoded.includes("User already registered")) {
      return "An account with this email already exists. Try signing in instead.";
    }
    if (decoded.includes("Email not confirmed")) {
      return "Your email hasn't been verified yet. Check your inbox for a confirmation link.";
    }
    return decoded;
  }

  switch (error) {
    case "access_denied":
      return "You declined to grant access. You can try signing in again whenever you're ready.";
    case "server_error":
      return "The authentication server encountered an error. Please try again in a moment.";
    case "temporarily_unavailable":
      return "The authentication service is temporarily unavailable. Please try again shortly.";
    case "invalid_request":
      return "The sign-in link has expired or is invalid. Please start the sign-in process again.";
    case "provider_email_needs_verification":
      return "Your provider account email needs verification. Please verify your email and try again.";
    default:
      if (errorCode === "otp_expired") {
        return "Your verification code has expired. Please request a new one.";
      }
      if (errorCode === "email_not_confirmed") {
        return "Your email hasn't been verified. Check your inbox for a confirmation link.";
      }
      return "The sign-in link may have expired or already been used. Please try signing in again.";
  }
}

export default async function AuthErrorPage({ searchParams }: AuthErrorPageProps) {
  const params = await searchParams;
  const message = getErrorMessage(params.error, params.error_code, params.error_description);

  const isOAuthError =
    params.error === "access_denied" ||
    params.error_code === "provider_email_needs_verification" ||
    (params.error_description?.includes("OAuth") ?? false) ||
    (params.error_description?.includes("provider") ?? false);

  // Try to infer which provider caused the error from the description
  let provider: "google" | "github" | null = null;
  const desc = (params.error_description ?? "").toLowerCase();
  if (desc.includes("google")) provider = "google";
  else if (desc.includes("github")) provider = "github";

  return (
    <AuthErrorClient
      message={message}
      isOAuthError={isOAuthError}
      provider={provider}
    />
  );
}
