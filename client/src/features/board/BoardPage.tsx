import { CalendarDays, Plus, Radio, Search } from 'lucide-react';
import { useMemo, useState, type DragEvent } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { Input, Select } from '@/components/ui/form';
import { useMe } from '@/features/auth/auth-context';
import { errorMessage } from '@/lib/graphql';
import { PRIORITIES, STATUSES, type Task, type TaskPriority, type TaskStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useLiveBoard, useProjects, useTasks, useUpdateTask, useWorkspaces } from './api';
import { filterTasks, groupByStatus, isOverdue, type BoardFilters } from './board-utils';
import { NewTaskDialog } from './NewTaskDialog';
import { TaskDialog } from './TaskDialog';

const PRIORITY_TONE = {
  URGENT: 'danger',
  HIGH: 'warning',
  MEDIUM: 'brand',
  LOW: 'neutral',
} as const;

export function BoardPage() {
  const { workspaceId = '', projectId = '' } = useParams();
  const me = useMe();
  const [params, setParams] = useSearchParams();
  const openTaskId = params.get('task');
  const tasks = useTasks(projectId);
  const project = useProjects(workspaceId).data?.find((p) => p.id === projectId);
  const members = useWorkspaces().data?.find((w) => w.id === workspaceId)?.members ?? [];
  const updateTask = useUpdateTask(projectId);
  const [filters, setFilters] = useState<BoardFilters>({
    search: '',
    assigneeId: '',
    priority: '',
  });
  const [creating, setCreating] = useState(false);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);

  // Live updates from teammates; our own changes are already applied optimistically.
  useLiveBoard(projectId, (event) => {
    if (event.actorId === me.id) return;
    const actor =
      members.find((m) => m.user.id === event.actorId)?.user.name.split(' ')[0] ?? 'Someone';
    const verb = { CREATED: 'created', UPDATED: 'updated', DELETED: 'deleted' }[event.type];
    toast.info(`${actor} ${verb} ${event.task?.key ?? 'a task'}`);
  });

  const columns = useMemo(
    () => groupByStatus(filterTasks(tasks.data ?? [], filters)),
    [tasks.data, filters],
  );

  const openTask = (id: string | null) => setParams(id ? { task: id } : {}, { replace: true });

  const onDrop = (status: TaskStatus) => (e: DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData('text/task-id');
    const task = tasks.data?.find((t) => t.id === id);
    if (!task || task.status === status) return;
    updateTask.mutate({ id, status }, { onError: (err) => toast.error(errorMessage(err)) });
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="mr-auto min-w-0">
          <h1 className="truncate text-xl font-bold">{project?.name ?? 'Board'}</h1>
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <Radio className="size-3.5 text-emerald-500" aria-hidden /> Live ·{' '}
            {tasks.data?.length ?? 0} tasks
          </p>
        </div>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <Input
            aria-label="Search tasks"
            placeholder="Search tasks"
            className="w-44 pl-9"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
        </div>
        <Select
          aria-label="Filter by assignee"
          className="w-40"
          value={filters.assigneeId}
          onChange={(e) => setFilters((f) => ({ ...f, assigneeId: e.target.value }))}
        >
          <option value="">Everyone</option>
          <option value="none">Unassigned</option>
          {members.map((m) => (
            <option key={m.user.id} value={m.user.id}>
              {m.user.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by priority"
          className="w-36"
          value={filters.priority}
          onChange={(e) =>
            setFilters((f) => ({ ...f, priority: e.target.value as TaskPriority | '' }))
          }
        >
          <option value="">Any priority</option>
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
        <Button onClick={() => setCreating(true)}>
          <Plus aria-hidden /> New task
        </Button>
      </header>

      {tasks.isPending ? (
        <div className="grid flex-1 gap-4 p-4 sm:p-6 md:grid-cols-4">
          {STATUSES.map((s) => (
            <Skeleton key={s.value} className="h-72" />
          ))}
        </div>
      ) : tasks.isError ? (
        <div className="p-6">
          <ErrorState error={tasks.error} onRetry={() => tasks.refetch()} />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto p-4 sm:p-6">
          {STATUSES.map((status) => (
            <section
              key={status.value}
              aria-label={status.label}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(status.value);
              }}
              onDragLeave={() => setDragOver((s) => (s === status.value ? null : s))}
              onDrop={onDrop(status.value)}
              className={cn(
                'flex w-72 shrink-0 flex-col rounded-xl bg-slate-200/60 p-2 transition-colors md:w-auto md:flex-1 dark:bg-slate-900',
                dragOver === status.value &&
                  'bg-brand-100 ring-2 ring-brand-500 dark:bg-brand-900/40',
              )}
            >
              <h2 className="flex items-center justify-between px-2 py-1.5 text-sm font-semibold">
                {status.label}
                <span className="rounded-full bg-white px-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {columns[status.value].length}
                </span>
              </h2>
              <ul className="min-h-16 flex-1 space-y-2 overflow-y-auto p-1">
                {columns[status.value].map((task) => (
                  <li key={task.id}>
                    <TaskCard
                      task={task}
                      onOpen={() => openTask(task.id)}
                      onMove={(to) => updateTask.mutate({ id: task.id, status: to })}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <NewTaskDialog
        open={creating}
        projectId={projectId}
        members={members}
        onClose={() => setCreating(false)}
      />
      <TaskDialog
        taskId={openTaskId}
        projectId={projectId}
        members={members}
        onClose={() => openTask(null)}
      />
    </div>
  );
}

function TaskCard({
  task,
  onOpen,
  onMove,
}: {
  task: Task;
  onOpen: () => void;
  onMove: (status: TaskStatus) => void;
}) {
  const overdue = isOverdue(task);
  const index = STATUSES.findIndex((s) => s.value === task.status);
  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/task-id', task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      // Keyboard alternative to drag-and-drop: Alt+←/→ moves the card between columns.
      onKeyDown={(e) => {
        if (!e.altKey) return;
        const next =
          STATUSES[index + (e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0)];
        if (next && next.value !== task.status) onMove(next.value);
      }}
      className="cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm active:cursor-grabbing dark:border-slate-700 dark:bg-slate-800"
    >
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <span className="font-mono text-xs text-slate-500">{task.key}</span>
        <span className="mt-0.5 block text-sm font-medium">{task.title}</span>
      </button>
      <div className="mt-2 flex items-center gap-2">
        <Badge tone={PRIORITY_TONE[task.priority]}>
          {PRIORITIES.find((p) => p.value === task.priority)?.label}
        </Badge>
        {task.dueDate && (
          <span
            className={cn(
              'flex items-center gap-1 text-xs',
              overdue ? 'font-semibold text-red-600' : 'text-slate-500',
            )}
          >
            <CalendarDays className="size-3.5" aria-hidden />
            {new Date(`${task.dueDate}T00:00`).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
            })}
          </span>
        )}
        {task.assignee && (
          <span className="ml-auto" title={task.assignee.name}>
            <Avatar
              name={task.assignee.name}
              seed={task.assignee.id}
              size="sm"
              className="scale-75"
            />
            <span className="sr-only">Assigned to {task.assignee.name}</span>
          </span>
        )}
      </div>
    </article>
  );
}
