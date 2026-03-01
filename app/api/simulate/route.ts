import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'alerts_db.json');

export async function POST() {
    try {
        if (!fs.existsSync(DB_PATH)) {
            fs.writeFileSync(DB_PATH, JSON.stringify([]));
        }

        // Read current alerts
        const existingAlerts = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));

        // Create a mock alert matching the exact expected interface
        const fakeAlert = {
            id: `sim-${Date.now()}`,
            cities: ["תל אביב - יפו", "רמת גן", "גבעתיים", "אזור בדיקה (סימולציה)"],
            title: "התרעה מדומה - בדיקת מערכת",
            timestamp: new Date().toISOString()
        };

        // Inject at the top of the history
        existingAlerts.unshift(fakeAlert);

        // Persist to DB
        fs.writeFileSync(DB_PATH, JSON.stringify(existingAlerts, null, 2));

        return NextResponse.json({ success: true, alert: fakeAlert });
    } catch (error) {
        console.error('[API/Simulate] Error simulating alert:', error);
        return NextResponse.json({ error: 'Failed to simulate alert' }, { status: 500 });
    }
}
