import { CreateUsers1790587207098 } from './1790587207098-CreateUsers.js';
import { CreateWorkspaces1790587490997 } from './1790587490997-CreateWorkspaces.js';
import { CreateProjects1790587949562 } from './1790587949562-CreateProjects.js';
import { CreateTasks1790588220409 } from './1790588220409-CreateTasks.js';

// Migrations run in array order; append new ones at the end.
export const migrations: Function[] = [
  CreateUsers1790587207098,
  CreateWorkspaces1790587490997,
  CreateProjects1790587949562,
  CreateTasks1790588220409,
];
