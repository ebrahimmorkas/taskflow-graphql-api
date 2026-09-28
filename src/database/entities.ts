import { Comment } from '../comments/comment.entity.js';
import { Project } from '../projects/project.entity.js';
import { Activity } from '../tasks/activity.entity.js';
import { Task } from '../tasks/task.entity.js';
import { User } from '../users/user.entity.js';
import { Membership } from '../workspaces/membership.entity.js';
import { Workspace } from '../workspaces/workspace.entity.js';

// Every TypeORM entity is registered here.
export const entities: Function[] = [User, Workspace, Membership, Project, Task, Activity, Comment];
