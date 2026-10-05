import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { gql, subscriptionClient } from '@/lib/graphql';
import type {
  Comment,
  Project,
  Task,
  TaskChangedEvent,
  TaskDetail,
  TaskPriority,
  TaskStatus,
  Workspace,
  WorkspaceRole,
} from '@/lib/types';
import { applyTaskEvent } from './board-utils';

// Fragments are plain strings so each operation states exactly what it selects.
const TASK_CARD = `id key title status priority dueDate projectId updatedAt assignee { id name }`;
const COMMENT = `id taskId body createdAt author { id name }`;
const WORKSPACE = `id name slug myRole members { id role joinedAt user { id name email } }`;
const PROJECT = `id workspaceId name key description archived`;

export const keys = {
  workspaces: ['workspaces'] as const,
  projects: (workspaceId: string) => ['projects', workspaceId] as const,
  tasks: (projectId: string) => ['tasks', projectId] as const,
  task: (taskId: string) => ['task', taskId] as const,
};

export function useWorkspaces() {
  return useQuery({
    queryKey: keys.workspaces,
    queryFn: async ({ signal }) =>
      (
        await gql<{ myWorkspaces: Workspace[] }>(
          `query Workspaces { myWorkspaces { ${WORKSPACE} } }`,
          undefined,
          signal,
        )
      ).myWorkspaces,
  });
}

export function useProjects(workspaceId: string | undefined) {
  return useQuery({
    queryKey: keys.projects(workspaceId ?? ''),
    enabled: !!workspaceId,
    queryFn: async ({ signal }) =>
      (
        await gql<{ projects: Project[] }, { workspaceId: string }>(
          `query Projects($workspaceId: ID!) { projects(workspaceId: $workspaceId) { ${PROJECT} } }`,
          { workspaceId: workspaceId! },
          signal,
        )
      ).projects,
  });
}

interface TaskPage {
  tasks: {
    totalCount: number;
    pageInfo: { endCursor: string | null; hasNextPage: boolean };
    edges: { node: Task }[];
  };
}

/**
 * The API caps query complexity (cost grows with `first` x selected fields), so
 * the board asks for small pages and walks the cursor until it has them all.
 */
const PAGE_SIZE = 15;

/** Loads every task of a project by walking the cursor-paginated connection. */
export function useTasks(projectId: string) {
  return useQuery({
    queryKey: keys.tasks(projectId),
    queryFn: async ({ signal }) => {
      const all: Task[] = [];
      let after: string | null = null;
      do {
        const page: TaskPage = await gql<TaskPage, { projectId: string; after: string | null }>(
          `query Tasks($projectId: ID!, $after: String) {
            tasks(projectId: $projectId, page: { first: ${PAGE_SIZE}, after: $after }) {
              totalCount
              pageInfo { endCursor hasNextPage }
              edges { node { ${TASK_CARD} } }
            }
          }`,
          { projectId, after },
          signal,
        );
        all.push(...page.tasks.edges.map((e) => e.node));
        after = page.tasks.pageInfo.hasNextPage ? page.tasks.pageInfo.endCursor : null;
      } while (after);
      return all;
    },
  });
}

export function useTask(taskId: string | null) {
  return useQuery({
    queryKey: keys.task(taskId ?? ''),
    enabled: !!taskId,
    queryFn: async ({ signal }) =>
      (
        await gql<{ task: TaskDetail }, { id: string }>(
          `query Task($id: ID!) {
            task(id: $id) {
              ${TASK_CARD} description createdAt reporter { id name }
              comments { ${COMMENT} }
              activity { id type createdAt actor { id name } changes { field from to } }
            }
          }`,
          { id: taskId! },
          signal,
        )
      ).task,
  });
}

/**
 * Keeps a project's board live: every `taskChanged` event from any user is
 * folded into the cached task list. Returns nothing; the board just re-renders.
 */
export function useLiveBoard(projectId: string, onEvent?: (event: TaskChangedEvent) => void) {
  const queryClient = useQueryClient();
  useEffect(() => {
    const unsubscribe = subscriptionClient().subscribe<{ taskChanged: TaskChangedEvent }>(
      {
        query: `subscription TaskChanged($projectId: ID!) {
          taskChanged(projectId: $projectId) { type taskId actorId task { ${TASK_CARD} } }
        }`,
        variables: { projectId },
      },
      {
        next: ({ data }) => {
          if (!data) return;
          const event = data.taskChanged;
          queryClient.setQueryData<Task[]>(keys.tasks(projectId), (tasks) =>
            applyTaskEvent(tasks, event),
          );
          // An open task detail refetches so its activity log stays current.
          void queryClient.invalidateQueries({ queryKey: keys.task(event.taskId) });
          onEvent?.(event);
        },
        error: () => {},
        complete: () => {},
      },
    );
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, queryClient]);
}

