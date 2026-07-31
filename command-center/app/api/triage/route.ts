import { NextResponse } from 'next/server';
import { addDaysStr } from '@/lib/dates';
import { callClaude, ClaudeConfigurationError } from '@/lib/anthropic';
import { parseTriageSuggestions, type TriageSuggestion } from '@/lib/phase2';
import { isAuthFailure, requireUser } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const SYSTEM = [
  'You sort an inbox for a solo real-estate and small-business operator.',
  'Use only the supplied inbox text. Do not invent context.',
  'Return JSON only: {"suggestions":[...]}. Every suggestion must include the exact inboxId, kind (task, money_item, deadline, or idea), title, and rationale.',
  'Optional fields are priority (1, 2, or 3), dueDate (YYYY-MM-DD or null), amount, counterparty, category, and deadlineKind (wgu, tenant_lease, or other).',
  'Suggest one destination per inbox item. Do not include anything for an item that cannot be confidently sorted.',
].join(' ');

const TASK_CATEGORIES = new Set(['client_followup', 'listing', 'airbnb', 'tiffanie', 'lance', 'admin', 'other']);

function validDate(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : value;
}

async function readBody(req: Request): Promise<{ inboxId?: string; apply?: boolean; suggestion?: unknown } | null> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? body : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (isAuthFailure(auth)) return auth.response;
  const body = await readBody(req);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  if (body.apply) {
    let suggestion: TriageSuggestion;
    try {
      const parsed = parseTriageSuggestions(JSON.stringify({ suggestions: [body.suggestion] }));
      suggestion = parsed.suggestions[0];
    } catch {
      return NextResponse.json({ error: 'A valid suggestion is required' }, { status: 400 });
    }

    const inboxItem = await auth.supabase
      .from('inbox')
      .select('id,raw_text')
      .eq('id', suggestion.inboxId)
      .eq('status', 'unsorted')
      .maybeSingle();
    if (inboxItem.error) return NextResponse.json({ error: inboxItem.error.message }, { status: 500 });
    if (!inboxItem.data) return NextResponse.json({ error: 'That inbox item is no longer unsorted' }, { status: 409 });

    let table: 'tasks' | 'money_items' | 'deadlines' | 'ideas';
    let values: Record<string, unknown>;
    if (suggestion.kind === 'task') {
      table = 'tasks';
      values = {
        user_id: auth.userId,
        title: suggestion.title,
        notes: suggestion.rationale,
        priority: suggestion.priority ?? 3,
        due_date: validDate(suggestion.dueDate),
        category: suggestion.category && TASK_CATEGORIES.has(suggestion.category) ? suggestion.category : 'other',
        source: 'ai_suggested',
      };
    } else if (suggestion.kind === 'money_item') {
      table = 'money_items';
      values = {
        user_id: auth.userId,
        label: suggestion.title,
        kind: 'bill',
        amount: suggestion.amount ?? null,
        due_date: validDate(suggestion.dueDate),
        counterparty: suggestion.counterparty ?? null,
      };
    } else if (suggestion.kind === 'deadline') {
      table = 'deadlines';
      values = {
        user_id: auth.userId,
        title: suggestion.title,
        kind: suggestion.deadlineKind ?? 'other',
        date: validDate(suggestion.dueDate) ?? addDaysStr(7),
        notes: suggestion.rationale,
      };
    } else {
      table = 'ideas';
      values = { user_id: auth.userId, text: `${suggestion.title} — ${suggestion.rationale}` };
    }

    const inserted = await auth.supabase.from(table).insert(values).select('id').single();
    if (inserted.error || !inserted.data?.id) {
      return NextResponse.json({ error: inserted.error?.message ?? 'Could not apply suggestion' }, { status: 500 });
    }
    const marked = await auth.supabase
      .from('inbox')
      .update({ status: 'triaged', triaged_to: suggestion.kind, triaged_ref: inserted.data.id })
      .eq('id', suggestion.inboxId)
      .eq('status', 'unsorted');
    if (marked.error) {
      await auth.supabase.from(table).delete().eq('id', inserted.data.id);
      return NextResponse.json({ error: marked.error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, applied: { ...suggestion, ref: inserted.data.id } });
  }

  const inboxQuery = auth.supabase
    .from('inbox')
    .select('id,raw_text,created_at')
    .eq('status', 'unsorted')
    .order('created_at')
    .limit(20);
  const inbox = body.inboxId ? await inboxQuery.eq('id', body.inboxId) : await inboxQuery;
  if (inbox.error) return NextResponse.json({ error: inbox.error.message }, { status: 500 });
  if (!inbox.data?.length) return NextResponse.json({ ok: true, suggestions: [] });

  let suggestions;
  try {
    const raw = await callClaude({
      system: SYSTEM,
      user: `Sort these unsorted inbox items.\n\n${JSON.stringify(inbox.data)}`,
    });
    suggestions = parseTriageSuggestions(raw).suggestions;
  } catch (error) {
    if (error instanceof ClaudeConfigurationError) {
      return NextResponse.json({ error: 'Phase 2 is not configured' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Inbox suggestions could not be generated' }, { status: 502 });
  }
  const validIds = new Set((inbox.data as Array<{ id: string }>).map((item) => item.id));
  return NextResponse.json({ ok: true, suggestions: suggestions.filter((item) => validIds.has(item.inboxId)) });
}
