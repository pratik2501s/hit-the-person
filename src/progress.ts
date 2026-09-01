const KEY = "venthit-progress-v1";

export interface Progress {
  sessions: number;
}

function read(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { sessions: 0 };
    const parsed = JSON.parse(raw) as Progress;
    return { sessions: Math.max(0, Number(parsed.sessions) || 0) };
  } catch {
    return { sessions: 0 };
  }
}

function write(p: Progress): void {
  localStorage.setItem(KEY, JSON.stringify(p));
}

export function getSessions(): number {
  return read().sessions;
}

/** Returns newly unlocked session count after increment. */
export function recordSessionComplete(): { sessions: number; previous: number } {
  const previous = getSessions();
  const sessions = previous + 1;
  write({ sessions });
  return { sessions, previous };
}
