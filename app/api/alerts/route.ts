import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Alert, { IAlert } from '@/models/Alert';

export async function GET() {
    await dbConnect();

    let data = null;
    let fetchError = false;

    // 1. Try to fetch from Official API
    try {
        const response = await Promise.race([
            fetch('https://www.oref.org.il/WarningMessages/alert/alerts.json', {
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Referer': 'https://www.oref.org.il/',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                },
                cache: 'no-store'
            }),
            new Promise<Response>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
        ]);

        if (response.ok) {
            const text = await response.text();
            try {
                // Oref API sometimes returns empty strings or HTML payloads during routing/blocks
                data = text.trim() ? JSON.parse(text) : null;
            } catch {
                console.warn('[API/Alerts] Non-JSON payload received from Oref.');
                fetchError = true;
            }
        } else {
            fetchError = true;
        }
    } catch (e) {
        console.error('[API/Alerts] Fetch dropped:', e);
        fetchError = true;
    }

    // 2. Sync Official API Payload to DB
    let isNewAlert = false;
    if (data && data.data && data.data.length > 0) {
        try {
            const res = await Alert.findOneAndUpdate(
                { id: data.id },
                {
                    id: data.id,
                    cities: data.data,
                    title: data.title,
                    timestamp: new Date().toISOString()
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            // If it's a new document
            if (res) isNewAlert = true;
        } catch (e) {
            console.error('[API/Alerts] MongoDB Save Error:', e);
        }
    }

    // 3. Read Database
    const existingAlerts = await Alert.find({}).sort({ timestamp: -1 }).limit(100).lean();

    // 4. --- MAGICAL SYNC FOR SIMULATIONS / ALL ALERTS ---
    const now = new Date().getTime();
    const activeCities = new Set<string>();

    if (data && data.data) {
        data.data.forEach((city: string) => activeCities.add(city));
    }

    // Mark any alert in DB from the last 1.5 minutes as ACTIVE 
    (existingAlerts as unknown as IAlert[]).forEach((alert) => {
        const alertTime = new Date(alert.timestamp).getTime();
        const diffMinutes = Math.abs(now - alertTime) / (1000 * 60);

        if (diffMinutes <= 1.5) {
            if (Array.isArray(alert.cities)) {
                alert.cities.forEach((c: string) => activeCities.add(c));
            }
        }
    });

    // We always return 200 so the UI client polling keeps updating!
    return NextResponse.json({
        active: { data: Array.from(activeCities) },
        saved_alerts: existingAlerts,
        status: fetchError ? 'fallback' : 'success',
        new_alert_saved: isNewAlert
    });
}
