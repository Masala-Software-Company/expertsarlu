import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Trash2, UserRound, X } from 'lucide-react';
import { api } from '@/lib/api';
import { ROLE_LABELS, cn, firstName } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { UserAvatar } from '@/components/UserAvatar';
import { useAuthStore } from '@/features/auth/auth-store';

type Member = {
  id: string;
  nom: string;
  email: string;
  role: string;
  actif: boolean;
  photoProfil?: string | null;
  creeLe: string;
};

const ROLES = [
  'ASSISTANT_MANAGER',
  'SUPPORT_CLIENT',
  'CAISSE_ADMIN',
  'PROTOCOLE',
  'SUPER_ADMIN',
] as const;

export function UsersPage() {
  const me = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    nom: '',
    email: '',
    password: '',
    role: 'ASSISTANT_MANAGER',
  });
  const [edit, setEdit] = useState({ nom: '', role: '', password: '' });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get<Member[]>('/users')).data,
    enabled: me?.role === 'SUPER_ADMIN',
  });

  const selected = useMemo(
    () => members.find((m) => m.id === selectedId) ?? null,
    [members, selectedId],
  );

  // Ne dépend que de selectedId : un refetch (ex. après photo) ne doit pas
  // écraser le nom / rôle en cours de saisie.
  useEffect(() => {
    if (!selectedId) {
      setConfirmDelete(false);
      return;
    }
    const m = members.find((x) => x.id === selectedId);
    if (m) setEdit({ nom: m.nom, role: m.role, password: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync only when opening a member
  }, [selectedId]);

  const syncMe = async (updated: Member) => {
    if (me?.id !== updated.id) return;
    try {
      const { data } = await api.get<{
        nom: string;
        role: string;
        photoProfil?: string | null;
        permissions?: { module: string; action: string }[];
      }>('/auth/me');
      setUser({
        ...me,
        nom: data.nom,
        role: data.role,
        photoProfil: data.photoProfil ?? updated.photoProfil,
        permissions: data.permissions ?? me.permissions,
      });
    } catch {
      setUser({
        ...me,
        nom: updated.nom,
        role: updated.role,
        photoProfil: updated.photoProfil,
      });
    }
  };

  const create = useMutation({
    mutationFn: async () => (await api.post('/users', form)).data as Member,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] });
      setForm({ nom: '', email: '', password: '', role: 'ASSISTANT_MANAGER' });
      setShowCreate(false);
      toast.success('Membre ajouté');
    },
    onError: (err: { response?: { data?: { message?: string | string[] } } }) => {
      const msg = err.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg || 'Création refusée');
    },
  });

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('Aucun membre sélectionné');
      const body: Record<string, string> = {
        nom: edit.nom.trim(),
        role: edit.role,
      };
      if (edit.password.trim()) body.password = edit.password.trim();
      return (await api.patch(`/users/${selected.id}`, body)).data as Member;
    },
    onSuccess: async (updated) => {
      if (!updated) return;
      await syncMe(updated);
      void qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Profil enregistré');
      setConfirmDelete(false);
      setSelectedId(null);
    },
    onError: (err: { response?: { data?: { message?: string | string[] }; status?: number } }) => {
      const msg = err.response?.data?.message;
      const text = Array.isArray(msg) ? msg.join(', ') : msg;
      toast.error(
        text ||
          (err.response?.status
            ? `Erreur ${err.response.status}`
            : 'Enregistrement impossible — API injoignable'),
      );
    },
  });

  const setActif = useMutation({
    mutationFn: async ({ id, actif }: { id: string; actif: boolean }) =>
      (await api.patch(`/users/${id}/actif`, { actif })).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Statut mis à jour');
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/users/${id}`)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] });
      setSelectedId(null);
      setConfirmDelete(false);
      toast.success('Membre retiré');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Suppression refusée');
    },
  });

  const uploadPhoto = useMutation({
    mutationFn: async (file: File) => {
      if (!selected) return;
      const fd = new FormData();
      fd.append('file', file);
      return (await api.post(`/users/${selected.id}/photo`, fd)).data as Member;
    },
    onSuccess: async (updated) => {
      if (!updated) return;
      await syncMe(updated);
      void qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Photo mise à jour');
    },
    onError: (err: { response?: { data?: { message?: string | string[] }; status?: number } }) => {
      const msg = err.response?.data?.message;
      toast.error(
        (Array.isArray(msg) ? msg.join(', ') : msg) ||
          (err.response?.status
            ? `Upload refusé (${err.response.status}) — vérifiez le volume Railway /data`
            : 'Upload impossible — API injoignable'),
      );
    },
  });

  if (me?.role !== 'SUPER_ADMIN') return <Navigate to="/" replace />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Équipe</h1>
          <p className="mt-1 text-sm text-muted">
            Gérez les collaborateurs eXpert, leurs rôles et leurs profils.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" /> Ajouter un membre
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {members.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setSelectedId(m.id)}
            className={cn(
              'rounded-2xl border bg-surface p-4 text-left shadow-soft transition-ui hover:border-brand/40',
              selectedId === m.id ? 'border-brand ring-2 ring-brand/20' : 'border-[var(--border)]',
            )}
          >
            <div className="flex items-center gap-3">
              <UserAvatar userId={m.id} photoProfil={m.photoProfil} nom={m.nom} size="md" />
              <div className="min-w-0">
                <div className="truncate font-semibold">{m.nom}</div>
                <div className="truncate text-xs text-muted">{m.email}</div>
                <div className="mt-1 text-xs font-medium text-brand">
                  {ROLE_LABELS[m.role] ?? m.role}
                </div>
              </div>
              <span
                className={cn(
                  'ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold',
                  m.actif
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                    : 'bg-canvas text-muted',
                )}
              >
                {m.actif ? 'Actif' : 'Inactif'}
              </span>
            </div>
          </button>
        ))}
        {!isLoading && members.length === 0 && (
          <div className="col-span-full rounded-2xl border border-[var(--border)] bg-surface p-10 text-center text-muted">
            Aucun membre — ajoutez le premier collaborateur.
          </div>
        )}
      </div>

      {showCreate && (
        <Modal title="Nouveau membre" onClose={() => setShowCreate(false)}>
          <form
            className="space-y-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <Field label="Nom complet">
              <Input
                required
                value={form.nom}
                onChange={(e) => setForm({ ...form, nom: e.target.value })}
                placeholder="Ex. Marie Kabongo"
              />
            </Field>
            <Field label="E-mail">
              <Input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="Mot de passe temporaire">
              <Input
                required
                type="password"
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </Field>
            <Field label="Rôle">
              <select
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-surface px-3 text-sm text-ink"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowCreate(false)}>
                Annuler
              </Button>
              <Button type="submit" className="flex-1" disabled={create.isPending}>
                Créer
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {selected && (
        <Modal
          title={`Profil — ${firstName(selected.nom) || selected.nom}`}
          onClose={() => {
            setConfirmDelete(false);
            setSelectedId(null);
          }}
        >
          <div className="flex flex-col items-center gap-3 pb-4">
            <UserAvatar
              userId={selected.id}
              photoProfil={selected.photoProfil}
              nom={selected.nom}
              size="lg"
            />
            <label className="cursor-pointer text-xs font-semibold text-brand">
              Changer la photo
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadPhoto.mutate(f);
                }}
              />
            </label>
          </div>
          <div className="space-y-3">
            <Field label="Nom complet">
              <Input value={edit.nom} onChange={(e) => setEdit({ ...edit, nom: e.target.value })} />
            </Field>
            <Field label="E-mail">
              <Input value={selected.email} disabled />
            </Field>
            <Field label="Rôle">
              <select
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-surface px-3 text-sm text-ink"
                value={edit.role}
                onChange={(e) => setEdit({ ...edit, role: e.target.value })}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nouveau mot de passe (optionnel)">
              <Input
                type="password"
                minLength={8}
                value={edit.password}
                placeholder="Laisser vide pour ne pas changer"
                onChange={(e) => setEdit({ ...edit, password: e.target.value })}
              />
            </Field>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                className="flex-1"
                onClick={() => saveProfile.mutate()}
                disabled={saveProfile.isPending}
              >
                Enregistrer
              </Button>
              <Button
                variant="secondary"
                disabled={selected.id === me?.id}
                onClick={() =>
                  setActif.mutate({ id: selected.id, actif: !selected.actif })
                }
              >
                {selected.actif ? 'Désactiver' : 'Réactiver'}
              </Button>
              <Button
                variant="danger"
                disabled={selected.id === me?.id}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {selected && confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-surface p-5 shadow-soft">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-danger/15 text-danger">
                <Trash2 className="h-4 w-4" />
              </div>
              <h3 className="text-lg font-bold">Supprimer le membre</h3>
            </div>
            <p className="text-sm text-muted">
              Vous êtes sur le point de retirer{' '}
              <span className="font-semibold text-ink">{selected.nom}</span> (
              {selected.email}). Cette action est définitive.
            </p>
            <div className="mt-5 flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setConfirmDelete(false)}
                disabled={remove.isPending}
              >
                Annuler
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                disabled={remove.isPending}
                onClick={() => remove.mutate(selected.id)}
              >
                {remove.isPending ? 'Suppression…' : 'Supprimer'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-muted">{label}</span>
      {children}
    </label>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-md overflow-auto rounded-2xl border border-[var(--border)] bg-surface p-5 shadow-soft">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-bold">
            <UserRound className="h-4 w-4 text-brand" />
            {title}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-canvas" aria-label="Fermer">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
