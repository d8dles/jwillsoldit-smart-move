'use client';

import { useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { daysUntil, fmtShort } from '@/lib/dates';
import type { Deadline, DeadlineKind } from '@/lib/types';

const KIND_LABELS: Record<DeadlineKind, string> = {
  wgu: 'WGU / A+',
  tenant_lease: 'Tenants and leases',
  other: 'Other',
};

const EMPTY_FORM = { title: '', kind: 'wgu', date: '', notes: '' };

interface Props {
  deadlines: Deadline[];
  userId: string;
  onChange: () => void;
}

export default function DeadlinesSection({ deadlines, userId, onChange }: Props) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState('');
  const [edit, setEdit] = useState({ title: '', date: '', notes: '' });
  const supabase = getSupabase();

  async function addDeadline(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.date) return;
    const { error } = await supabase.from('deadlines').insert({
      user_id: userId,
      title: form.title.trim(),
      kind: form.kind,
      date: form.date,
      notes: form.notes.trim() || null,
    });
    if (!error) {
      setForm(EMPTY_FORM);
      setAdding(false);
      onChange();
    }
  }

  async function saveEdit(id: string) {
    if (!edit.title.trim() || !edit.date) return;
    const { error } = await supabase
      .from('deadlines')
      .update({ title: edit.title.trim(), date: edit.date, notes: edit.notes.trim() || null })
      .eq('id', id);
    if (!error) {
      setEditingId('');
      onChange();
    }
  }

  async function remove(id: string) {
    await supabase.from('deadlines').delete().eq('id', id);
    onChange();
  }

  return (
    <section className="card">
      <div className="section-label">
        <span>Deadlines / next 14d</span>
        <span className={deadlines.length ? 'badge' : 'badge zero'}>{deadlines.length}</span>
      </div>

      {deadlines.length === 0 ? <div className="empty">Nothing due in the next two weeks.</div> : null}

      {(Object.keys(KIND_LABELS) as DeadlineKind[]).map((kind) => {
        const items = deadlines.filter((d) => d.kind === kind);
        if (items.length === 0) return null;
        return (
          <div key={kind}>
            <div className="group-label">{KIND_LABELS[kind]}</div>
            {items.map((d) => {
              const left = daysUntil(d.date);
              if (editingId === d.id) {
                return (
                  <form
                    className="form-grid"
                    key={d.id}
                    onSubmit={(e) => {
                      e.preventDefault();
                      saveEdit(d.id);
                    }}
                  >
                    <div className="span-2">
                      <label className="field">Title</label>
                      <input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
                    </div>
                    <div>
                      <label className="field">Date</label>
                      <input type="date" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} />
                    </div>
                    <div>
                      <label className="field">Notes</label>
                      <input value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
                    </div>
                    <div className="form-actions">
                      <button type="button" className="btn-ghost" onClick={() => setEditingId('')}>
                        Cancel
                      </button>
                      <button type="submit" className="btn-signal">
                        Save
                      </button>
                    </div>
                  </form>
                );
              }
              return (
                <div className="row" key={d.id}>
                  <div className="grow">
                    <div className="title">{d.title}</div>
                    {d.notes ? <div className="meta">{d.notes}</div> : null}
                  </div>
                  <span className={left <= 3 ? 'num hot' : 'num'}>
                    {fmtShort(d.date)} / {left}d
                  </span>
                  <button
                    className="btn-ghost"
                    onClick={() => {
                      setEditingId(d.id);
                      setEdit({ title: d.title, date: d.date, notes: d.notes ?? '' });
                    }}
                  >
                    Edit
                  </button>
                  <button className="btn-ghost" onClick={() => remove(d.id)}>
                    Clear
                  </button>
                </div>
              );
            })}
          </div>
        );
      })}

      {adding ? (
        <form className="form-grid" onSubmit={addDeadline}>
          <div className="span-2">
            <label className="field">Title</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="What is due"
              autoFocus
            />
          </div>
          <div>
            <label className="field">Kind</label>
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              <option value="wgu">WGU / A+</option>
              <option value="tenant_lease">Tenant / lease</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="field">Date</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          </div>
          <div className="span-2">
            <label className="field">Notes</label>
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" />
          </div>
          <div className="form-actions">
            <button type="button" className="btn-ghost" onClick={() => setAdding(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-signal">
              Add deadline
            </button>
          </div>
        </form>
      ) : (
        <div className="actions">
          <button className="btn-chip" onClick={() => setAdding(true)}>
            + Add deadline
          </button>
        </div>
      )}
    </section>
  );
}
