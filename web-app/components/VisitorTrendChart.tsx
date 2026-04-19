"use client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";

export type VisitorTrendPoint = {
  day: string;
  visitors: number;
  pageviews: number;
};

export function VisitorTrendChart({
  data,
  rangeLabel,
}: {
  data: VisitorTrendPoint[];
  rangeLabel: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="text-sm text-muted mb-2">
        Visitors &amp; page views — {rangeLabel}
      </div>
      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
            <CartesianGrid stroke="#2a2e36" strokeDasharray="3 3" />
            <XAxis
              dataKey="day"
              stroke="#64748b"
              fontSize={11}
              tickFormatter={(d) => format(new Date(d), "MMM d")}
            />
            <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: "#181b21",
                border: "1px solid #282c34",
                borderRadius: 6,
                fontSize: 12,
              }}
              labelFormatter={(d) => format(new Date(d), "PP")}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="pageviews"
              name="Page views"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="visitors"
              name="Visitors"
              stroke="#22c55e"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
