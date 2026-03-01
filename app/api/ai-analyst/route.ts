import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { activeAlerts, history, isLTR, isDeepAudit } = body;

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

        let prompt = "";

        if (isDeepAudit) {
            prompt = `
You are the Chief Internal Intelligence Analyst for the Israeli Home Front Command (HFC).
Produce a COMPREHENSIVE STRATEGIC REPORT (SITREP) based on the latest tactical data:
- ACTIVE THREATS: ${activeCount} (${activeAlerts.join(", ")})
- HISTORICAL CONTEXT: ${dataContext}

Requirements:
1. Subject line: TACTICAL COMMAND AUDIT - [Current UTC Timestamp]
2. Content: Analyze the target pattern (North, Center, South), intensity (High/Low), and strategic significance.
3. Tone: Heavy, professional, cold, and authoritative. 
4. Language: ${lang}.
5. Format: Multiple short paragraphs. Be precise.
6. NO MD CODE BLOCKS, NO QUOTES. Speak as the system directly.
`;
        } else {
            prompt = `
You are a tactical military AI analyst systems for the Israeli Home Front Command (Oref).
Write ONE short, highly professional, direct, and slightly dramatized sentence summarizing the current situation:
- Currently active sirens: ${activeCount} (${activeAlerts.join(", ")})
- Recent attacks: ${dataContext}

Rules:
1. EXACTLY 1 sentence (max 15 words).
2. Robotic, command-center dashboard tone.
3. Language: ${lang}.
4. NO markdown or quotes.
`;
        }

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        return NextResponse.json({ insight: text.trim().replace(/^"|"$/g, '') });

    } catch (error) {
        console.error("Gemini AI API Error:", error);
        // Fallback response so the UI doesn't break
        return NextResponse.json({ insight: "מערכת ניתוח AI עמוסה, מסתמך על אלגוריתם מקומי לשעת חירום." }, { status: 500 });
    }
}
