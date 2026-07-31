import { NextResponse } from 'next/server';
import { addDaysStr, todayStr } from '@/lib/dates';
import { callClaude, ClaudeConfigurationError } from '@/lib/anthropic';
import { parseBrief } from '@/lib/phase2';
import { isAuthFailure, requireUser } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const SYSTEM = [
  'You are the morning operating brief for a solo real-estate and small-business operator.',
  'Use only the supplied data. Do not invent facts, dates, amounts, or commitments.',
  'Return JSON only with exactly: headline (string), focus (array of up to 5 strings), risks (array of up to 5 strings), nextAction (string).',
  'Keep the language plain, specific, and action-oriented. Do not create tasks or change data.',
].join(' ');

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (isAuthFailure(auth)) return auth.response;

  const date = todayStr();
  const cached = await auth.supabase
    .from('check_ins')
    .select('payload')
    .eq('kind', 'daily')
    .eq('date', date)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const cachedBrief = cached.data?.payload?.brief;
  if (cachedBrief) return NextResponse.json({ ok: true, cached: true, brief: cachedBrief });

  const horizon = addDaysStr(14);
  const [ventures, tasks, dailyThree, clients, deadlines, money, inbox] = await Promise.all([
    auth.supabase.from('ventures').select('name,tier').eq('status', 'active').order('tier').order('name'),
    auth.supabase.from('tasks').select('title,priority,due_date,category,person').eq('status', 'open').order('priority').order('due_date'),
    auth.supabase.from('daily_three').select('engine_done,build_done,money_done').eq('date', date).maybeSingle(),
    auth.supabase.from('clients').select('name,type,last_contact,checkin_cadence_days').eq('status', 'active').order('name'),
    auth.supabase.from('deadlines').select('title,kind,date').gte('date', date).lte('date', horizon).order('date'),
    auth.supabase.from('money_items').select('label,kind,amount,due_date,status,counterparty').in('status', ['open', 'sent']).order('due_date'),
    auth.supabase.from('inbox').select('raw_text,created_at').eq('status', 'unsorted').order('created_at').limit(20),
  ]);
  const firstError = [ventures, tasks, dailyThree, clients, deadlines, money, inbox].map((result) => result.error).find(Boolean);
  if (firstError) return NextResponse.json({ error: firstError.message }, { status: 500 });

  const context = JSON.stringify({
    date,
    ventures: ventures.data ?? [],
    openTasks: tasks.data ?? [],
    dailyThree: dailyThree.data ?? null,
    activeClients: clients.data ?? [],
    deadlinesNext14Days: deadlines.data ?? [],
    moneyInPlay: money.data ?? [],
    unsortedInbox: inbox.data ?? [],
  });

  let brief;
  try {
    const raw = await callClaude({
      system: SYSTEM,
      user: `Prepare today's brief from this JSON.\n\n${context}`,
    });
    brief = parseBrief(raw);
  } catch (error) {
    if (error instanceof ClaudeConfigurationError) {
      return NextResponse.json({ error: 'Phase 2 is not configured' }, { status: 503 });
    }
    return NextResponse.json({ error: 'The morning brief could not be generated' }, { status: 502 });
  }

  const saved = await auth.supabase.from('check_ins').insert({
    user_id: auth.userId,
    kind: 'daily',
    date,
    payload: { brief, generatedAt: new Date().toISOString() },
  });
  if (saved.error) return NextResponse.json({ error: saved.error.message }, { status: 500 });
  return NextResponse.json({ ok: true, cached: false, brief });
}