/** Appends comments from other users to an open task as they are posted. */
export function useLiveComments(taskId: string | null) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!taskId) return;
    return subscriptionClient().subscribe<{ commentAdded: Comment }>(
      {
        query: `subscription CommentAdded($taskId: ID!) { commentAdded(taskId: $taskId) { ${COMMENT} } }`,
        variables: { taskId },
      },
      {
        next: ({ data }) => {
          if (data) appendComment(queryClient, data.commentAdded);
        },
        error: () => {},
        complete: () => {},
      },
    );
  }, [taskId, queryClient]);
}

function appendComment(queryClient: ReturnType<typeof useQueryClient>, comment: Comment) {
  queryClient.setQueryData<TaskDetail>(keys.task(comment.taskId), (task) =>
    task && !task.comments.some((c) => c.id === comment.id)
      ? { ...task, comments: [...task.comments, comment] }
      : task,
  );
}

export interface TaskInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  assigneeId?: string | null;
  dueDate?: string | null;
}

export function useCreateTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TaskInput) =>
      (
        await gql<{ createTask: Task }, { input: object }>(
          `mutation CreateTask($input: CreateTaskInput!) { createTask(input: $input) { ${TASK_CARD} } }`,
          { input: { ...input, projectId } },
        )
      ).createTask,
    onSuccess: (task) =>
      queryClient.setQueryData<Task[]>(keys.tasks(projectId), (tasks) =>
        applyTaskEvent(tasks, { type: 'CREATED', taskId: task.id, actorId: '', task }),
      ),
  });
}

export type TaskPatch = Partial<TaskInput> & { status?: TaskStatus };

/**
 * Optimistic update: the card moves immediately and snaps back if the server
 * rejects the change. Used by drag-and-drop and by the task dialog.
 */
export function useUpdateTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: TaskPatch & { id: string }) =>
      (
        await gql<{ updateTask: Task }, { input: object }>(
          `mutation UpdateTask($input: UpdateTaskInput!) { updateTask(input: $input) { ${TASK_CARD} } }`,
          { input: { id, ...patch } },
        )
      ).updateTask,
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: keys.tasks(projectId) });
      const previous = queryClient.getQueryData<Task[]>(keys.tasks(projectId));
      if (status) {
        queryClient.setQueryData<Task[]>(keys.tasks(projectId), (tasks) =>
          tasks?.map((t) => (t.id === id ? { ...t, status } : t)),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(keys.tasks(projectId), context.previous);
    },
    onSuccess: (task) => {
      queryClient.setQueryData<Task[]>(keys.tasks(projectId), (tasks) =>
        tasks?.map((t) => (t.id === task.id ? task : t)),
      );
      void queryClient.invalidateQueries({ queryKey: keys.task(task.id) });
    },
  });
}

export function useDeleteTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      gql<{ deleteTask: string }, { id: string }>(
        `mutation DeleteTask($id: ID!) { deleteTask(id: $id) }`,
        { id },
      ),
    onSuccess: (_res, id) =>
      queryClient.setQueryData<Task[]>(keys.tasks(projectId), (tasks) =>
        tasks?.filter((t) => t.id !== id),
      ),
  });
}

export function useAddComment(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) =>
      (
        await gql<{ addComment: Comment }, { taskId: string; body: string }>(
          `mutation AddComment($taskId: ID!, $body: String!) { addComment(taskId: $taskId, body: $body) { ${COMMENT} } }`,
          { taskId, body },
        )
      ).addComment,
    onSuccess: (comment) => appendComment(queryClient, comment),
  });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) =>
      (
        await gql<{ createWorkspace: Workspace }, { input: object }>(
          `mutation CreateWorkspace($input: CreateWorkspaceInput!) { createWorkspace(input: $input) { ${WORKSPACE} } }`,
          { input: { name } },
        )
      ).createWorkspace,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.workspaces }),
  });
}

export function useCreateProject(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; key: string; description?: string }) =>
      (
        await gql<{ createProject: Project }, { input: object }>(
          `mutation CreateProject($input: CreateProjectInput!) { createProject(input: $input) { ${PROJECT} } }`,
          { input: { ...input, workspaceId } },
        )
      ).createProject,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.projects(workspaceId) }),
  });
}

export function useMemberMutations(workspaceId: string) {
  const queryClient = useQueryClient();
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: keys.workspaces });
  const add = useMutation({
    mutationFn: (input: { email: string; role: WorkspaceRole }) =>
      gql(
        `mutation AddMember($input: AddWorkspaceMemberInput!) { addWorkspaceMember(input: $input) { id } }`,
        { input: { ...input, workspaceId } },
      ),
    onSuccess,
  });
  const changeRole = useMutation({
    mutationFn: (input: { userId: string; role: WorkspaceRole }) =>
      gql(
        `mutation ChangeRole($input: UpdateWorkspaceMemberRoleInput!) { updateWorkspaceMemberRole(input: $input) { id } }`,
        { input: { ...input, workspaceId } },
      ),
    onSuccess,
  });
  const remove = useMutation({
    mutationFn: (userId: string) =>
      gql(
        `mutation RemoveMember($workspaceId: ID!, $userId: ID!) { removeWorkspaceMember(workspaceId: $workspaceId, userId: $userId) }`,
        { workspaceId, userId },
      ),
    onSuccess,
  });
  return { add, changeRole, remove };
}
