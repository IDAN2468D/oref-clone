import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Local filepath to permanently save the history of alerts
const DB_PATH = path.join(process.cwd(), 'alerts_db.json');

function initDB() {
    if (!fs.existsSync(DB_PATH)) {
        fs.writeFileSync(DB_PATH, JSON.stringify([]));
    }
}

export async function GET() {
    initDB();

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

    // 2. Read local Database
    const existingAlerts = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    let isNewAlert = false;

    // 3. Sync Official API Payload to DB
    if (data && data.data && data.data.length > 0) {
        const newAlert = {
            id: data.id,
            cities: data.data,
            title: data.title,
            timestamp: new Date().toISOString()
        };

        const exists = existingAlerts.some((a: { id: string }) => a.id === newAlert.id);
        if (!exists) {
            existingAlerts.unshift(newAlert);
            fs.writeFileSync(DB_PATH, JSON.stringify(existingAlerts, null, 2));
            isNewAlert = true;
        }
    }

    // 4. --- MAGICAL SYNC FOR SIMULATIONS / ALL ALERTS ---
    const now = new Date().getTime();
    const activeCities = new Set<string>();

    if (data && data.data) {
        data.data.forEach((city: string) => activeCities.add(city));
    }

    // Mark any alert in DB from the last 1.5 minutes as ACTIVE 
    existingAlerts.forEach((alert: { timestamp: string, cities: string[] }) => {
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
