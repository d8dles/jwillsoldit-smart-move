import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash, timingSafeEqual } from 'crypto';

export const dynamic = 'force-dynamic';

function tokenMatches(provided: string, expected: string): boolean {
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const expected = process.env.CAPTURE_TOKEN;
  const provided = (req.headers.get('authorization') ?? '')
    .replace(/^Bearer\s+/i, '')
    .trim();
  if (!expected || !provided || !tokenMatches(provided, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { text?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }
  if (text.length > 4000) {
    return NextResponse.json({ error: 'text too long' }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Single-user app: capture lands in the sole account's inbox.
  // CAPTURE_USER_ID can pin it explicitly if a second account ever exists.
  let userId = process.env.CAPTURE_USER_ID ?? '';
  if (!userId) {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 2 });
    if (error || !data?.users?.length) {
      return NextResponse.json({ error: 'No account found' }, { status: 500 });
    }
    userId = data.users[0].id;
  }

  const { error } = await admin.from('inbox').insert({ user_id: userId, raw_text: text });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
