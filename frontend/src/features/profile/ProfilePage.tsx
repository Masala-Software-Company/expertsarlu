import { FormEvent, useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { ROLE_LABELS, firstName } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { UserAvatar } from '@/components/UserAvatar';
import { useAuthStore } from '@/features/auth/auth-store';
import { setAppLanguage } from '@/lib/i18n';

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [nom, setNom] = useState(user?.nom ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    setNom(user?.nom ?? '');
  }, [user?.nom]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const saveNom = useMutation({
    mutationFn: async () =>
      (await api.patch('/users/me', { nom: nom.trim() })).data as { nom: string },
    onSuccess: async (data) => {
      try {
        const me = await api.get('/auth/me');
        if (user) {
          setUser({
            ...user,
            nom: me.data.nom ?? data.nom,
            photoProfil: me.data.photoProfil ?? user.photoProfil,
            permissions: me.data.permissions ?? user.permissions,
          });
        }
      } catch {
        if (user) setUser({ ...user, nom: data.nom });
      }
      toast.success('Nom enregistré');
    },
    onError: (err: { response?: { data?: { message?: string | string[] } } }) => {
      const msg = err.response?.data?.message;
      toast.error(
        (Array.isArray(msg) ? msg.join(', ') : msg) || 'Impossible d’enregistrer le nom',
      );
    },
  });

  const savePassword = useMutation({
    mutationFn: async () =>
      (
        await api.patch('/users/me/password', {
          currentPassword,
          newPassword,
        })
      ).data,
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      toast.success('Mot de passe mis à jour');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Changement refusé');
    },
  });

  const uploadPhoto = useMutation({
    mutationFn: async (file: File) => {
      const local = URL.createObjectURL(file);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return local;
      });
      const fd = new FormData();
      fd.append('file', file);
      return (await api.post('/users/me/photo', fd)).data as {
        photoProfil?: string | null;
      };
    },
    onSuccess: async (data) => {
      const nextRef =
        data.photoProfil ??
        (await api.get('/auth/me').then((r) => r.data.photoProfil as string | null).catch(() => null)) ??
        `v-${Date.now()}`;
      if (user) {
        setUser({
          ...user,
          photoProfil: nextRef,
        });
      }
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      toast.success('Photo mise à jour');
    },
    onError: () => {
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      toast.error('Upload impossible');
    },
  });

  if (!user) return null;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">
          Bonjour, {firstName(user.nom) || '…'}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {ROLE_LABELS[user.role] ?? user.role} — votre profil eXpert
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-surface p-6 shadow-soft">
        <div className="flex flex-col items-center gap-3">
          {previewUrl ? (
            <div className="h-16 w-16 overflow-hidden rounded-full bg-brand/15">
              <img src={previewUrl} alt="" className="h-full w-full object-cover" />
            </div>
          ) : (
            <UserAvatar
              key={user.photoProfil ?? 'none'}
              userId={user.id}
              photoProfil={user.photoProfil}
              nom={user.nom}
              size="lg"
            />
          )}
          <label className="cursor-pointer text-xs font-semibold text-brand">
            {uploadPhoto.isPending ? 'Envoi…' : 'Changer ma photo'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploadPhoto.isPending}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) uploadPhoto.mutate(f);
              }}
            />
          </label>
        </div>

        <form
          className="mt-6 space-y-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            saveNom.mutate();
          }}
        >
          <label className="block space-y-1 text-sm">
            <span className="text-muted">Nom complet</span>
            <Input value={nom} onChange={(e) => setNom(e.target.value)} required minLength={2} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-muted">E-mail</span>
            <Input value={user.email} disabled />
          </label>
          <Button type="submit" disabled={saveNom.isPending}>
            Enregistrer le nom
          </Button>
        </form>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-surface p-6 shadow-soft space-y-3">
        <h2 className="font-bold">Langue / Language</h2>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => setAppLanguage('fr')}>
            Français
          </Button>
          <Button type="button" variant="secondary" onClick={() => setAppLanguage('en')}>
            English
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-surface p-6 shadow-soft space-y-3">
        <h2 className="font-bold">Mot de passe</h2>
        <Input
          type="password"
          placeholder="Mot de passe actuel"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <Input
          type="password"
          placeholder="Nouveau mot de passe (min. 8)"
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <Button
          disabled={savePassword.isPending || newPassword.length < 8}
          onClick={() => savePassword.mutate()}
        >
          Changer le mot de passe
        </Button>
      </div>
    </div>
  );
}
