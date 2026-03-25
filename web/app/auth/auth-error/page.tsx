import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Button, Card, CardContent } from "@/components/ui";

// Supabase sends these query params on OAuth failure:
// ?error=<code>&error_code=<num>&error_description=<human-readable>
interface AuthErrorPageProps {
  searchParams: Promise<{
    error?: string;
    error_code?: string;
    error_description?: string;
  }>;
}

// Map well-known OAuth error codes to friendlier messages
function getErrorMessage(error?: string, errorDescription?: string): string {
  if (errorDescription) {
    // Supabase URL-encodes spaces as +, decode them
    return decodeURIComponent(errorDescription.replace(/\+/g, " "));
  }

  switch (error) {
    case "access_denied":
      return "You declined to grant access. You can try signing in again whenever you're ready.";
    case "server_error":
      return "The authentication server encountered an error. Please try again in a moment.";
    case "temporarily_unavailable":
      return "The authentication service is temporarily unavailable. Please try again shortly.";
    default:
      return "The sign-in link may have expired or already been used. Please try signing in again.";
  }
}

export default async function AuthErrorPage({ searchParams }: AuthErrorPageProps) {
  const params = await searchParams;
  const message = getErrorMessage(params.error, params.error_description);

  // Decide retry destination based on the OAuth provider hint embedded in the error
  const isOAuthError =
    params.error === "access_denied" ||
    params.error_code === "provider_email_needs_verification" ||
    params.error_description?.includes("OAuth");

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Sign-in failed</h2>
              <p className="text-sm text-muted-foreground">{message}</p>
            </div>
            <div className="flex flex-col gap-2 pt-4">
              <Link href="/login">
                <Button className="w-full">
                  {isOAuthError ? "Try a different sign-in method" : "Back to Login"}
                </Button>
              </Link>
              <Link href="/signup">
                <Button variant="outline" className="w-full">
                  Create an Account
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
