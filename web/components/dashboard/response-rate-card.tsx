import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

interface ResponseRateCardProps {
  rate: number;
  total: number;
  responses: number;
}

export function ResponseRateCard({ rate, total, responses }: ResponseRateCardProps) {
  const getColorClass = (rate: number) => {
    if (rate >= 50) return "text-green-500";
    if (rate >= 25) return "text-yellow-500";
    return "text-red-500";
  };

  const getProgressColor = (rate: number) => {
    if (rate >= 50) return "bg-green-500";
    if (rate >= 25) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Response Rate
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className={`text-3xl font-bold ${getColorClass(rate)}`}>
            {rate}%
          </span>
          <span className="text-sm text-muted-foreground">
            ({responses} of {total})
          </span>
        </div>
        <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${getProgressColor(rate)}`}
            style={{ width: `${rate}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Applications that received any response
        </p>
      </CardContent>
    </Card>
  );
}
