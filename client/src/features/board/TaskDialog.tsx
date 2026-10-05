import { formatDistanceToNowStrict } from 'date-fns';
import { Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import { ErrorState, Spinner } from '@/components/ui/feedback';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { errorMessage } from '@/lib/graphql';
import {
  PRIORITIES,
  STATUSES,
  type TaskDetail,
  type TaskPriority,
  type TaskStatus,
  type WorkspaceMember,
} from '@/lib/types';
import {
  useAddComment,
  useDeleteTask,
  useLiveComments,
  useTask,
  useUpdateTask,
  type TaskPatch,
} from './api';
import { describeChange } from './board-utils';

interface Props {
  taskId: string | null;
  projectId: string;
  members: WorkspaceMember[];
  onClose: () => void;
}

const ago = (iso: string) => formatDistanceToNowStrict(new Date(iso), { addSuffix: true });

export function TaskDialog({ taskId, projectId, members, onClose }: Props) {
  const { data: task, isPending, isError, error, refetch } = useTask(taskId);
  useLiveComments(taskId);

  return (
    <Modal open={taskId !== null} title={task ? task.key : 'Task'} onClose={onClose}>
      {!taskId ? null : isPending ? (
        <Spinner />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <TaskBody
          key={task.id}
          task={task}
          projectId={projectId}
          members={members}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}

function TaskBody({
  task,
  projectId,
  members,
  onClose,
}: {
  task: TaskDetail;
  projectId: string;
  members: WorkspaceMember[];
  onClose: () => void;
}) {
  const updateTask = useUpdateTask(projectId);
  const deleteTask = useDeleteTask(projectId);
  const addComment = useAddComment(task.id);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [comment, setComment] = useState('');
  const [tab, setTab] = useState<'comments' | 'activity'>('comments');

  const save = (patch: TaskPatch) =>
    updateTask.mutate(
      { id: task.id, ...patch },
      { onError: (err) => toast.error(errorMessage(err)) },
    );

  const submitComment = (e: FormEvent) => {
    e.preventDefault();
    addComment.mutate(comment.trim(), {
      onSuccess: () => setComment(''),
      onError: (err) => toast.error(errorMessage(err)),
    });
  };

  return (
    <div className="space-y-4">
      <Field label="Title">
        <Input
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title !== task.title && save({ title: title.trim() })}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Status">
          <Select
            value={task.status}
            onChange={(e) => save({ status: e.target.value as TaskStatus })}
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Priority">
          <Select
            value={task.priority}
            onChange={(e) => save({ priority: e.target.value as TaskPriority })}
          >
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Assignee">
          <Select
            value={task.assignee?.id ?? ''}
            onChange={(e) => save({ assigneeId: e.target.value || null })}
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.user.id} value={m.user.id}>
                {m.user.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Due date">
          <Input
            type="date"
            value={task.dueDate ?? ''}
            onChange={(e) => save({ dueDate: e.target.value || null })}
          />
        </Field>
      </div>
      <Field label="Description">
        <Textarea
          value={description}
          placeholder="Add more detail…"
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => description !== task.description && save({ description })}
        />
      </Field>

      <div>
        <div role="tablist" className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
          {(['comments', 'activity'] as const).map((name) => (
            <button
              key={name}
              role="tab"
              type="button"
              aria-selected={tab === name}
              onClick={() => setTab(name)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize ${
                tab === name
                  ? 'border-brand-600 text-brand-700 dark:text-brand-200'
                  : 'border-transparent text-slate-500'
              }`}
            >
              {name} ({name === 'comments' ? task.comments.length : task.activity.length})
            </button>
          ))}
        </div>

        {tab === 'comments' ? (
          <div className="space-y-3 pt-3">
            <ul className="max-h-48 space-y-3 overflow-y-auto" aria-live="polite">
              {task.comments.length === 0 && (
                <li className="text-sm text-slate-500">No comments yet.</li>
              )}
              {task.comments.map((c) => (
                <li key={c.id} className="flex gap-2">
                  <Avatar name={c.author.name} seed={c.author.id} size="sm" />
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {c.author.name}
                      </span>{' '}
                      · {ago(c.createdAt)}
                    </p>
                    <p className="text-sm break-words whitespace-pre-wrap">{c.body}</p>
                  </div>
                </li>
              ))}
            </ul>
            <form onSubmit={submitComment} className="flex gap-2">
              <Input
                aria-label="Add a comment"
                placeholder="Add a comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <Button type="submit" loading={addComment.isPending} disabled={!comment.trim()}>
                Send
              </Button>
            </form>
          </div>
        ) : (
          <ul className="max-h-64 space-y-2 overflow-y-auto pt-3 text-sm">
            {task.activity.map((entry) => (
              <li key={entry.id}>
                <span className="font-medium">{entry.actor.name}</span>{' '}
                {entry.type === 'CREATED'
                  ? 'created this task'
                  : entry.type === 'COMMENTED'
                    ? 'commented'
                    : 'changed'}{' '}
                {entry.changes.map(describeChange).join(', ')}
                <span className="text-slate-500"> · {ago(entry.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-slate-700">
        <span>
          Reported by {task.reporter.name} {ago(task.createdAt)}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="text-red-600"
          loading={deleteTask.isPending}
          onClick={() =>
            deleteTask.mutate(task.id, {
              onSuccess: () => {
                toast.success(`${task.key} deleted`);
                onClose();
              },
              onError: (err) => toast.error(errorMessage(err)),
            })
          }
        >
          <Trash2 aria-hidden /> Delete
        </Button>
      </div>
    </div>
  );
}
