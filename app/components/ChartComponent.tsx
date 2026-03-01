"use client";
import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Activity } from 'lucide-react';

interface AlertData {
    timestamp: string;
    id?: string;
    cities?: string[] | string;
    title?: string;
}

export default function ChartComponent({ history }: { history: AlertData[] }) {
    // Process history to group by hour in Israel time for the last 24 hours
    const chartData = useMemo(() => {
        const hours = new Array(24).fill(0).map((_, i) => {
            const d = new Date();
            d.setHours(d.getHours() - (23 - i));
            d.setMinutes(0);
            d.setSeconds(0);
            return {
                timestamp: d.getTime(),
                label: d.getHours().toString().padStart(2, '0') + ':00'
            };
        });

        const dataPoints = hours.map(h => {
            const count = history.filter(alert => {
                const alertDate = new Date(alert.timestamp);
                const diff = (alertDate.getTime() - h.timestamp) / (1000 * 60 * 60);
                return diff >= 0 && diff < 1;
            }).length;

            return {
                time: h.label,
                alerts: count
            };
        });

        return dataPoints;
    }, [history]);

    const hasData = chartData.some(d => d.alerts > 0);

    return (
        <div className="w-full h-[250px]">
            {hasData ? (
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorAlerts" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.6} />
                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis
                            dataKey="time"
                            stroke="#64748b"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            interval={3}
                            dy={10}
                        />
                        <YAxis
                            stroke="#64748b"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            allowDecimals={false}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                borderRadius: '12px',
                                color: '#f8fafc',
                                backdropFilter: 'blur(8px)',
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
                            }}
                            itemStyle={{ color: '#ef4444', fontWeight: 'bold', fontSize: '12px' }}
                            labelStyle={{ color: '#94a3b8', marginBottom: '4px', fontSize: '11px', fontWeight: '600' }}
                            formatter={(value: number | string | undefined) => [`${value ?? 0} שיגורים`, 'עצימות']}
                        />
                        <Area
                            type="monotone"
                            dataKey="alerts"
                            stroke="#ef4444"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorAlerts)"
                            animationDuration={2000}
                            activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            ) : (
                <div className="h-full w-full flex flex-col items-center justify-center text-slate-600 border border-slate-700/30 rounded-xl bg-[#0f172a]/40 shadow-inner">
                    <Activity size={32} className="opacity-20 mb-3 animate-pulse" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                        {history.length > 0 ? "24H: גזרה שקטה" : "מערכת מסנכרנת נתונים..."}
                    </p>
                </div>
            )}
        </div>
    );
}
