'use client';

import { useState } from 'react';
import { postPhase2 } from './phase2-api';
import type { FridayReview as FridayReviewData } from '@/lib/phase2';

export default function FridayReview() {
  const [review, setReview] = useState<FridayReviewData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run() {
    setBusy(true);
    setError('');
    try {
      const result = await postPhase2<{ review: FridayReviewData }>('/api/friday');
      setReview(result.review);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The Friday review could not be loaded.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <div className="section-label">
        <span>Friday review</span>
        <button className="btn-chip" disabled={busy} onClick={run}>{busy ? 'Working…' : review ? 'Refresh' : 'Run review'}</button>
      </div>
      {error ? <div className="phase2-error">{error}</div> : null}
      {review ? (
        <>
          <h2 className="brief-headline">{review.headline}</h2>
          <div className="meta">{review.summary}</div>
          <div className="group-label">Questions</div>
          <ul className="brief-list">{review.questions.map((item) => <li key={item}>{item}</li>)}</ul>
          <div className="group-label">Next week</div>
          <ul className="brief-list">{review.nextWeek.map((item) => <li key={item}>{item}</li>)}</ul>
        </>
      ) : <div className="empty">Run this when you are ready to close the week.</div>}
    </section>
  );
}
