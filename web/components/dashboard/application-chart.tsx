"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { WeeklyTrend } from "@/types";

interface ApplicationChartProps {
  data: WeeklyTrend[];
  title?: string;
}

export function ApplicationChart({ data, title = "Weekly Applications" }: ApplicationChartProps) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2 h-48">
          {data.map((item, index) => {
            const height = (item.count / maxCount) * 100;
            return (
              <div
                key={index}
                className="flex-1 flex flex-col items-center gap-2"
              >
                <div className="w-full flex items-end justify-center h-36">
                  <div
                    className="w-full max-w-[40px] bg-primary rounded-t transition-all duration-500 hover:bg-primary/80"
                    style={{ height: `${Math.max(height, 4)}%` }}
                    title={`${item.count} applications`}
                  />
                </div>
                <span className="text-xs text-muted-foreground truncate max-w-full">
                  {item.week}
                </span>
                <span className="text-xs font-medium">{item.count}</span>
              </div>
            );
          })}
        </div>
        {data.length === 0 && (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            No data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}
