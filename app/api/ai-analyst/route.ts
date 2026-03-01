import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: Request) {
    try {
        const { activeAlerts, history, isLTR } = await req.json();

        // Make sure we have the API key configured in .env.local
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            if (activeAlerts.length > 5) {
                return NextResponse.json({ insight: isLTR ? "Warning: Multiple threats detected." : "התרעה: זוהו מספר איומים גבוה." });
            }
            return NextResponse.json({ insight: isLTR ? "System standby. Add GEMINI_API_KEY in .env.local" : "מערכת AI מושהית. נא להגדיר GEMINI_API_KEY." });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const activeCount = activeAlerts.length;
        let dataContext = "";

        // Extract some basic info from the most recent alerts
        if (history && history.length > 0) {
            const recent = history.slice(0, 3);
            dataContext = recent.map((r: { cities: string[] | string, timestamp: string }) => {
                const c = Array.isArray(r.cities) ? r.cities.join(", ") : r.cities;
                return `At ${r.timestamp}: targets included ${c}`;
            }).join("; ");
        }

        const lang = isLTR ? "English" : "Hebrew";

        const prompt = `
You are a tactical military AI analyst systems for the Israeli Home Front Command (Oref).
Write ONE short, highly professional, direct, and slightly dramatized sentence summarizing the current situation based on this data:
- Currently active sirens (cities instantly under attack right now): ${activeCount} active zones. (${activeAlerts.join(", ")})
- Recent attacks history (last 5 min): ${dataContext}

Rules:
1. Keep it to exactly 1 short sentence (max 15 words).
2. Sound like a robotic, highly intelligent military tactical system dashboard. 
3. MUST be in ${lang}.
4. If there are NO active sirens currently, report that the sector is scanning and analyzing previous targets.
5. Do NOT use markdown or quotes. Speak as the system directly.
`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        return NextResponse.json({ insight: text.trim().replace(/^"|"$/g, '') });

    } catch (error) {
        console.error("Gemini AI API Error:", error);
        // Fallback response so the UI doesn't break
        return NextResponse.json({ insight: "מערכת ניתוח AI עמוסה, מסתמך על אלגוריתם מקומי לשעת חירום." }, { status: 500 });
    }
}
