import { NextRequest, NextResponse } from 'next/server';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { systemPrompt, userMessage } = body;

    // Priority: request header > environment variable
    const headerKey = request.headers.get('x-deepseek-api-key');
    const envKey = process.env.DEEPSEEK_API_KEY;
    const apiKey = headerKey || envKey;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.1,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return NextResponse.json({ error: `DeepSeek API error: ${response.status} ${errText}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
