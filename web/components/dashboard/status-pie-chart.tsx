"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { StatusCount } from "@/types";

interface StatusPieChartProps {
  data: StatusCount[];
  total: number;
}

const statusColors: Record<string, string> = {
  Applied: "#3B82F6",
  "Phone Screen": "#F59E0B",
  Interview: "#8B5CF6",
  Offer: "#10B981",
  Rejected: "#EF4444",
};

export function StatusPieChart({ data, total }: StatusPieChartProps) {
  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            No applications yet
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate pie chart segments
  let cumulativePercent = 0;
  const segments = data.map((item) => {
    const percent = (item.count / total) * 100;
    const startPercent = cumulativePercent;
    cumulativePercent += percent;
    return {
      ...item,
      percent,
      startPercent,
      color: statusColors[item.status] || "#9CA3AF",
    };
  });

  // Create SVG pie chart using conic gradient
  const gradientStops = segments.map((segment) => {
    return `${segment.color} ${segment.startPercent}% ${segment.startPercent + segment.percent}%`;
  }).join(", ");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          {/* Pie Chart */}
          <div
            className="w-32 h-32 rounded-full flex-shrink-0"
            style={{
              background: `conic-gradient(${gradientStops})`,
            }}
          />

          {/* Legend */}
          <div className="flex-1 space-y-2">
            {segments.map((segment) => (
              <div key={segment.status} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="text-sm text-muted-foreground flex-1">
                  {segment.status}
                </span>
                <span className="text-sm font-medium">{segment.count}</span>
                <span className="text-xs text-muted-foreground">
                  ({segment.percent.toFixed(0)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
