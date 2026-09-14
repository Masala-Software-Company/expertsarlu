import { useEffect, useState } from 'react';
import logoDark from '@/assets/logos/logo-dark.png';

type Props = {
  onDone: () => void;
};

/**
 * Intro type Netflix : écran noir, logo eXpert qui apparaît puis disparaît
 * avant la page de connexion / l’app.
 */
export function SplashIntro({ onDone }: Props) {
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in');

  useEffect(() => {
    const tIn = window.setTimeout(() => setPhase('hold'), 900);
    const tOut = window.setTimeout(() => setPhase('out'), 2600);
    const tDone = window.setTimeout(() => onDone(), 3400);
    return () => {
      window.clearTimeout(tIn);
      window.clearTimeout(tOut);
      window.clearTimeout(tDone);
    };
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black"
      aria-label="Chargement eXpert"
      role="status"
    >
      {/* Vignette bleue marque */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% 50%, rgba(20,78,185,0.35) 0%, transparent 65%)',
        }}
      />

      <div
        className="relative flex flex-col items-center px-8"
        style={{
          animation:
            phase === 'in'
              ? 'expert-splash-in 900ms cubic-bezier(0.22, 1, 0.36, 1) forwards'
              : phase === 'out'
                ? 'expert-splash-out 700ms ease-in forwards'
                : 'expert-splash-pulse 1.6s ease-in-out infinite',
        }}
      >
        <img
          src={logoDark}
          alt="eXpert SARLU"
          className="h-24 w-auto max-w-[min(80vw,520px)] object-contain drop-shadow-[0_0_40px_rgba(20,78,185,0.55)] sm:h-28"
          draggable={false}
        />
        <div className="mt-8 h-[2px] w-24 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-brand"
            style={{
              animation: 'expert-splash-bar 2.6s cubic-bezier(0.4, 0, 0.2, 1) forwards',
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes expert-splash-in {
          0% { opacity: 0; transform: scale(1.35); filter: blur(8px); }
          100% { opacity: 1; transform: scale(1); filter: blur(0); }
        }
        @keyframes expert-splash-out {
          0% { opacity: 1; transform: scale(1); filter: blur(0); }
          100% { opacity: 0; transform: scale(1.08); filter: blur(4px); }
        }
        @keyframes expert-splash-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.02); opacity: 0.92; }
        }
        @keyframes expert-splash-bar {
          0% { width: 0%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  );
}
