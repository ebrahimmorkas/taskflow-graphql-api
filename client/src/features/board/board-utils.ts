import type { Task, TaskChangedEvent, TaskPriority, TaskStatus } from '@/lib/types';
import { STATUSES } from '@/lib/types';

/** Folds a `taskChanged` subscription event (or a mutation result) into the cached task list. */
export function applyTaskEvent(tasks: Task[] | undefined, event: TaskChangedEvent) {
  if (!tasks) return tasks;
  if (event.type === 'DELETED' || !event.task) return tasks.filter((t) => t.id !== event.taskId);
  const incoming = event.task;
  const existing = tasks.find((t) => t.id === incoming.id);
  if (!existing) return [incoming, ...tasks];
  // Events can arrive out of order with our own optimistic updates; newest wins.
  if (new Date(existing.updatedAt) > new Date(incoming.updatedAt)) return tasks;
  return tasks.map((t) => (t.id === incoming.id ? incoming : t));
}

const PRIORITY_RANK: Record<TaskPriority, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export interface BoardFilters {
  search: string;
  assigneeId: string;
  priority: TaskPriority | '';
}

export function filterTasks(tasks: Task[], filters: BoardFilters) {
  const search = filters.search.trim().toLowerCase();
  return tasks.filter(
    (t) =>
      (!search || t.title.toLowerCase().includes(search) || t.key.toLowerCase().includes(search)) &&
      (!filters.priority || t.priority === filters.priority) &&
      (!filters.assigneeId ||
        (filters.assigneeId === 'none' ? !t.assignee : t.assignee?.id === filters.assigneeId)),
  );
}

/** Tasks grouped into board columns, most urgent first within each column. */
export function groupByStatus(tasks: Task[]): Record<TaskStatus, Task[]> {
  const columns = Object.fromEntries(STATUSES.map((s) => [s.value, [] as Task[]])) as Record<
    TaskStatus,
    Task[]
  >;
  for (const task of tasks) columns[task.status].push(task);
  for (const column of Object.values(columns)) {
    column.sort(
      (a, b) =>
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }
  return columns;
}

export function isOverdue(task: Pick<Task, 'dueDate' | 'status'>, today = new Date()) {
  if (!task.dueDate || task.status === 'DONE') return false;
  return task.dueDate < today.toISOString().slice(0, 10);
}

/** Human-readable sentence for an activity log change, e.g. "status: To do → Done". */
export function describeChange(change: { field: string; from: string | null; to: string | null }) {
  const label = (value: string | null) =>
    STATUSES.find((s) => s.value === value)?.label ?? value ?? 'none';
  return `${change.field}: ${label(change.from)} → ${label(change.to)}`;
}
