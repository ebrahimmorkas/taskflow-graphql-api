import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { errorMessage } from '@/lib/graphql';
import { PRIORITIES, type TaskPriority, type WorkspaceMember } from '@/lib/types';
import { useCreateTask } from './api';

interface Props {
  open: boolean;
  projectId: string;
  members: WorkspaceMember[];
  onClose: () => void;
}

const EMPTY = {
  title: '',
  description: '',
  priority: 'MEDIUM' as TaskPriority,
  assigneeId: '',
  dueDate: '',
};

export function NewTaskDialog({ open, projectId, members, onClose }: Props) {
  const createTask = useCreateTask(projectId);
  const [form, setForm] = useState(EMPTY);
  const set = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const close = () => {
    setForm(EMPTY);
    createTask.reset();
    onClose();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    createTask.mutate(
      {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        priority: form.priority,
        assigneeId: form.assigneeId || undefined,
        dueDate: form.dueDate || undefined,
      },
      {
        onSuccess: (task) => {
          toast.success(`${task.key} created`);
          close();
        },
      },
    );
  };

  return (
    <Modal open={open} title="New task" onClose={close}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Title">
          <Input
            value={form.title}
            maxLength={200}
            onChange={(e) => set('title', e.target.value)}
          />
        </Field>
        <Field label="Description">
          <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Priority">
            <Select
              value={form.priority}
              onChange={(e) => set('priority', e.target.value as TaskPriority)}
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Due date">
            <Input
              type="date"
              value={form.dueDate}
              onChange={(e) => set('dueDate', e.target.value)}
            />
          </Field>
        </div>
        <Field label="Assignee">
          <Select value={form.assigneeId} onChange={(e) => set('assigneeId', e.target.value)}>
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.user.id} value={m.user.id}>
                {m.user.name}
              </option>
            ))}
          </Select>
        </Field>
        {createTask.isError && <Alert>{errorMessage(createTask.error)}</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" loading={createTask.isPending} disabled={!form.title.trim()}>
            Create task
          </Button>
        </div>
      </form>
    </Modal>
  );
}
