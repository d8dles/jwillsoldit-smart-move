'use client';

import { useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { daysUntil, fmtShort } from '@/lib/dates';
import type { MoneyItem, MoneyKind } from '@/lib/types';

const KIND_LABELS: Record<MoneyKind, string> = {
  commission: 'Commission',
  lease_pending: 'Lease pending',
  rental_income: 'Rental income',
  bill: 'Bill',
  expense: 'Expense',
  invoice_out: 'Invoice to send',
};

const INCOMING: MoneyKind[] = ['commission', 'lease_pending', 'rental_income', 'invoice_out'];

const EMPTY_FORM = { label: '', kind: 'commission', amount: '', due_date: '', counterparty: '' };

interface Props {
  items: MoneyItem[];
  userId: string;
  onChange: () => void;
}

function amt(i: MoneyItem): number {
  return i.amount == null ? 0 : Number(i.amount);
}

function fmtMoney(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

export default function MoneySection({ items, userId, onChange }: Props) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState('');
  const [edit, setEdit] = useState(EMPTY_FORM);
  const supabase = getSupabase();

  // Open = still in play. Received and paid items drop off the screen.
  const live = items.filter((i) => i.status === 'open' || i.status === 'sent');
  const liveIn = live.filter((i) => INCOMING.includes(i.kind));
  const liveOut = live.filter((i) => !INCOMING.includes(i.kind));

  const pendingIn = liveIn.reduce((s, i) => s + amt(i), 0);
  const weekIn = liveIn
    .filter((i) => i.due_date && daysUntil(i.due_date) <= 7)
    .reduce((s, i) => s + amt(i), 0);
  const out14 = liveOut
    .filter((i) => i.due_date && daysUntil(i.due_date) <= 14)
    .reduce((s, i) => s + amt(i), 0);
  const invoicesToSend = items.filter((i) => i.kind === 'invoice_out' && i.status === 'open');
  const gap = pendingIn - out14;

  async function setStatus(i: MoneyItem, status: MoneyItem['status']) {
    await supabase.from('money_items').update({ status }).eq('id', i.id);
    onChange();
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!form.label.trim()) return;
    const { error } = await supabase.from('money_items').insert({
      user_id: userId,
      label: form.label.trim(),
      kind: form.kind,
      amount: form.amount === '' ? null : Number(form.amount),
      due_date: form.due_date || null,
      counterparty: form.counterparty.trim() || null,
    });
    if (!error) {
      setForm(EMPTY_FORM);
      setAdding(false);
      onChange();
    }
  }

  async function saveEdit(id: string) {
    if (!edit.label.trim()) return;
    const { error } = await supabase
      .from('money_items')
      .update({
        label: edit.label.trim(),
        kind: edit.kind,
        amount: edit.amount === '' ? null : Number(edit.amount),
        due_date: edit.due_date || null,
        counterparty: edit.counterparty.trim() || null,
      })
      .eq('id', id);
    if (!error) {
      setEditingId('');
      onChange();
    }
  }

  function nextAction(i: MoneyItem): { label: string; status: MoneyItem['status'] } | null {
    if (i.kind === 'invoice_out') {
      if (i.status === 'open') return { label: 'Mark sent', status: 'sent' };
      if (i.status === 'sent') return { label: 'Mark paid', status: 'paid' };
      return null;
    }
    if (INCOMING.includes(i.kind)) {
      return i.status === 'open' ? { label: 'Received', status: 'received' } : null;
    }
    return i.status === 'open' ? { label: 'Paid', status: 'paid' } : null;
  }

  function meta(i: MoneyItem): string {
    const parts: string[] = [KIND_LABELS[i.kind]];
    if (i.status === 'sent') parts.push('sent');
    if (i.counterparty) parts.push(i.counterparty);
    return parts.join(' / ');
  }

  return (
    <section className="card">
      <div className="section-label">
        <span>Money</span>
        <span className="num">{live.length} in play</span>
      </div>

      <div className="tiles">
        <div className="tile">
          <div className="k">In this week</div>
          <div className="v">{fmtMoney(weekIn)}</div>
        </div>
        <div className="tile">
          <div className="k">Pending in</div>
          <div className="v">{fmtMoney(pendingIn)}</div>
        </div>
        <div className="tile">
          <div className="k">Due out 14d</div>
          <div className="v">{fmtMoney(out14)}</div>
        </div>
        <div className="tile">
          <div className="k">Invoices to send</div>
          <div className={invoicesToSend.length ? 'v hot' : 'v'}>{invoicesToSend.length}</div>
        </div>
      </div>
      <div className="gap-line">
        {gap >= 0 ? (
          <span>Gap: covered, {fmtMoney(gap)} margin on pending</span>
        ) : (
          <span className="hot">Gap: {fmtMoney(-gap)} short against the next 14d</span>
        )}
      </div>

      {live.map((i) => {
        if (editingId === i.id) {
          return (
            <form
              className="form-grid"
              key={i.id}
              onSubmit={(e) => {
                e.preventDefault();
                saveEdit(i.id);
              }}
            >
              <div className="span-2">
                <label className="field">Label</label>
                <input value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} />
              </div>
              <div>
                <label className="field">Kind</label>
                <select value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value })}>
                  {Object.entries(KIND_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={edit.amount}
                  onChange={(e) => setEdit({ ...edit, amount: e.target.value })}
                />
              </div>
              <div>
                <label className="field">Due date</label>
                <input type="date" value={edit.due_date} onChange={(e) => setEdit({ ...edit, due_date: e.target.value })} />
              </div>
              <div>
                <label className="field">Counterparty</label>
                <input
                  value={edit.counterparty}
                  onChange={(e) => setEdit({ ...edit, counterparty: e.target.value })}
                />
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={async () => {
                    await supabase.from('money_items').delete().eq('id', i.id);
                    setEditingId('');
                    onChange();
                  }}
                >
                  Delete
                </button>
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
        const action = nextAction(i);
        const overdue = i.due_date ? daysUntil(i.due_date) < 0 : false;
        return (
          <div className="row" key={i.id}>
            <div className="grow">
              <div className="title">{i.label}</div>
              <div className="meta">
                {meta(i)}
                {i.due_date ? (
                  <span className={overdue ? 'overdue' : ''}> / due {fmtShort(i.due_date)}</span>
                ) : null}
              </div>
            </div>
            <span className="num">{i.amount == null ? '' : fmtMoney(amt(i))}</span>
            {action ? (
              <button className="btn-chip" onClick={() => setStatus(i, action.status)}>
                {action.label}
              </button>
            ) : null}
            <button
              className="btn-ghost"
              onClick={() => {
                setEditingId(i.id);
                setEdit({
                  label: i.label,
                  kind: i.kind,
                  amount: i.amount == null ? '' : String(i.amount),
                  due_date: i.due_date ?? '',
                  counterparty: i.counterparty ?? '',
                });
              }}
            >
              Edit
            </button>
          </div>
        );
      })}

      {adding ? (
        <form className="form-grid" onSubmit={addItem}>
          <div className="span-2">
            <label className="field">Label</label>
            <input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="What money is moving"
              autoFocus
            />
          </div>
          <div>
            <label className="field">Kind</label>
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              {Object.entries(KIND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field">Amount</label>
            <input
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0"
            />
          </div>
          <div>
            <label className="field">Due date</label>
            <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </div>
          <div>
            <label className="field">Counterparty</label>
            <input
              value={form.counterparty}
              onChange={(e) => setForm({ ...form, counterparty: e.target.value })}
              placeholder="Optional"
            />
          </div>
          <div className="form-actions">
            <button type="button" className="btn-ghost" onClick={() => setAdding(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-signal">
              Add item
            </button>
          </div>
        </form>
      ) : (
        <div className="actions">
          <button className="btn-chip" onClick={() => setAdding(true)}>
            + Add money item
          </button>
        </div>
      )}
    </section>
  );
}
