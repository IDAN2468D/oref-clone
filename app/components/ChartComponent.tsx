"use client";
import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface AlertData {
    timestamp: string;
    id?: string;
    cities?: string[] | string;
    title?: string;
}

export default function ChartComponent({ history }: { history: AlertData[] }) {
    // Process history to group by hour in Israel time for the last 24 hours
    const chartData = useMemo(() => {
        const counts: Record<string, number> = {};

        // Initialize last 24 hours with zeros
        const now = new Date();
        for (let i = 23; i >= 0; i--) {
            const d = new Date(now.getTime() - i * 60 * 60 * 1000);
            const hourStr = d.toLocaleTimeString('he-IL', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Asia/Jerusalem'
            });
            // We want to force it to show "HH:00" for cleaner axis
            const cleanHour = hourStr.split(':')[0] + ':00';
            counts[cleanHour] = 0;
        }

        // Fill with actual data
        history.forEach(alert => {
            const d = new Date(alert.timestamp);
            const diffHours = (now.getTime() - d.getTime()) / (1000 * 60 * 60);

            if (diffHours <= 24) {
                const hourStr = d.toLocaleTimeString('he-IL', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Asia/Jerusalem'
                });
                const cleanHour = hourStr.split(':')[0] + ':00';
                if (counts[cleanHour] !== undefined) {
                    counts[cleanHour]++;
                }
            }
        });

        return Object.entries(counts).map(([time, alerts]) => ({
            time,
            alerts
        }));
    }, [history]);

    return (
        <div className="w-full h-full min-h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorAlerts" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={1} />
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
                        strokeWidth={2.5}
                        fillOpacity={0.2}
                        fill="url(#colorAlerts)"
                        animationDuration={2000}
                        activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
