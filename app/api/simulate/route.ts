import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Alert from '@/models/Alert';

export async function POST() {
    try {
        await dbConnect();

        // Create a mock alert matching the exact expected interface
        const fakeAlert = {
            id: `sim-${Date.now()}`,
            cities: ["תל אביב - יפו", "רמת גן", "גבעתיים", "אזור בדיקה (סימולציה)"],
            title: "התרעה מדומה - בדיקת מערכת",
            timestamp: new Date().toISOString()
        };

        // Persist to MongoDB
        await Alert.create(fakeAlert);

        return NextResponse.json({ success: true, alert: fakeAlert });
    } catch (error) {
        console.error('[API/Simulate] Error simulating alert:', error);
        return NextResponse.json({ error: 'Failed to simulate alert' }, { status: 500 });
    }
}
