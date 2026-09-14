import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import logoDark from '@/assets/logos/logo-dark.png';
import logoLight from '@/assets/logos/logo-light.png';
import { api } from '@/lib/api';
import { useAuthStore } from './auth-store';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type Form = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const setUser = useAuthStore((s) => s.setUser);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

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
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden items-center justify-center overflow-hidden bg-brand lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 30% 40%, rgba(255,255,255,0.25) 0%, transparent 60%)',
          }}
        />
        <div className="relative z-10 max-w-md px-10 text-white">
          <img
            src={logoDark}
            alt="eXpert SARLU"
            className="mb-10 h-20 w-auto max-w-[280px] object-contain drop-shadow-lg sm:h-24"
          />
          <h1 className="text-4xl font-extrabold tracking-tight">Coordination médicale internationale</h1>
          <p className="mt-4 text-lg leading-relaxed text-white/80">
            Dossiers patients, cotation, protocole et facturation — un seul poste de travail pour
            l’équipe eXpert.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center p-8">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5">
          <div>
            <img
              src={logoLight}
              alt="eXpert SARLU"
              className="mb-6 h-14 w-auto max-w-[220px] object-contain lg:hidden"
            />
            <h2 className="text-2xl font-extrabold tracking-tight">Connexion</h2>
            <p className="mt-1 text-sm text-muted">Accès réservé au personnel eXpert SARLU</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <Input type="email" autoComplete="username" {...register('email')} />
            {errors.email && <p className="text-xs text-danger">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Mot de passe</label>
            <Input type="password" autoComplete="current-password" {...register('password')} />
            {errors.password && <p className="text-xs text-danger">{errors.password.message}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Connexion…' : 'Se connecter'}
          </Button>
        </form>
      </div>
    </div>
  );
}
