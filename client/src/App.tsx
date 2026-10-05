import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { RedirectIfAuthed, RequireAuth } from '@/features/auth/AuthLayout';
import { LoginPage, RegisterPage } from '@/features/auth/AuthPages';
import { BoardPage } from '@/features/board/BoardPage';
import { AppShell, WorkspaceHome } from '@/features/workspace/AppShell';
import { MembersPage } from '@/features/workspace/MembersPage';

const shell = (
  <RequireAuth>
    <AppShell />
  </RequireAuth>
);

const router = createBrowserRouter([
  {
    path: 'login',
    element: (
      <RedirectIfAuthed>
        <LoginPage />
      </RedirectIfAuthed>
    ),
  },
  {
    path: 'register',
    element: (
      <RedirectIfAuthed>
        <RegisterPage />
      </RedirectIfAuthed>
    ),
  },
  { path: '/', element: shell },
  {
    path: 'w/:workspaceId',
    element: shell,
    children: [
      { index: true, element: <WorkspaceHome /> },
      { path: 'p/:projectId', element: <BoardPage /> },
      { path: 'members', element: <MembersPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

export function App() {
  return <RouterProvider router={router} />;
}
