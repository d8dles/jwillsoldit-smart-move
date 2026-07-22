'use client';

import { getSupabase } from '@/lib/supabase';

export async function postPhase2<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Your session expired. Sign in again.');

  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) throw new Error(payload.error || 'The request could not be completed.');
  return payload;
}
