// Types mirroring the parts of schema.gql the client selects.

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface WorkspaceMember {
  id: string;
  role: WorkspaceRole;
  joinedAt: string;
  user: User;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  myRole: WorkspaceRole;
  members: WorkspaceMember[];
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  key: string;
  description: string;
  archived: boolean;
}

/** The fields shown on a board card. */
export interface Task {
  id: string;
  key: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  projectId: string;
  updatedAt: string;
  assignee: Pick<User, 'id' | 'name'> | null;
}

export interface Comment {
  id: string;
  taskId: string;
  body: string;
  createdAt: string;
  author: Pick<User, 'id' | 'name'>;
}

export interface ActivityEntry {
  id: string;
  type: 'CREATED' | 'UPDATED' | 'COMMENTED';
  createdAt: string;
  actor: Pick<User, 'id' | 'name'>;
  changes: { field: string; from: string | null; to: string | null }[];
}

export interface TaskDetail extends Task {
  description: string;
  createdAt: string;
  reporter: Pick<User, 'id' | 'name'>;
  comments: Comment[];
  activity: ActivityEntry[];
}

export interface TaskChangedEvent {
  type: 'CREATED' | 'UPDATED' | 'DELETED';
  taskId: string;
  actorId: string;
  task: Task | null;
}

export const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'TODO', label: 'To do' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'IN_REVIEW', label: 'In review' },
  { value: 'DONE', label: 'Done' },
];

export const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'URGENT', label: 'Urgent' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
];
