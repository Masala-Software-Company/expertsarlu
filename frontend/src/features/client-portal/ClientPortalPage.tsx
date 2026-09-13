import { FormEvent, useState } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import logoOnBlue from '@/assets/logos/logo-on-blue.jpg';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export function ClientPortalPage() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ numero: string; message: string } | null>(null);
  const [form, setForm] = useState({
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    nationalite: '',
    numeroPasseport: '',
    dateNaissance: '',
    adresse: '',
    pathologie: '',
    destination: '',
    typeClient: 'PARTICULIER',
    notes: '',
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [passeport, setPasseport] = useState<File | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (v) fd.append(k, v);
      });
      if (photo) fd.append('photo', photo);
      if (passeport) fd.append('passeport', passeport);

      const { data } = await axios.post(`${apiBase}/client/inscription`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setDone({ numero: data.numero, message: data.message });
      toast.success(`Dossier ${data.numero} créé`);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } }; message?: string };
      toast.error(
        ax.response?.data?.message ??
          (ax.response ? 'Envoi refusé' : `API injoignable (${apiBase})`),
      );
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-canvas px-4 py-16 text-ink">
        <div className="mx-auto max-w-lg rounded-2xl border border-[var(--border)] bg-surface p-8 shadow-soft text-center">
          <img src={logoOnBlue} alt="eXpert" className="mx-auto mb-6 h-12 rounded-lg object-contain" />
          <h1 className="text-2xl font-extrabold">Demande reçue</h1>
          <p className="mt-2 text-sm text-muted">{done.message}</p>
          <p className="mt-4 text-lg font-bold text-brand">{done.numero}</p>
          <p className="mt-2 text-xs text-muted">
            Conservez ce numéro — l’équipe eXpert vous contactera par WhatsApp ou e-mail.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="bg-brand px-4 py-10 text-white">
        <div className="mx-auto max-w-2xl">
          <img src={logoOnBlue} alt="eXpert" className="mb-4 h-10 rounded object-contain" />
          <h1 className="text-3xl font-extrabold tracking-tight">Portail patient</h1>
          <p className="mt-2 text-white/80">
            Remplissez votre dossier KYC (identité + passeport). eXpert reçoit automatiquement
            votre demande pour évaluation, mobilité et suivi.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-5 px-4 py-8">
        <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-surface p-5 shadow-soft">
          <h2 className="font-bold">Identité</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-muted">Nom *</span>
              <Input required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted">Prénom *</span>
              <Input required value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted">E-mail</span>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted">Téléphone / WhatsApp</span>
              <Input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted">Nationalité</span>
              <Input value={form.nationalite} onChange={(e) => setForm({ ...form, nationalite: e.target.value })} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted">N° passeport (KYC)</span>
              <Input value={form.numeroPasseport} onChange={(e) => setForm({ ...form, numeroPasseport: e.target.value })} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted">Date de naissance</span>
              <Input type="date" value={form.dateNaissance} onChange={(e) => setForm({ ...form, dateNaissance: e.target.value })} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted">Type de client</span>
              <select
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-surface px-3 text-sm"
                value={form.typeClient}
                onChange={(e) => setForm({ ...form, typeClient: e.target.value })}
              >
                <option value="PARTICULIER">Particulier</option>
                <option value="INSTITUTION">Institution publique</option>
              </select>
            </label>
          </div>
          <label className="block space-y-1 text-sm">
            <span className="text-muted">Adresse</span>
            <Input value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} />
          </label>
        </section>

        <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-surface p-5 shadow-soft">
          <h2 className="font-bold">Demande médicale</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-muted">Pathologie / motif</span>
              <Input value={form.pathologie} onChange={(e) => setForm({ ...form, pathologie: e.target.value })} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted">Destination souhaitée</span>
              <Input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="Ex. Turquie — Istanbul" />
            </label>
          </div>
          <label className="block space-y-1 text-sm">
            <span className="text-muted">Notes / questionnaire ambassade</span>
            <textarea
              className="min-h-24 w-full rounded-lg border border-[var(--border)] bg-surface px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
        </section>

        <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-surface p-5 shadow-soft">
          <h2 className="font-bold">Documents</h2>
          <label className="block space-y-1 text-sm">
            <span className="text-muted">Photo de profil *</span>
            <Input
              type="file"
              accept="image/*"
              required
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-muted">Scan passeport (KYC)</span>
            <Input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setPasseport(e.target.files?.[0] ?? null)}
            />
          </label>
        </section>

        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? 'Envoi…' : 'Envoyer ma demande à eXpert'}
        </Button>
        <p className="text-center text-[11px] text-muted">
          Les données sont transmises de façon sécurisée à l’équipe eXpert SARLU.
        </p>
      </form>
    </div>
  );
}
