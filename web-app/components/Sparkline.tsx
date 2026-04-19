"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { format } from "date-fns";

export type SparkPoint = { day: string; count: number };

export function Sparkline({
  data,
  color = "#3b82f6",
  height = 60,
  showAxis = false,
  label = "submissions",
}: {
  data: SparkPoint[];
  color?: string;
  height?: number;
  showAxis?: boolean;
  label?: string;
}) {
  const max = data.reduce((m, p) => (p.count > m ? p.count : m), 0);
  const total = data.reduce((s, p) => s + p.count, 0);
  const nonZeroDays = data.filter((p) => p.count > 0).length;

  // Sparse-data guard: a single bar of height=max at the edge of 29
  // empty days looks lopsided and visually broken. Once we have at
  // least a few active days the sparkline tells a real story — until
  // then show a plain text summary instead.
  if (nonZeroDays <= 1) {
    const only = data.find((p) => p.count > 0);
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-[11px] text-muted italic"
      >
        {only
          ? `${only.count} ${label} on ${format(new Date(only.day), "MMM d")}`
          : `No ${label} in this range`}
      </div>
    );
  }

  // When the peak is tiny (e.g. max = 2) a single bar still takes the full
  // chart height and feels disproportionate. Keep the Y domain at ≥5 so
  // low counts render as small bars.
  const yDomain: [number, number] = [0, Math.max(max, 5)];

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart
          data={data}
          margin={{ top: 4, right: 2, bottom: showAxis ? 16 : 2, left: showAxis ? 0 : 2 }}
          barCategoryGap="15%"
        >
          {/* XAxis is always declared so the tooltip has a valid label key.
              Without it, Recharts falls back to the bar index — new Date(0)
              then renders as "Jan 1, 1970" in the tooltip. */}
          <XAxis
            dataKey="day"
            hide={!showAxis}
            stroke="#64748b"
            fontSize={10}
            tickFormatter={(d) => format(new Date(d), "MMM d")}
            interval="preserveStartEnd"
          />
          <YAxis hide={!showAxis} domain={yDomain} stroke="#64748b" fontSize={10} allowDecimals={false} width={24} />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            contentStyle={{
              background: "#181b21",
              border: "1px solid #282c34",
              borderRadius: 6,
              fontSize: 11,
              padding: "4px 8px",
              color: "#e5e7eb",
            }}
            labelStyle={{ color: "#e5e7eb" }}
            itemStyle={{ color: "#e5e7eb" }}
            labelFormatter={(_, payload) => {
              const day = (payload?.[0]?.payload as SparkPoint | undefined)?.day;
              return day ? format(new Date(day), "PP") : "";
            }}
            formatter={(v: number) => [v, label]}
          />
          <Bar dataKey="count" radius={[2, 2, 0, 0]}>
            {data.map((p, i) => (
              <Cell key={i} fill={p.count === max && max > 0 ? color : `${color}99`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {total > 0 && nonZeroDays < data.length / 2 && (
        <div className="text-[10px] text-muted mt-1 text-right">
          {total} across {nonZeroDays} day{nonZeroDays === 1 ? "" : "s"}
        </div>
      )}
    </div>
  );
}
