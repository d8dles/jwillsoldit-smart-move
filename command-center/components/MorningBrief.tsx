'use client';

import { useCallback, useEffect, useState } from 'react';
import { postPhase2 } from './phase2-api';
import type { Brief } from '@/lib/phase2';

type BriefResponse = { brief: Brief; cached: boolean };

export default function MorningBrief() {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const result = await postPhase2<BriefResponse>('/api/brief');
      setBrief(result.brief);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The morning brief could not be loaded.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="card brief-card">
      <div className="section-label">
        <span>Morning brief</span>
        {brief ? <span className="num">AI / today</span> : null}
      </div>
      {busy ? <div className="empty">Building today&apos;s brief…</div> : null}
      {error ? (
        <div className="phase2-error">
          <span>{error}</span>
          <button className="btn-chip" onClick={load}>Retry</button>
        </div>
      ) : null}
      {brief ? (
        <>
          <h2 className="brief-headline">{brief.headline}</h2>
          <div className="brief-grid">
            <div>
              <div className="group-label">Focus</div>
              <ul className="brief-list">{brief.focus.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
            <div>
              <div className="group-label">Watch</div>
              {brief.risks.length ? (
                <ul className="brief-list">{brief.risks.map((item) => <li key={item}>{item}</li>)}</ul>
              ) : <div className="empty">No risks called out.</div>}
            </div>
          </div>
          <div className="brief-next"><span className="mono">NEXT</span> {brief.nextAction}</div>
        </>
      ) : null}
    </section>
  );
}
