export type Brief = {
  headline: string;
  focus: string[];
  risks: string[];
  nextAction: string;
};

export type TriageKind = 'task' | 'money_item' | 'deadline' | 'idea';

export type TriageSuggestion = {
  inboxId: string;
  kind: TriageKind;
  title: string;
  rationale: string;
  priority?: 1 | 2 | 3;
  dueDate?: string | null;
  amount?: number | null;
  counterparty?: string | null;
  category?: string | null;
  deadlineKind?: 'wgu' | 'tenant_lease' | 'other';
};

export type FridayReview = {
  headline: string;
  summary: string;
  questions: string[];
  nextWeek: string[];
};

type JsonObject = Record<string, unknown>;

function parseObject(raw: string, label: string): JsonObject {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const source = fenced?.[1]?.trim() ?? trimmed;
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error(`Invalid ${label} response`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Invalid ${label} response`);
  }
  return parsed as JsonObject;
}

function requiredString(value: unknown, label: string, max = 500): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new Error(`Invalid ${label} response`);
  }
  return value.trim();
}

function stringArray(value: unknown, label: string, maxItems = 8): string[] {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new Error(`Invalid ${label} response`);
  }
  return value.map((item) => requiredString(item, label, 240));
}

function optionalString(value: unknown, label: string, max = 240): string | null | undefined {
  if (value === undefined || value === null || value === '') return value === null ? null : undefined;
  return requiredString(value, label, max);
}

export function parseBrief(raw: string): Brief {
  const value = parseObject(raw, 'brief');
  return {
    headline: requiredString(value.headline, 'brief', 160),
    focus: stringArray(value.focus, 'brief', 5),
    risks: stringArray(value.risks, 'brief', 5),
    nextAction: requiredString(value.nextAction, 'brief', 240),
  };
}

export function parseTriageSuggestions(raw: string): { suggestions: TriageSuggestion[] } {
  const value = parseObject(raw, 'triage');
  if (!Array.isArray(value.suggestions) || value.suggestions.length > 20) {
    throw new Error('Invalid triage response');
  }
  const suggestions = value.suggestions.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('Invalid triage response');
    }
    const suggestion = item as JsonObject;
    const kind = suggestion.kind;
    if (!['task', 'money_item', 'deadline', 'idea'].includes(String(kind))) {
      throw new Error('Invalid triage response');
    }
    const priority = suggestion.priority === undefined ? undefined : Number(suggestion.priority);
    if (priority !== undefined && ![1, 2, 3].includes(priority)) {
      throw new Error('Invalid triage response');
    }
    const amount = suggestion.amount === undefined || suggestion.amount === null || suggestion.amount === ''
      ? suggestion.amount === null ? null : undefined
      : Number(suggestion.amount);
    if (amount !== undefined && (typeof amount !== 'number' || !Number.isFinite(amount))) {
      throw new Error('Invalid triage response');
    }
    const deadlineKind = suggestion.deadlineKind === undefined ? undefined : String(suggestion.deadlineKind);
    if (deadlineKind !== undefined && !['wgu', 'tenant_lease', 'other'].includes(deadlineKind)) {
      throw new Error('Invalid triage response');
    }
    return {
      inboxId: requiredString(suggestion.inboxId, 'triage', 80),
      kind: kind as TriageKind,
      title: requiredString(suggestion.title, 'triage', 240),
      rationale: requiredString(suggestion.rationale, 'triage', 400),
      ...(priority === undefined ? {} : { priority: priority as 1 | 2 | 3 }),
      ...(suggestion.dueDate === undefined || suggestion.dueDate === null
        ? { dueDate: suggestion.dueDate === null ? null : undefined }
        : { dueDate: requiredString(suggestion.dueDate, 'triage', 20) }),
      ...(amount === undefined ? {} : { amount }),
      ...(optionalString(suggestion.counterparty, 'triage') !== undefined
        ? { counterparty: optionalString(suggestion.counterparty, 'triage') }
        : {}),
      ...(optionalString(suggestion.category, 'triage') !== undefined
        ? { category: optionalString(suggestion.category, 'triage') }
        : {}),
      ...(deadlineKind === undefined ? {} : { deadlineKind: deadlineKind as TriageSuggestion['deadlineKind'] }),
    };
  });
  return { suggestions };
}

export function parseFridayReview(raw: string): FridayReview {
  const value = parseObject(raw, 'Friday review');
  return {
    headline: requiredString(value.headline, 'Friday review', 160),
    summary: requiredString(value.summary, 'Friday review', 600),
    questions: stringArray(value.questions, 'Friday review', 5),
    nextWeek: stringArray(value.nextWeek, 'Friday review', 7),
  };
}
