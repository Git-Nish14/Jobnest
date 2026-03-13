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
          <div className="space-y-4">
            {applications.map((app) => (
              <Link
                key={app.id}
                href={`/applications/${app.id}`}
                className="flex items-center justify-between p-3 -mx-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-medium truncate">{app.position}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {app.company}
                  </p>
                </div>
                <StatusBadge status={app.status} />
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-sm">No applications yet</p>
            <Link href="/applications/new">
              <Button variant="link" size="sm">
                Add your first application
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
