import { UserMinus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router';
import { toast } from 'sonner';
import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/form';
import { useMe } from '@/features/auth/auth-context';
import { useMemberMutations, useWorkspaces } from '@/features/board/api';
import { errorMessage } from '@/lib/graphql';
import type { WorkspaceRole } from '@/lib/types';

const onError = (err: unknown) => toast.error(errorMessage(err));

export function MembersPage() {
  const { workspaceId = '' } = useParams();
  const me = useMe();
  const workspace = useWorkspaces().data?.find((w) => w.id === workspaceId);
  const { add, changeRole, remove } = useMemberMutations(workspaceId);
  const [email, setEmail] = useState('');
  if (!workspace) return null;

  // The API enforces this too; the UI just hides what the user can't do.
  const canManage = workspace.myRole !== 'MEMBER';

  const invite = (e: FormEvent) => {
    e.preventDefault();
    add.mutate(
      { email: email.trim(), role: 'MEMBER' },
      {
        onSuccess: () => {
          toast.success('Member added');
          setEmail('');
        },
        onError,
      },
    );
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
      <header>
        <h1 className="text-2xl font-bold">{workspace.name} members</h1>
        <p className="text-sm text-slate-500">Your role: {workspace.myRole.toLowerCase()}</p>
      </header>

      {canManage && (
        <Card>
          <CardContent>
            <form onSubmit={invite} className="flex gap-2">
              <Input
                type="email"
                aria-label="Email of the person to add"
                placeholder="teammate@example.com (must have an account)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button type="submit" loading={add.isPending} disabled={!email.trim()}>
                Add member
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {workspace.members.map((member) => {
            const isMe = member.user.id === me.id;
            const editable = canManage && !isMe && member.role !== 'OWNER';
            return (
              <li key={member.id} className="flex items-center gap-3 px-5 py-3">
                <Avatar name={member.user.name} seed={member.user.id} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {member.user.name} {isMe && <span className="text-slate-500">(you)</span>}
                  </p>
                  <p className="truncate text-sm text-slate-500">{member.user.email}</p>
                </div>
                {editable ? (
                  <>
                    <Select
                      aria-label={`Role for ${member.user.name}`}
                      className="w-32"
                      value={member.role}
                      onChange={(e) =>
                        changeRole.mutate(
                          { userId: member.user.id, role: e.target.value as WorkspaceRole },
                          { onError },
                        )
                      }
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="MEMBER">Member</option>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${member.user.name}`}
                      onClick={() => remove.mutate(member.user.id, { onError })}
                    >
                      <UserMinus />
                    </Button>
                  </>
                ) : (
                  <Badge tone={member.role === 'OWNER' ? 'brand' : 'neutral'}>
                    {member.role.charAt(0) + member.role.slice(1).toLowerCase()}
                  </Badge>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
