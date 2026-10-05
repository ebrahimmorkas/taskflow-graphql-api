import { FolderKanban, LogOut, Moon, Plus, Sun, Users } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { NavLink, Outlet, useNavigate, useParams } from 'react-router';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import { Alert, EmptyState, ErrorState, Spinner } from '@/components/ui/feedback';
import { Field, Input, Select } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { useAuth, useMe } from '@/features/auth/auth-context';
import {
  useCreateProject,
  useCreateWorkspace,
  useProjects,
  useWorkspaces,
} from '@/features/board/api';
import { errorMessage } from '@/lib/graphql';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium',
    isActive
      ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-100'
      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
  );

/** Sidebar with the workspace switcher and project list; pages render in the outlet. */
export function AppShell() {
  const me = useMe();
  const { logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const { workspaceId } = useParams();
  const workspaces = useWorkspaces();
  const projects = useProjects(workspaceId);
  const [dialog, setDialog] = useState<'workspace' | 'project' | null>(null);

  // Land on the first workspace when none is selected.
  const first = workspaces.data?.[0]?.id;
  useEffect(() => {
    if (!workspaceId && first) navigate(`/w/${first}`, { replace: true });
  }, [workspaceId, first, navigate]);

  if (workspaces.isPending) return <Spinner />;
  if (workspaces.isError)
    return <ErrorState error={workspaces.error} onRetry={() => workspaces.refetch()} />;

  const workspace = workspaces.data.find((w) => w.id === workspaceId);

  return (
    <div className="flex h-full flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col border-b border-slate-200 bg-white md:w-64 md:border-r md:border-b-0 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 px-4 py-3 text-lg font-bold">
          <span className="grid size-8 place-items-center rounded-lg bg-brand-600 text-white">
            <FolderKanban className="size-4" aria-hidden />
          </span>
          TaskFlow
        </div>

        <div className="space-y-1 px-3">
          <label
            htmlFor="workspace"
            className="px-1 text-xs font-semibold tracking-wide text-slate-500 uppercase"
          >
            Workspace
          </label>
          <div className="flex gap-1">
            <Select
              id="workspace"
              value={workspaceId ?? ''}
              onChange={(e) => navigate(`/w/${e.target.value}`)}
            >
              {workspaces.data.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
            <Button
              variant="ghost"
              size="icon"
              aria-label="New workspace"
              onClick={() => setDialog('workspace')}
            >
              <Plus />
            </Button>
          </div>
        </div>

        {workspace && (
          <nav aria-label="Projects" className="mt-4 flex-1 overflow-y-auto px-3 pb-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Projects
              </h2>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label="New project"
                onClick={() => setDialog('project')}
              >
                <Plus />
              </Button>
            </div>
            <ul className="mt-1 space-y-0.5">
              {projects.data?.map((p) => (
                <li key={p.id}>
                  <NavLink to={`/w/${workspace.id}/p/${p.id}`} className={linkClass}>
                    <span className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[0.6875rem] text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                      {p.key}
                    </span>
                    <span className="truncate">{p.name}</span>
                  </NavLink>
                </li>
              ))}
              {projects.data?.length === 0 && (
                <li className="px-3 py-2 text-sm text-slate-500">No projects yet.</li>
              )}
            </ul>
            <NavLink to={`/w/${workspace.id}/members`} className={(s) => cn(linkClass(s), 'mt-4')}>
              <Users className="size-4" aria-hidden /> Members
              <span className="ml-auto text-xs text-slate-500">{workspace.members.length}</span>
            </NavLink>
          </nav>
        )}

        <div className="flex items-center gap-2 border-t border-slate-200 px-3 py-3 dark:border-slate-800">
          <Avatar name={me.name} seed={me.id} size="sm" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium">{me.name}</p>
            <p className="truncate text-xs text-slate-500">{me.email}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun /> : <Moon />}
          </Button>
          <Button variant="ghost" size="icon" aria-label="Log out" onClick={logout}>
            <LogOut />
          </Button>
        </div>
      </aside>

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-slate-100 dark:bg-slate-950">
        {workspaces.data.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="Create your first workspace"
              description="A workspace holds your team, its projects and tasks."
              action={<Button onClick={() => setDialog('workspace')}>New workspace</Button>}
            />
          </div>
        ) : (
          <Outlet />
        )}
      </main>

      <NameDialog
        key={dialog}
        open={dialog === 'workspace'}
        title="New workspace"
        onClose={() => setDialog(null)}
        onCreated={(id) => navigate(`/w/${id}`)}
      />
      {workspace && (
        <ProjectDialog
          open={dialog === 'project'}
          workspaceId={workspace.id}
          onClose={() => setDialog(null)}
          onCreated={(id) => navigate(`/w/${workspace.id}/p/${id}`)}
        />
      )}
    </div>
  );
}

export function WorkspaceHome() {
  return (
    <div className="grid h-full place-items-center p-8 text-center">
      <div>
        <FolderKanban className="mx-auto size-12 text-brand-500" aria-hidden />
        <h1 className="mt-3 text-xl font-semibold">Pick a project</h1>
        <p className="mt-1 text-sm text-slate-500">
          Choose a project on the left to open its board.
        </p>
      </div>
    </div>
  );
}

function NameDialog({
  open,
  title,
  onClose,
  onCreated,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const create = useCreateWorkspace();
  const [name, setName] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(name.trim(), {
      onSuccess: (w) => {
        onClose();
        onCreated(w.id);
      },
    });
  };
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name">
          <Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </Field>
        {create.isError && <Alert>{errorMessage(create.error)}</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending} disabled={name.trim().length < 2}>
            Create
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ProjectDialog({
  open,
  workspaceId,
  onClose,
  onCreated,
}: {
  open: boolean;
  workspaceId: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const create = useCreateProject(workspaceId);
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const validKey = /^[A-Z]{2,6}$/.test(key);
  const close = () => {
    setName('');
    setKey('');
    create.reset();
    onClose();
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(
      { name: name.trim(), key },
      {
        onSuccess: (p) => {
          close();
          onCreated(p.id);
        },
      },
    );
  };
  return (
    <Modal open={open} title="New project" onClose={close}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name">
          <Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Key" hint="2–6 letters. Task ids use it, e.g. WEB-42.">
          <Input
            value={key}
            maxLength={6}
            className="font-mono uppercase"
            onChange={(e) => setKey(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
          />
        </Field>
        {create.isError && <Alert>{errorMessage(create.error)}</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={create.isPending}
            disabled={name.trim().length < 2 || !validKey}
          >
            Create project
          </Button>
        </div>
      </form>
    </Modal>
  );
}
