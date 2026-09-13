import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import logoOnBlue from '@/assets/logos/logo-on-blue.jpg';
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
    defaultValues: { email: 'admin@expert.sarlu', password: 'Expert2026!' },
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
        code?: string;
        message?: string;
        response?: { status?: number; data?: { message?: string } };
      };
      if (!ax.response) {
        toast.error(
          `API injoignable (${import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'}). Démarrez le backend : pnpm dev:api`,
        );
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
      <div
        className="relative hidden lg:flex items-center justify-center overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(160deg, rgba(20,78,185,0.92), rgba(10,10,10,0.75)), url(${logoOnBlue})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="relative z-10 max-w-md px-10 text-white">
          <img src={logoOnBlue} alt="eXpert SARLU" className="mb-8 h-16 object-contain mix-blend-normal rounded-lg" />
          <h1 className="text-4xl font-extrabold tracking-tight">Coordination médicale internationale</h1>
          <p className="mt-4 text-white/80 text-lg leading-relaxed">
            Dossiers patients, cotation, protocole et facturation — un seul poste de travail pour
            l’équipe eXpert.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center p-8">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5">
          <div>
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
          <p className="text-center text-[11px] text-muted break-all">
            API : {(import.meta.env.VITE_API_URL as string) ?? 'http://localhost:3000/api'}
          </p>
        </form>
      </div>
    </div>
  );
}
