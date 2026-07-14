'use client';

import { useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { daysSince, todayStr } from '@/lib/dates';
import type { Client } from '@/lib/types';

const TYPE_LABELS: Record<Client['type'], string> = {
  buyer: 'Buyer',
  renter: 'Renter',
  tenant: 'Tenant',
  airbnb_guest: 'Airbnb guest',
  partner: 'Partner',
};

const EMPTY_FORM = { name: '', type: 'buyer', checkin_cadence_days: '7', notes: '' };

interface Props {
  clients: Client[];
  userId: string;
  onChange: () => void;
}

// Never-contacted sorts as maximally overdue.
function overdueBy(c: Client): number {
  if (!c.last_contact) return 9999;
  return daysSince(c.last_contact) - c.checkin_cadence_days;
}

export default function ClientsSection({ clients, userId, onChange }: Props) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const supabase = getSupabase();

  const sorted = [...clients].sort((a, b) => overdueBy(b) - overdueBy(a));
  const overdueCount = clients.filter((c) => overdueBy(c) > 0).length;

  async function logContact(c: Client) {
    await supabase.from('clients').update({ last_contact: todayStr() }).eq('id', c.id);
    onChange();
  }

  async function addClient(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const { error } = await supabase.from('clients').insert({
      user_id: userId,
      name: form.name.trim(),
      type: form.type,
      checkin_cadence_days: Number(form.checkin_cadence_days) || 7,
      notes: form.notes.trim() || null,
    });
    if (!error) {
      setForm(EMPTY_FORM);
      setAdding(false);
      onChange();
    }
  }

  return (
    <section className="card">
      <div className="section-label">
        <span>Client check-ins</span>
        <span className={overdueCount ? 'badge' : 'badge zero'}>{overdueCount} overdue</span>
      </div>

      {sorted.length === 0 ? <div className="empty">No active clients yet.</div> : null}

      {sorted.map((c) => {
        const over = overdueBy(c) > 0;
        const since = c.last_contact ? `${daysSince(c.last_contact)}d` : 'never';
        return (
          <div className="row" key={c.id}>
            <div className="grow">
              <div className="title">{c.name}</div>
              <div className="meta">
                {TYPE_LABELS[c.type]} / every {c.checkin_cadence_days}d
                {over ? <span className="overdue"> / check in</span> : null}
              </div>
            </div>
            <span className={over ? 'num hot' : 'num'}>{since}</span>
            <button className="btn-chip" onClick={() => logContact(c)}>
              Log contact
            </button>
          </div>
        );
      })}

      {adding ? (
        <form className="form-grid" onSubmit={addClient}>
          <div className="span-2">
            <label className="field">Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Client name"
              autoFocus
            />
          </div>
          <div>
            <label className="field">Type</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field">Check-in every (days)</label>
            <input
              type="number"
              min="1"
              value={form.checkin_cadence_days}
              onChange={(e) => setForm({ ...form, checkin_cadence_days: e.target.value })}
            />
          </div>
          <div className="span-2">
            <label className="field">Notes</label>
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional"
            />
          </div>
          <div className="form-actions">
            <button type="button" className="btn-ghost" onClick={() => setAdding(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-signal">
              Add client
            </button>
          </div>
        </form>
      ) : (
        <div className="actions">
          <button className="btn-chip" onClick={() => setAdding(true)}>
            + Add client
          </button>
        </div>
      )}
    </section>
  );
}
