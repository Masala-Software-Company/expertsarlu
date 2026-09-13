import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type User = {
  id: string;
  nom: string;
  email: string;
  role: string;
  photoProfil?: string | null;
  permissions?: { module: string; action: string }[];
};

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  setSession: (user: User, accessToken: string, refreshToken: string) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
};

/**
 * Stockage session type « keychain » :
 * - tokens dans sessionStorage (effacés à la fermeture du navigateur / WebView)
 * - profil léger en localStorage pour reconnexion UI
 * En build Tauri desktop, préférer un plugin keychain natif plus tard.
 */
const tokenStorage = {
  getItem: (name: string) => {
    const tokens = sessionStorage.getItem(`${name}:tokens`);
    const profile = localStorage.getItem(`${name}:profile`);
    if (!tokens && !profile) return null;
    try {
      const t = tokens ? JSON.parse(tokens) : {};
      const p = profile ? JSON.parse(profile) : {};
      return JSON.stringify({ state: { ...t, ...p }, version: 0 });
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      const parsed = JSON.parse(value) as {
        state: AuthState;
      };
      sessionStorage.setItem(
        `${name}:tokens`,
        JSON.stringify({
          accessToken: parsed.state.accessToken,
          refreshToken: parsed.state.refreshToken,
        }),
      );
      localStorage.setItem(
        `${name}:profile`,
        JSON.stringify({ user: parsed.state.user }),
      );
    } catch {
      /* ignore */
    }
  },
  removeItem: (name: string) => {
    sessionStorage.removeItem(`${name}:tokens`);
    localStorage.removeItem(`${name}:profile`);
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setSession: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      setUser: (user) => set({ user }),
      logout: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    {
      name: 'expert-auth',
      storage: createJSONStorage(() => tokenStorage),
      partialize: (s) => ({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        user: s.user,
      }),
    },
  ),
);
