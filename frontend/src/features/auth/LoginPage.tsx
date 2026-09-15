import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import logoDark from '@/assets/logos/logo-dark.png';
import { api } from '@/lib/api';
import { useAuthStore } from './auth-store';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DesktopDownloads } from '@/components/DesktopDownloads';

const schema = z.object({
  email: z.string().email('E-mail invalide'),
  password: z.string().min(8, '8 caractères minimum'),
});

type Form = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const setUser = useAuthStore((s) => s.setUser);
  const [ready, setReady] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    const t = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const { data } = await api.post('/auth/login', values);
      setSession(data.user, data.accessToken, data.refreshToken);
      const me = await api.get('/auth/me');
      setUser({
        ...data.user,
        nom: me.data.nom,
        photoProfil: me.data.photoProfil,
        permissions: me.data.permissions,
      });
      toast.success(`Bienvenue, ${me.data.nom?.split(/\s+/)[0] || data.user.nom}`);
      navigate('/');
    } catch (err: unknown) {
      const ax = err as {
        response?: { status?: number; data?: { message?: string } };
      };
      if (!ax.response) {
        toast.error('Serveur injoignable. Réessayez dans un instant.');
        return;
      }
      if (ax.response.status === 401) {
        toast.error('Identifiants invalides');
        return;
      }
      toast.error(ax.response.data?.message ?? 'Connexion impossible');
    }
  });

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#06101f] text-white">
      {/* Atmosphere */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 90% 70% at 12% 18%, rgba(20,78,185,0.55) 0%, transparent 55%),' +
            'radial-gradient(ellipse 60% 50% at 88% 78%, rgba(59,130,246,0.22) 0%, transparent 50%),' +
            'linear-gradient(160deg, #06101f 0%, #0a1a33 45%, #071225 100%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 75%)',
        }}
      />
      <div
        className={`pointer-events-none absolute -left-24 top-1/4 h-[420px] w-[420px] rounded-full bg-[#144EB9]/30 blur-3xl transition-opacity duration-1000 ${
          ready ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        className={`pointer-events-none absolute -right-16 bottom-0 h-[360px] w-[360px] rounded-full bg-[#3B82F6]/20 blur-3xl transition-opacity delay-150 duration-1000 ${
          ready ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-12 lg:px-10">
        <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
          {/* Brand hero */}
          <section
            className={`transition-all duration-700 ${
              ready ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
            }`}
          >
            <img
              src={logoDark}
              alt="eXpert SARLU"
              className="h-16 w-auto max-w-[260px] object-contain drop-shadow-[0_12px_40px_rgba(20,78,185,0.45)] sm:h-20"
            />
            <h1
              className="mt-10 max-w-xl text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]"
              style={{ fontFamily: 'Syne, Outfit, sans-serif' }}
            >
              Coordination médicale internationale
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-white/70 sm:text-lg">
              Dossiers patients, cotation, protocole et facturation — un seul poste de travail pour
              l’équipe eXpert.
            </p>
            <div className="mt-10 flex flex-wrap gap-6 text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
              <span>Kinshasa</span>
              <span className="text-white/25">·</span>
              <span>Réseau partenaires</span>
              <span className="text-white/25">·</span>
              <span>Suivi bout-en-bout</span>
            </div>
          </section>

          {/* Form — interaction container */}
          <section
            className={`transition-all delay-150 duration-700 ${
              ready ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
            }`}
          >
            <form
              onSubmit={onSubmit}
              className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-8"
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
              <div className="mb-7">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#93C5FD]">
                  Accès équipe
                </p>
                <h2
                  className="mt-2 text-3xl font-extrabold tracking-tight"
                  style={{ fontFamily: 'Syne, Outfit, sans-serif' }}
                >
                  Connexion
                </h2>
                <p className="mt-1.5 text-sm text-white/55">
                  Réservé au personnel eXpert SARLU
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/80">Email</label>
                  <Input
                    type="email"
                    autoComplete="username"
                    className="border-white/15 bg-white/5 text-white placeholder:text-white/35 focus:border-[#144EB9] focus:ring-[#144EB9]/30"
                    {...register('email')}
                  />
                  {errors.email && (
                    <p className="text-xs text-red-300">{errors.email.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/80">Mot de passe</label>
                  <Input
                    type="password"
                    autoComplete="current-password"
                    className="border-white/15 bg-white/5 text-white placeholder:text-white/35 focus:border-[#144EB9] focus:ring-[#144EB9]/30"
                    {...register('password')}
                  />
                  {errors.password && (
                    <p className="text-xs text-red-300">{errors.password.message}</p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="mt-2 h-12 w-full text-base shadow-[0_12px_40px_rgba(20,78,185,0.45)]"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Connexion…' : 'Se connecter'}
                </Button>
              </div>
            </form>

            <div className="mt-6">
              <DesktopDownloads />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
