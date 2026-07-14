'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { addDaysStr, fmtHeading, todayStr } from '@/lib/dates';
import type {
  Client,
  DailyThree,
  Deadline,
  InboxItem,
  MoneyItem,
  Task,
  Venture,
} from '@/lib/types';
import QuickAdd from './QuickAdd';
import InboxSection from './InboxSection';
import DailyThreeSection from './DailyThreeSection';
import TasksSection from './TasksSection';
import ClientsSection from './ClientsSection';
import DeadlinesSection from './DeadlinesSection';
import MoneySection from './MoneySection';

interface CenterData {
  ventures: Venture[];
  tasks: Task[];
  dailyThree: DailyThree | null;
  money: MoneyItem[];
  clients: Client[];
  deadlines: Deadline[];
  inbox: InboxItem[];
}

export default function CommandCenter({ userId }: { userId: string }) {
  const [data, setData] = useState<CenterData | null>(null);
  const [error, setError] = useState('');
  const today = todayStr();

  const load = useCallback(async () => {
    const supabase = getSupabase();
    const horizon = addDaysStr(14);

    const d3Res = await supabase.from('daily_three').select('*').eq('date', today).maybeSingle();
    const d3 = (d3Res.data as DailyThree | null) ?? null;

    // Tasks power both lists and the Daily Three slots, so completed tasks
    // that still sit in a slot today must come along too.
    const keepIds = [d3?.engine_task_id, d3?.build_task_id, d3?.money_task_id].filter(
      (id): id is string => Boolean(id),
    );
    let tasksQuery = supabase.from('tasks').select('*');
    if (keepIds.length) {
      tasksQuery = tasksQuery.or(`status.neq.done,id.in.(${keepIds.join(',')})`);
    } else {
      tasksQuery = tasksQuery.neq('status', 'done');
    }

    const [venturesRes, tasksRes, moneyRes, clientsRes, deadlinesRes, inboxRes] =
      await Promise.all([
        supabase.from('ventures').select('*').eq('status', 'active').order('name'),
        tasksQuery.order('priority').order('created_at'),
        supabase
          .from('money_items')
          .select('*')
          .order('due_date', { ascending: true, nullsFirst: false }),
        supabase.from('clients').select('*').eq('status', 'active').order('name'),
        supabase.from('deadlines').select('*').gte('date', today).lte('date', horizon).order('date'),
        supabase.from('inbox').select('*').eq('status', 'unsorted').order('created_at'),
      ]);

    const firstError = [d3Res, venturesRes, tasksRes, moneyRes, clientsRes, deadlinesRes, inboxRes]
      .map((r) => r.error)
      .find(Boolean);
    if (firstError) {
      setError(firstError.message);
      return;
    }
    setError('');
    setData({
      ventures: (venturesRes.data ?? []) as Venture[],
      tasks: (tasksRes.data ?? []) as Task[],
      dailyThree: d3,
      money: (moneyRes.data ?? []) as MoneyItem[],
      clients: (clientsRes.data ?? []) as Client[],
      deadlines: (deadlinesRes.data ?? []) as Deadline[],
      inbox: (inboxRes.data ?? []) as InboxItem[],
    });
  }, [today]);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) {
    return <div className="boot mono">{error || 'LOADING'}</div>;
  }

  return (
    <div className="shell">
      <QuickAdd userId={userId} onChange={load} />
      <header className="header">
        <div>
          <h1>COMMAND CENTER</h1>
          <div className="date-line">{fmtHeading(today)}</div>
        </div>
        <button className="btn-ghost" onClick={() => getSupabase().auth.signOut()}>
          Sign out
        </button>
      </header>
      {error ? <div className="error">{error}</div> : null}

      <InboxSection items={data.inbox} userId={userId} onChange={load} />
      <DailyThreeSection
        dailyThree={data.dailyThree}
        tasks={data.tasks}
        ventures={data.ventures}
        userId={userId}
        date={today}
        onChange={load}
      />
      <TasksSection tasks={data.tasks} ventures={data.ventures} userId={userId} onChange={load} />
      <ClientsSection clients={data.clients} userId={userId} onChange={load} />
      <DeadlinesSection deadlines={data.deadlines} userId={userId} onChange={load} />
      <MoneySection items={data.money} userId={userId} onChange={load} />

      <button className="btn-signal" style={{ width: '100%', marginTop: 14 }} disabled>
        Morning Brief (arrives in Phase 2)
      </button>
      <div className="footer-note">DONE IS A WON DAY</div>
    </div>
  );
}
