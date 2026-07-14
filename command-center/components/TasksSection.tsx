'use client';

import { useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { daysUntil, fmtShort } from '@/lib/dates';
import type { Task, Venture } from '@/lib/types';
import CheckIcon from './CheckIcon';

const GROUPS: { key: string; label: string }[] = [
  { key: 'client_followup', label: 'Clients' },
  { key: 'listing', label: 'Listings' },
  { key: 'airbnb', label: 'Airbnb' },
  { key: 'tiffanie', label: 'Tiffanie' },
  { key: 'lance', label: 'Lance' },
  { key: 'admin', label: 'Admin' },
  { key: 'uncategorized', label: 'Other' },
];

const CATEGORY_OPTIONS = [
  { value: '', label: 'No category' },
  { value: 'client_followup', label: 'Client follow-up' },
  { value: 'listing', label: 'Listing' },
  { value: 'airbnb', label: 'Airbnb' },
  { value: 'tiffanie', label: 'Tiffanie' },
  { value: 'lance', label: 'Lance' },
  { value: 'admin', label: 'Admin' },
  { value: 'other', label: 'Other' },
];

const EMPTY_FORM = {
  title: '',
  venture_id: '',
  category: '',
  person: '',
  priority: '3',
  due_date: '',
};

interface Props {
  tasks: Task[];
  ventures: Venture[];
  userId: string;
  onChange: () => void;
}

export default function TasksSection({ tasks, ventures, userId, onChange }: Props) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const supabase = getSupabase();

  const open = tasks.filter((t) => t.status === 'open');
  const ventureName = new Map(ventures.map((v) => [v.id, v.name]));

  function groupKey(t: Task): string {
    return t.category && t.category !== 'other' ? t.category : 'uncategorized';
  }

  async function complete(t: Task) {
    await supabase.from('tasks').update({ status: 'done' }).eq('id', t.id);
    onChange();
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    const { error } = await supabase.from('tasks').insert({
      user_id: userId,
      title: form.title.trim(),
      venture_id: form.venture_id || null,
      category: form.category || null,
      person: form.person.trim() || null,
      priority: Number(form.priority),
      due_date: form.due_date || null,
    });
    if (!error) {
      setForm(EMPTY_FORM);
      setAdding(false);
      onChange();
    }
  }

  function meta(t: Task): string {
    const parts: string[] = [];
    if (t.venture_id && ventureName.get(t.venture_id)) parts.push(ventureName.get(t.venture_id)!);
    if (t.person) parts.push(t.person);
    return parts.join(' / ');
  }

  return (
    <details className="section card">
      <summary>
        <div className="section-label">
          <span>Also today</span>
          <span className={open.length ? 'badge' : 'badge zero'}>{open.length}</span>
        </div>
      </summary>

      {open.length === 0 ? <div className="empty">Nothing else on deck.</div> : null}

      {GROUPS.map(({ key, label }) => {
        const items = open.filter((t) => groupKey(t) === key);
        if (items.length === 0) return null;
        return (
          <div key={key}>
            <div className="group-label">{label}</div>
            {items.map((t) => {
              const overdue = t.due_date ? daysUntil(t.due_date) < 0 : false;
              return (
                <div className="row" key={t.id}>
                  <button className="check" onClick={() => complete(t)} aria-label="Complete">
                    <CheckIcon />
                  </button>
                  <div className="grow">
                    <div className="title">
                      {t.priority === 1 ? <span className="p1">P1</span> : null}
                      {t.title}
                    </div>
                    {meta(t) ? <div className="meta">{meta(t)}</div> : null}
                  </div>
                  {t.due_date ? (
                    <span className={overdue ? 'num hot' : 'num'}>{fmtShort(t.due_date)}</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        );
      })}

      {adding ? (
        <form className="form-grid" onSubmit={addTask}>
          <div className="span-2">
            <label className="field">Task</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="What needs doing"
              autoFocus
            />
          </div>
          <div>
            <label className="field">Venture</label>
            <select value={form.venture_id} onChange={(e) => setForm({ ...form, venture_id: e.target.value })}>
              <option value="">None</option>
              {ventures.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field">Category</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field">Person</label>
            <input
              value={form.person}
              onChange={(e) => setForm({ ...form, person: e.target.value })}
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="field">Priority</label>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="1">1 (today)</option>
              <option value="2">2 (this week)</option>
              <option value="3">3 (whenever)</option>
            </select>
          </div>
          <div className="span-2">
            <label className="field">Due date</label>
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </div>
          <div className="form-actions">
            <button type="button" className="btn-ghost" onClick={() => setAdding(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-signal">
              Add task
            </button>
          </div>
        </form>
      ) : (
        <div className="actions">
          <button className="btn-chip" onClick={() => setAdding(true)}>
            + Add task
          </button>
        </div>
      )}
    </details>
  );
}
