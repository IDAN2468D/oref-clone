import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { message } = await req.json();

        // Needs TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env.local
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;

        if (!botToken || !chatId) {
            return NextResponse.json({ success: false, error: "Missing Telegram credentials in .env.local" });
        }

        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: "Markdown"
            })
        });

        const data = await response.json();

        if (data.ok) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ success: false, error: data.description });
        }
    } catch (e) {
        console.error("Telegram Webhook Error:", e);
        return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
    }
}
