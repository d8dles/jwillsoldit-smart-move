import { NextResponse } from 'next/server';
import { addDaysStr, todayStr } from '@/lib/dates';
import { callClaude, ClaudeConfigurationError } from '@/lib/anthropic';
import { parseFridayReview } from '@/lib/phase2';
import { isAuthFailure, requireUser } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const SYSTEM = [
  'You are a concise Friday money review for a solo real-estate and small-business operator.',
  'Use only the supplied data. Do not invent facts, dates, amounts, or commitments.',
  'Return JSON only with exactly: headline (string), summary (string), questions (array of up to 5 strings), nextWeek (array of up to 7 strings).',
  'Focus on cash movement, invoices, commissions, bills, and the next concrete follow-ups.',
].join(' ');

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (isAuthFailure(auth)) return auth.response;

  const date = todayStr();
  const cached = await auth.supabase
    .from('check_ins')
    .select('payload')
    .eq('kind', 'friday_money')
    .eq('date', date)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const cachedReview = cached.data?.payload?.review;
  if (cachedReview) return NextResponse.json({ ok: true, cached: true, review: cachedReview });

  const [money, tasks, deadlines] = await Promise.all([
    auth.supabase.from('money_items').select('label,kind,amount,due_date,status,counterparty').order('due_date'),
    auth.supabase.from('tasks').select('title,status,completed_at,category').order('created_at', { ascending: false }).limit(50),
    auth.supabase.from('deadlines').select('title,kind,date').gte('date', date).lte('date', addDaysStr(30)).order('date'),
  ]);
  const firstError = [money, tasks, deadlines].map((result) => result.error).find(Boolean);
  if (firstError) return NextResponse.json({ error: firstError.message }, { status: 500 });

  let review;
  try {
    const raw = await callClaude({
      system: SYSTEM,
      user: `Prepare this Friday review from the following JSON.\n\n${JSON.stringify({ date, money: money.data ?? [], tasks: tasks.data ?? [], deadlines: deadlines.data ?? [] })}`,
    });
    review = parseFridayReview(raw);
  } catch (error) {
    if (error instanceof ClaudeConfigurationError) {
      return NextResponse.json({ error: 'Phase 2 is not configured' }, { status: 503 });
    }
    return NextResponse.json({ error: 'The Friday review could not be generated' }, { status: 502 });
  }

  const saved = await auth.supabase.from('check_ins').insert({
    user_id: auth.userId,
    kind: 'friday_money',
    date,
    payload: { review, generatedAt: new Date().toISOString() },
  });
  if (saved.error) return NextResponse.json({ error: saved.error.message }, { status: 500 });
  return NextResponse.json({ ok: true, cached: false, review });
}
