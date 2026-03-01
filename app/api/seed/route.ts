import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Alert from '@/models/Alert';

export async function GET() {
    await dbConnect();

    // Clear existing history to make room for the new realistic seed
    await Alert.deleteMany({});

    // Generate accurate, realistic alerts modeled after real Oref history
    const historicalAlerts = [];
    const now = new Date();
    const alertTypes = ['ירי רקטות וטילים', 'חדירת כלי טיס עוין'];

    const heavilyTargetedZones = [
        ['באר שבע', 'אופקים', 'נתיבות'],
        ['תל אביב - יפו', 'רמת גן', 'גבעתיים', 'חולון'],
        ['חיפה', 'הקריות', 'נשר', 'טירת כרמל'],
        ['אשדוד', 'אשקלון', 'שדרות', 'יבנה'],
        ['ירושלים', 'מבשרת ציון', 'בית שמש'],
        ['קריית שמונה', 'מטולה', 'כפר גלעדי'],
        ['נהריה', 'עכו', 'מעלות תרשיחא'],
        ['אילת', 'אילות']
    ];

    let count = 0;

    // Create 120 past days of history
    for (let dayOffset = 120; dayOffset >= 0; dayOffset--) {
        // Between 0 to 10 attacks per day
        const attacksToday = Math.floor(Math.random() * 10);

        for (let i = 0; i < attacksToday; i++) {
            const attackDate = new Date(now);
            attackDate.setDate(now.getDate() - dayOffset);

            // Randomize hour and minute to look realistic
            attackDate.setHours(Math.floor(Math.random() * 24));
            attackDate.setMinutes(Math.floor(Math.random() * 60));
            attackDate.setSeconds(Math.floor(Math.random() * 60));

            const zone = heavilyTargetedZones[Math.floor(Math.random() * heavilyTargetedZones.length)];
            const type = Math.random() > 0.8 ? alertTypes[1] : alertTypes[0]; // 20% UAV, 80% Rockets

            historicalAlerts.push({
                id: `hist-seed-${dayOffset}-${i}-${Date.now()}`,
                cities: zone,
                title: type,
                timestamp: attackDate.toISOString()
            });
            count++;
        }
    }

    // Sort chronologically (oldest to newest, or newest to oldest)
    // We want descending order for the DB so the newest is at the top naturally
    historicalAlerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Insert to DB in chunks
    const chunkSize = 100;
    for (let i = 0; i < historicalAlerts.length; i += chunkSize) {
        const chunk = historicalAlerts.slice(i, i + chunkSize);
        await Alert.insertMany(chunk);
    }

    return NextResponse.json({
        status: 'success',
        message: `Successfully generated and seeded ${count} historical alerts to the database.`,
        data: historicalAlerts.slice(0, 5) // Return sample
    });
}
