import { describe, expect, it } from 'vitest';
import type { Task } from '@/lib/types';
import {
  applyTaskEvent,
  describeChange,
  filterTasks,
  groupByStatus,
  isOverdue,
} from './board-utils';

const task = (overrides: Partial<Task> = {}): Task => ({
  id: 't1',
  key: 'WEB-1',
  title: 'Fix login',
  status: 'TODO',
  priority: 'MEDIUM',
  dueDate: null,
  projectId: 'p1',
  updatedAt: '2026-01-01T10:00:00.000Z',
  assignee: null,
  ...overrides,
});

describe('applyTaskEvent', () => {
  it('adds a task created by someone else', () => {
    const result = applyTaskEvent([task()], {
      type: 'CREATED',
      taskId: 't2',
      actorId: 'u2',
      task: task({ id: 't2', key: 'WEB-2' }),
    })!;
    expect(result.map((t) => t.id)).toEqual(['t2', 't1']);
  });

  it('replaces an updated task and removes a deleted one', () => {
    const moved = task({ status: 'DONE', updatedAt: '2026-01-01T11:00:00.000Z' });
    const updated = applyTaskEvent([task()], {
      type: 'UPDATED',
      taskId: 't1',
      actorId: 'u2',
      task: moved,
    })!;
    expect(updated[0]!.status).toBe('DONE');
    expect(
      applyTaskEvent(updated, { type: 'DELETED', taskId: 't1', actorId: 'u2', task: null }),
    ).toEqual([]);
  });

  it('ignores an event older than what is already cached', () => {
    const current = task({ status: 'IN_REVIEW', updatedAt: '2026-01-01T12:00:00.000Z' });
    const stale = task({ status: 'IN_PROGRESS', updatedAt: '2026-01-01T11:00:00.000Z' });
    const result = applyTaskEvent([current], {
      type: 'UPDATED',
      taskId: 't1',
      actorId: 'u2',
      task: stale,
    })!;
    expect(result[0]!.status).toBe('IN_REVIEW');
  });
});

describe('board helpers', () => {
  const tasks = [
    task({ id: 'a', title: 'Low thing', priority: 'LOW' }),
    task({
      id: 'b',
      title: 'Urgent bug',
      priority: 'URGENT',
      assignee: { id: 'u1', name: 'Alice' },
    }),
    task({ id: 'c', title: 'Review PR', status: 'IN_REVIEW', key: 'API-7' }),
  ];

  it('groups by status and sorts each column by priority', () => {
    const columns = groupByStatus(tasks);
    expect(columns.TODO.map((t) => t.id)).toEqual(['b', 'a']);
    expect(columns.IN_REVIEW.map((t) => t.id)).toEqual(['c']);
    expect(columns.DONE).toEqual([]);
  });

  it('filters by text, key, priority and assignee', () => {
    const base = { search: '', assigneeId: '', priority: '' as const };
    expect(filterTasks(tasks, { ...base, search: 'urgent' }).map((t) => t.id)).toEqual(['b']);
    expect(filterTasks(tasks, { ...base, search: 'api-7' }).map((t) => t.id)).toEqual(['c']);
    expect(filterTasks(tasks, { ...base, priority: 'LOW' }).map((t) => t.id)).toEqual(['a']);
    expect(filterTasks(tasks, { ...base, assigneeId: 'u1' }).map((t) => t.id)).toEqual(['b']);
    expect(filterTasks(tasks, { ...base, assigneeId: 'none' }).map((t) => t.id)).toEqual([
      'a',
      'c',
    ]);
  });

  it('flags overdue tasks unless they are done', () => {
    const today = new Date('2026-03-10T08:00:00Z');
    expect(isOverdue(task({ dueDate: '2026-03-09' }), today)).toBe(true);
    expect(isOverdue(task({ dueDate: '2026-03-10' }), today)).toBe(false);
    expect(isOverdue(task({ dueDate: '2026-03-01', status: 'DONE' }), today)).toBe(false);
  });

  it('describes activity changes with friendly status names', () => {
    expect(describeChange({ field: 'status', from: 'TODO', to: 'IN_PROGRESS' })).toBe(
      'status: To do → In progress',
    );
    expect(describeChange({ field: 'assignee', from: null, to: 'Bob' })).toBe(
      'assignee: none → Bob',
    );
  });
});
