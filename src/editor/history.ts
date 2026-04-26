// 軽量な undo/redo: フォーム状態のスナップショットを stack に積む
import { applyPathname } from "./pathname";
import { build } from "./state";

const MAX_HISTORY = 50;
const undoStack: string[] = [];
const redoStack: string[] = [];
let lastSnapshot: string | null = null;
let suppress = false;
let pendingTimer: number | null = null;

// 入力イベントは連発するので debounce してスナップショット
const SNAPSHOT_DEBOUNCE_MS = 400;

export function snapshotNow(): void {
  const cur = build();
  if (cur === lastSnapshot) return;
  if (lastSnapshot !== null) {
    undoStack.push(lastSnapshot);
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack.length = 0;
  }
  lastSnapshot = cur;
}

export function scheduleSnapshot(): void {
  if (suppress) return;
  if (pendingTimer !== null) clearTimeout(pendingTimer);
  pendingTimer = window.setTimeout(() => {
    pendingTimer = null;
    snapshotNow();
  }, SNAPSHOT_DEBOUNCE_MS);
}

export function undo(onAfter: () => void): boolean {
  if (pendingTimer !== null) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
    snapshotNow();
  }
  const prev = undoStack.pop();
  if (!prev) return false;
  if (lastSnapshot !== null) redoStack.push(lastSnapshot);
  lastSnapshot = prev;
  suppress = true;
  applyPathname(prev);
  onAfter();
  suppress = false;
  return true;
}

export function redo(onAfter: () => void): boolean {
  const next = redoStack.pop();
  if (!next) return false;
  if (lastSnapshot !== null) undoStack.push(lastSnapshot);
  lastSnapshot = next;
  suppress = true;
  applyPathname(next);
  onAfter();
  suppress = false;
  return true;
}

export function initHistory(): void {
  // 起動時に現在状態を初期スナップショットとして記録
  lastSnapshot = build();
}
