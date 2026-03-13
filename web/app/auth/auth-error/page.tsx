import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Button, Card, CardContent } from "@/components/ui";

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Authentication Error</h2>
              <p className="text-sm text-muted-foreground">
                Something went wrong during authentication.
                The link may have expired or already been used.
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-4">
              <Link href="/login">
                <Button className="w-full">Go to Login</Button>
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
