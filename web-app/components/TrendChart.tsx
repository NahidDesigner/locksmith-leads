"use client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format } from "date-fns";

export type TrendPoint = { day: string; [siteDomain: string]: string | number };

const COLORS = ["#3b82f6", "#22c55e", "#eab308", "#ef4444", "#a855f7", "#06b6d4", "#f97316"];

export function TrendChart({ data, domains }: { data: TrendPoint[]; domains: string[] }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="text-sm text-muted mb-2">Submissions — last 30 days</div>
      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
            <CartesianGrid stroke="#2a2e36" strokeDasharray="3 3" />
            <XAxis dataKey="day" stroke="#64748b" fontSize={11} tickFormatter={(d) => format(new Date(d), "MMM d")} />
            <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
            <Tooltip contentStyle={{ background: "#181b21", border: "1px solid #282c34", borderRadius: 6, fontSize: 12 }} labelFormatter={(d) => format(new Date(d), "PP")} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {domains.map((d, i) => (
              <Line key={d} type="monotone" dataKey={d} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
