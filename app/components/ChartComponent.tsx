"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function ChartComponent({ history }: { history: Record<string, unknown>[] }) {
    // Creating a smooth curve line chart for demonstration.
    // In a full DB, this groups by hour. For the UI, we simulate the "Pulse" of the day.
    const data = [
        { time: '00:00', alerts: 5 },
        { time: '04:00', alerts: 2 },
        { time: '08:00', alerts: history.length > 5 ? history.length * 3 : 15 },
        { time: '12:00', alerts: 45 },
        { time: '16:00', alerts: 20 },
        { time: '20:00', alerts: history.length > 0 ? history.length * 5 + 40 : 60 },
        { time: '24:00', alerts: history.length * 10 || 12 },
    ];

    return (
        <div className="w-full h-[250px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 10, right: 30, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc', padding: '10px' }}
                        itemStyle={{ color: '#ef4444', fontWeight: 'bold' }}
                        labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                    />
                    <Line
                        type="monotone"
                        dataKey="alerts"
                        name="מספר התרעות"
                        stroke="#ef4444"
                        strokeWidth={3}
                        dot={{ fill: '#0f172a', stroke: '#ef4444', strokeWidth: 2, r: 4 }}
                        activeDot={{ fill: '#ef4444', stroke: '#fff', strokeWidth: 2, r: 6 }}
                        animationDuration={1500}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
