import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/config";
import { cn } from "@/lib/utils";

interface StatusBreakdownProps {
  statusCounts: Record<ApplicationStatus, number>;
  total: number;
}

const statusColors: Record<ApplicationStatus, string> = {
  Applied: "bg-blue-500",
  "Phone Screen": "bg-amber-500",
  Interview: "bg-purple-500",
  Offer: "bg-emerald-500",
  Rejected: "bg-red-500",
};

export function StatusBreakdown({ statusCounts, total }: StatusBreakdownProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Status Breakdown</CardTitle>
        <CardDescription>Applications by current status</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {APPLICATION_STATUSES.map((status) => {
            const count = statusCounts[status] || 0;
            const percentage = total > 0 ? (count / total) * 100 : 0;

            return (
              <div key={status} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{status}</span>
                  <span className="font-medium">{count}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      statusColors[status]
                    )}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {total === 0 && (
          <p className="text-center text-sm text-muted-foreground pt-4">
            No applications to display
          </p>
        )}
      </CardContent>
    </Card>
  );
}
