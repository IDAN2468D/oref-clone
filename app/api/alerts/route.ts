import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Alert, { IAlert } from '@/models/Alert';

export async function GET() {
    await dbConnect();

    let data = null;
    let fetchError = false;

    // 1. Try to fetch from Official Real-time API
    try {
        const response = await fetch('https://www.oref.org.il/WarningMessages/alert/alerts.json', {
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': 'https://www.oref.org.il/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Accept': '*/*',
                'Cache-Control': 'no-cache'
            },
            next: { revalidate: 0 }
        });

        if (response.ok) {
            const text = await response.text();
            data = text.trim() ? JSON.parse(text) : null;
        }
    } catch (e) {
        console.error('[API/Alerts] Realtime fetch error:', e);
        fetchError = true;
    }

    // 2. Try to fetch from History API as Fallback/Augmentation
    let historyPayload = [];
    try {
        const historyResponse = await fetch('https://www.oref.org.il/WarningMessages/History/AlertsHistory.json', {
            headers: {
                'Referer': 'https://www.oref.org.il/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            },
            next: { revalidate: 0 }
        });
        if (historyResponse.ok) {
            historyPayload = await historyResponse.json();
        }
    } catch (e) {
        console.error('[API/Alerts] History fetch error:', e);
    }

    // Helper to parse Oref's DD.MM.YYYY HH:mm:ss into standard ISO
    const parseOrefDate = (dateStr: string) => {
        try {
            if (!dateStr || dateStr.includes('T')) return dateStr;
            const [datePart, timePart] = dateStr.split(' ');
            const [d, m, y] = datePart.split('.').map(Number);
            const [hh, mm, ss] = timePart.split(':').map(Number);
            // Oref is Israel Time (UTC+2 or UTC+3). 
            // We'll create a date object which defaults to server local time, 
            // but for Oref alerts, we should be careful.
            // For most reliable results, we interpret it as a local date string.
            return new Date(y, m - 1, d, hh, mm, ss || 0).toISOString();
        } catch (e) {
            return new Date().toISOString();
        }
    };

    // 3. Sync everything to DB
    if (data && data.data && data.data.length > 0) {
        try {
            await Alert.findOneAndUpdate(
                { id: data.id },
                {
                    id: data.id,
                    cities: data.data,
                    title: data.title,
                    timestamp: new Date().toISOString()
                },
                { upsert: true }
            );
        } catch (e) {
            console.error('[API/Alerts] RT Sync Error:', e);
        }
    }

    // Sync from history payload too (Backup/OSINT Source)
    if (Array.isArray(historyPayload)) {
        for (const item of historyPayload.slice(0, 15)) {
            try {
                const standardizedDate = parseOrefDate(item.alertDate);
                await Alert.findOneAndUpdate(
                    { id: item.rid || item.id },
                    {
                        id: item.rid || item.id,
                        cities: item.data,
                        title: item.title,
                        timestamp: standardizedDate
                    },
                    { upsert: true }
                );
            } catch (e) { }
        }
    }

    // 4. Read Database (Last 100 for feed, calculate ACTIVE from these)
    const existingAlerts = await Alert.find({}).sort({ timestamp: -1 }).limit(100).lean();

    // 5. Build active list (Real-time + anything in last 3 minutes in DB)
    const now = new Date().getTime();
    const activeCities = new Set<string>();

    if (data && data.data) {
        data.data.forEach((city: string) => activeCities.add(city));
    }

    (existingAlerts as unknown as IAlert[]).forEach((alert) => {
        const alertTime = new Date(alert.timestamp).getTime();
        const diffMs = now - alertTime;
        const diffMinutes = diffMs / (1000 * 60);

        // If it happened in the last 3 minutes AND it's not a future timestamp (oops)
        if (diffMinutes >= 0 && diffMinutes <= 3.0) {
            if (Array.isArray(alert.cities)) {
                alert.cities.forEach((c: string) => activeCities.add(c));
            } else if (typeof alert.cities === 'string') {
                activeCities.add(alert.cities);
            }
        }
    });

    return NextResponse.json({
        active: { data: Array.from(activeCities) },
        saved_alerts: existingAlerts,
        status: (fetchError || (data === null)) ? 'fallback' : 'success'
    });
}
