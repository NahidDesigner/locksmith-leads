"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { format } from "date-fns";

export type SparkPoint = { day: string; count: number };

export function Sparkline({
  data,
  color = "#3b82f6",
  height = 60,
  showAxis = false,
}: {
  data: SparkPoint[];
  color?: string;
  height?: number;
  showAxis?: boolean;
}) {
  const max = data.reduce((m, p) => (p.count > m ? p.count : m), 0);
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 4, right: 2, bottom: showAxis ? 16 : 2, left: showAxis ? 0 : 2 }}>
          {showAxis && (
            <XAxis
              dataKey="day"
              stroke="#64748b"
              fontSize={10}
              tickFormatter={(d) => format(new Date(d), "MMM d")}
              interval="preserveStartEnd"
            />
          )}
          {showAxis && <YAxis stroke="#64748b" fontSize={10} allowDecimals={false} width={24} />}
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            contentStyle={{ background: "#181b21", border: "1px solid #282c34", borderRadius: 6, fontSize: 11, padding: "4px 8px" }}
            labelFormatter={(d) => format(new Date(d), "PP")}
            formatter={(v: number) => [v, "submissions"]}
          />
          <Bar dataKey="count" radius={[2, 2, 0, 0]}>
            {data.map((p, i) => (
              <Cell key={i} fill={p.count === max && max > 0 ? color : `${color}99`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
