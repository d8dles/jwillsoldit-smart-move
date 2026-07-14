'use client';

import { useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { addDaysStr } from '@/lib/dates';
import type { InboxItem } from '@/lib/types';

type Target = 'task' | 'money_item' | 'deadline' | 'idea';

interface Props {
  items: InboxItem[];
  userId: string;
  onChange: () => void;
}

export default function InboxSection({ items, userId, onChange }: Props) {
  const [busyId, setBusyId] = useState('');

  async function fileAs(item: InboxItem, target: Target) {
    setBusyId(item.id);
    const supabase = getSupabase();
    let ref: string | null = null;
    let failed = false;

    if (target === 'task') {
      const res = await supabase
        .from('tasks')
        .insert({ user_id: userId, title: item.raw_text, source: 'inbox' })
        .select('id')
        .single();
      failed = Boolean(res.error);
      ref = res.data?.id ?? null;
    } else if (target === 'money_item') {
      // Files as a bill by default; kind and amount are editable in Money below.
      const res = await supabase
        .from('money_items')
        .insert({ user_id: userId, label: item.raw_text, kind: 'bill' })
        .select('id')
        .single();
      failed = Boolean(res.error);
      ref = res.data?.id ?? null;
    } else if (target === 'deadline') {
      // Placeholder date one week out; edit it in Deadlines below.
      const res = await supabase
        .from('deadlines')
        .insert({ user_id: userId, title: item.raw_text, kind: 'other', date: addDaysStr(7) })
        .select('id')
        .single();
      failed = Boolean(res.error);
      ref = res.data?.id ?? null;
    } else {
      const res = await supabase
        .from('ideas')
        .insert({ user_id: userId, text: item.raw_text })
        .select('id')
        .single();
      failed = Boolean(res.error);
      ref = res.data?.id ?? null;
    }

    if (!failed) {
      await supabase
        .from('inbox')
        .update({ status: 'triaged', triaged_to: target, triaged_ref: ref })
        .eq('id', item.id);
    }
    setBusyId('');
    onChange();
  }

  async function dismiss(item: InboxItem) {
    setBusyId(item.id);
    await getSupabase().from('inbox').update({ status: 'dismissed' }).eq('id', item.id);
    setBusyId('');
    onChange();
  }

  return (
    <section className="card">
      <div className="section-label">
        <span>Inbox</span>
        <span className={items.length ? 'badge' : 'badge zero'}>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="empty">Inbox zero.</div>
      ) : (
        items.map((item) => (
          <div className="row" key={item.id}>
            <div className="grow">
              <div className="title">{item.raw_text}</div>
              <div className="actions">
                <button className="btn-chip" disabled={busyId === item.id} onClick={() => fileAs(item, 'task')}>
                  Task
                </button>
                <button className="btn-chip" disabled={busyId === item.id} onClick={() => fileAs(item, 'money_item')}>
                  Money
                </button>
                <button className="btn-chip" disabled={busyId === item.id} onClick={() => fileAs(item, 'deadline')}>
                  Deadline
                </button>
                <button className="btn-chip" disabled={busyId === item.id} onClick={() => fileAs(item, 'idea')}>
                  Idea
                </button>
                <button className="btn-ghost" disabled={busyId === item.id} onClick={() => dismiss(item)}>
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </section>
  );
}
