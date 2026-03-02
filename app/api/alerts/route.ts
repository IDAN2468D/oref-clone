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

    // Helper to parse Oref's DD.MM.YYYY HH:mm:ss into REAL UTC
    const parseOrefDate = (dateStr: string) => {
        try {
            if (!dateStr || dateStr.includes('T')) return dateStr;
            const [datePart, timePart] = dateStr.split(' ');
            const [d, m, y] = datePart.split('.').map(Number);
            const [hh, mm, ss] = timePart.split(':').map(Number);

            // Create local wall clock date
            const wallClock = new Date(y, m - 1, d, hh, mm, ss || 0);

            // Dynamically find Israel offset for this specific date (handles DST)
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: 'Asia/Jerusalem',
                timeZoneName: 'longOffset'
            });
            const offsetPart = formatter.formatToParts(wallClock).find(p => p.type === 'timeZoneName')?.value || "GMT+02:00";
            const match = offsetPart.match(/GMT([+-])(\d+):/);
            const offsetHours = match ? parseInt(match[2]) * (match[1] === '-' ? -1 : 1) : 2;

            // Convert wall clock to UTC
            const utcMillis = wallClock.getTime() - (offsetHours * 60 * 60 * 1000);
            return new Date(utcMillis).toISOString();
        } catch (e) {
            return new Date().toISOString();
        }
    };

    // 3. Sync everything to DB
    if (data && data.data && data.data.length > 0) {
        try {
            // Check if this alert is new-ish before saving
            await Alert.findOneAndUpdate(
                { id: data.id },
                {
                    id: data.id,
                    cities: data.data,
                    title: data.title,
                    timestamp: new Date().toISOString() // Real-time alerts get current UTC server time
                },
                { upsert: true }
            );
        } catch (e) {
            console.error('[API/Alerts] RT Sync Error:', e);
        }
    }

    // Sync from history payload too (Backup/OSINT Source)
    if (Array.isArray(historyPayload)) {
        for (const item of historyPayload.slice(0, 30)) {
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

    // 5. Build active list (Real-time + anything in last 5 minutes in DB for better coverage)
    const now = new Date().getTime();
    const activeCities = new Set<string>();

    if (data && data.data) {
        data.data.forEach((city: string) => activeCities.add(city));
    }

    (existingAlerts as unknown as IAlert[]).forEach((alert) => {
        const alertTime = new Date(alert.timestamp).getTime();
        const diffMs = now - alertTime;
        const diffMinutes = diffMs / (1000 * 60);

        // Window: 5 minutes to stay on map, allow -2 min drift for sync
        if (diffMinutes >= -2 && diffMinutes <= 5.0) {
            if (Array.isArray(alert.cities)) {
                alert.cities.forEach((c: string) => activeCities.add(c));
            } else if (typeof alert.cities === 'string') {
                activeCities.add(alert.cities);
            }
        }
    });

    console.log(`[API/Alerts Audit] Active Count: ${activeCities.size}. Server Time UTC: ${new Date().toISOString()}`);

    return NextResponse.json({
        active: { data: Array.from(activeCities) },
        saved_alerts: existingAlerts,
        status: (fetchError || (!data && historyPayload.length === 0)) ? 'fallback' : 'success'
    });
}
