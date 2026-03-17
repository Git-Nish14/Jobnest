import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  StatusBadge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import type { JobApplication } from "@/types";

interface RecentApplicationsProps {
  applications: JobApplication[];
}

export function RecentApplications({ applications }: RecentApplicationsProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Recent Applications</CardTitle>
          <CardDescription>Your latest job applications</CardDescription>
        </div>
        <Link href="/applications">
          <Button variant="ghost" size="sm" className="gap-1">
            View all
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {applications.length > 0 ? (
          <div className="divide-y -mx-2">
            {applications.map((app) => (
              <Link
                key={app.id}
                href={`/applications/${app.id}`}
                className="flex items-center justify-between gap-3 px-2 py-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs shrink-0">
                    {app.company.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{app.position}</p>
                    <p className="text-xs text-muted-foreground truncate">{app.company}</p>
                  </div>
                </div>
                <StatusBadge status={app.status} />
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No applications yet</p>
            <Link href="/applications/new">
              <Button variant="link" size="sm" className="mt-1">
                Add your first application
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
