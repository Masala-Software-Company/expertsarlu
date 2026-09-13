import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { UserPlus, Trash2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { ROLE_LABELS, cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/features/auth/auth-store';

type UserRow = {
  id: string;
  nom: string;
  email: string;
  role: string;
  actif: boolean;
  creeLe: string;
};

type RoleInfo = {
  role: string;
  label: string;
  description: string;
  modules: string[];
};

const ASSIGNABLE_ROLES = [
  'ASSISTANT_MANAGER',
  'SUPPORT_CLIENT',
  'CAISSE_ADMIN',
  'PROTOCOLE',
  'SUPER_ADMIN',
] as const;

export function UsersPage() {
  const me = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [form, setForm] = useState({
    nom: '',
    email: '',
    password: '',
    role: 'ASSISTANT_MANAGER',
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get<UserRow[]>('/users')).data,
    enabled: me?.role === 'SUPER_ADMIN',
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['users', 'roles'],
    queryFn: async () => (await api.get<RoleInfo[]>('/users/roles')).data,
    enabled: me?.role === 'SUPER_ADMIN',
  });

  const roleMap = useMemo(
    () => Object.fromEntries(roles.map((r) => [r.role, r])),
    [roles],
  );

  const create = useMutation({
    mutationFn: async () => (await api.post('/users', form)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] });
      setForm({ nom: '', email: '', password: '', role: 'ASSISTANT_MANAGER' });
      toast.success('Compte créé');
    },
    onError: (err: { response?: { data?: { message?: string | string[] } } }) => {
      const msg = err.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg || 'Création refusée');
    },
  });

  const setRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) =>
      (await api.patch(`/users/${id}/role`, { role })).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Rôle mis à jour');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Changement de rôle refusé');
    },
  });

  const setActif = useMutation({
    mutationFn: async ({ id, actif }: { id: string; actif: boolean }) =>
      (await api.patch(`/users/${id}/actif`, { actif })).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Statut mis à jour');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Action refusée');
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/users/${id}`)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Compte supprimé');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Suppression refusée');
    },
  });

  if (me?.role !== 'SUPER_ADMIN') {
    return <Navigate to="/" replace />;
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate();
  };

  const selectedRole = roleMap[form.role];

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Utilisateurs & rôles</h1>
        <p className="mt-1 text-sm text-muted">
          Créez des comptes, attribuez un rôle, désactivez ou supprimez définitivement un
          collaborateur.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-2xl border border-[var(--border)] bg-surface p-5 shadow-soft"
      >
        <div className="flex items-center gap-2 text-sm font-bold">
          <UserPlus className="h-4 w-4 text-brand" />
          Nouveau compte
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-muted">Nom complet</span>
            <Input
              required
              value={form.nom}
              onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
              placeholder="Ex. Marie Kabongo"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted">E-mail</span>
            <Input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="prenom@expert.sarlu"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted">Mot de passe (min. 8)</span>
            <Input
              required
              type="password"
              minLength={8}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted">Rôle</span>
            <select
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-surface px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r] ?? r}
                </option>
              ))}
            </select>
          </label>
        </div>
        {selectedRole && (
          <p className="rounded-xl bg-canvas px-3 py-2 text-xs text-muted">
            <span className="font-semibold text-ink">{selectedRole.label}</span>
            {' — '}
            {selectedRole.description}
            <br />
            Modules : {selectedRole.modules.join(', ')}
          </p>
        )}
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Création…' : 'Créer le compte'}
        </Button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-surface shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-canvas text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Rôle</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-3 font-medium">{u.nom}</td>
                <td className="px-4 py-3 text-muted">{u.email}</td>
                <td className="px-4 py-3">
                  <select
                    className="h-9 max-w-[200px] rounded-lg border border-[var(--border)] bg-surface px-2 text-xs outline-none focus:border-brand"
                    value={u.role}
                    disabled={setRole.isPending}
                    onChange={(e) => setRole.mutate({ id: u.id, role: e.target.value })}
                  >
                    {ASSIGNABLE_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r] ?? r}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2 py-0.5 text-xs font-semibold',
                      u.actif ? 'bg-emerald-50 text-emerald-700' : 'bg-canvas text-muted',
                    )}
                  >
                    {u.actif ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant={u.actif ? 'secondary' : 'primary'}
                      disabled={setActif.isPending || u.id === me?.id}
                      onClick={() => setActif.mutate({ id: u.id, actif: !u.actif })}
                    >
                      {u.actif ? 'Désactiver' : 'Réactiver'}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={remove.isPending || u.id === me?.id}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Supprimer définitivement ${u.nom} (${u.email}) ? Cette action est irréversible.`,
                          )
                        ) {
                          remove.mutate(u.id);
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Supprimer
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted">
                  Aucun utilisateur
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {roles.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Matrice d’accès par rôle</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {roles.map((r) => (
              <div
                key={r.role}
                className="rounded-2xl border border-[var(--border)] bg-surface p-4 shadow-soft"
              >
                <div className="font-semibold">{r.label}</div>
                <p className="mt-1 text-xs text-muted">{r.description}</p>
                <p className="mt-2 text-[11px] font-mono text-brand/80">
                  {r.modules.join(' · ')}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
