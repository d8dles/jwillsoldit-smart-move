'use client';

import { useState } from 'react';
import { getSupabase } from '@/lib/supabase';

export default function QuickAdd({ userId, onChange }: { userId: string; onChange: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setBusy(true);
    const { error } = await getSupabase()
      .from('inbox')
      .insert({ user_id: userId, raw_text: value });
    setBusy(false);
    if (!error) {
      setText('');
      onChange();
    }
  }

  return (
    <form className="quick-add" onSubmit={add}>
      <input
        placeholder="Drop a thought. Sort it later."
        value={text}
        onChange={(e) => setText(e.target.value)}
        enterKeyHint="send"
      />
      <button className="btn-signal" type="submit" disabled={busy}>
        Add
      </button>
    </form>
  );
}
