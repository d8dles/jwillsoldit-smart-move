'use client';

import { getSupabase } from '@/lib/supabase';
import type { DailyThree, Task, Venture } from '@/lib/types';
import CheckIcon from './CheckIcon';

type SlotKey = 'engine' | 'build' | 'money';

const SLOTS: { key: SlotKey; label: string; prompt: string }[] = [
  { key: 'engine', label: 'ENGINE', prompt: 'Pick the engine move' },
  { key: 'build', label: 'BUILD', prompt: 'Pick the build move' },
  { key: 'money', label: 'MONEY', prompt: 'Pick the money move' },
];

interface Props {
  dailyThree: DailyThree | null;
  tasks: Task[];
  ventures: Venture[];
  userId: string;
  date: string;
  onChange: () => void;
}

function slotState(d3: DailyThree | null, key: SlotKey): { taskId: string | null; done: boolean } {
  if (!d3) return { taskId: null, done: false };
  if (key === 'engine') return { taskId: d3.engine_task_id, done: d3.engine_done };
  if (key === 'build') return { taskId: d3.build_task_id, done: d3.build_done };
  return { taskId: d3.money_task_id, done: d3.money_done };
}

export default function DailyThreeSection({ dailyThree, tasks, ventures, userId, date, onChange }: Props) {
  const supabase = getSupabase();
  const tierById = new Map(ventures.map((v) => [v.id, v.tier]));

  function candidates(key: SlotKey): Task[] {
    const open = tasks.filter((t) => t.status === 'open');
    if (key === 'engine') {
      return open.filter((t) => t.venture_id && tierById.get(t.venture_id) === 'engine');
    }
    if (key === 'build') {
      return open.filter((t) => t.venture_id && tierById.get(t.venture_id) === 'build');
    }
    return open;
  }

  async function save(patch: Record<string, unknown>) {
    const { error } = await supabase
      .from('daily_three')
      .upsert({ user_id: userId, date, ...patch }, { onConflict: 'user_id,date' });
    if (!error) onChange();
  }

  async function toggleDone(key: SlotKey) {
    const { taskId, done } = slotState(dailyThree, key);
    const nowDone = !done;
    await save({ [`${key}_done`]: nowDone });
    // The slot IS the task: checking it off completes the underlying task too.
    if (taskId) {
      await supabase
        .from('tasks')
        .update({ status: nowDone ? 'done' : 'open' })
        .eq('id', taskId);
      onChange();
    }
  }

  const doneCount = SLOTS.filter((s) => slotState(dailyThree, s.key).done).length;

  return (
    <section className="card">
      <div className="section-label">
        <span>Daily Three</span>
        <span className="num">{doneCount}/3</span>
      </div>
      {SLOTS.map(({ key, label, prompt }) => {
        const { taskId, done } = slotState(dailyThree, key);
        const task = taskId ? tasks.find((t) => t.id === taskId) : undefined;
        return (
          <div className="slot" key={key}>
            <span className="slot-tag">{label}</span>
            {task ? (
              <>
                <button
                  className={done ? 'check on' : 'check'}
                  onClick={() => toggleDone(key)}
                  aria-label={done ? 'Reopen' : 'Complete'}
                >
                  <CheckIcon />
                </button>
                <span className={`title grow${done ? ' done' : ''}`}>{task.title}</span>
                <button
                  className="btn-ghost"
                  onClick={() => save({ [`${key}_task_id`]: null, [`${key}_done`]: false })}
                >
                  Swap
                </button>
              </>
            ) : (
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    save({ [`${key}_task_id`]: e.target.value, [`${key}_done`]: false });
                  }
                }}
              >
                <option value="">{prompt}</option>
                {candidates(key).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            )}
          </div>
        );
      })}
    </section>
  );
}
