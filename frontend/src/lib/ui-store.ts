import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type UiState = {
  sidebarCollapsed: boolean;
  dark: boolean;
  commandOpen: boolean;
  toggleSidebar: () => void;
  toggleDark: () => void;
  setCommandOpen: (open: boolean) => void;
  syncDom: () => void;
};

function applyDarkClass(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark);
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: false,
      dark: false,
      commandOpen: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      toggleDark: () => {
        const dark = !get().dark;
        applyDarkClass(dark);
        set({ dark });
      },
      setCommandOpen: (commandOpen) => set({ commandOpen }),
      syncDom: () => applyDarkClass(get().dark),
    }),
    {
      name: 'expert-ui',
      partialize: (s) => ({ dark: s.dark, sidebarCollapsed: s.sidebarCollapsed }),
      onRehydrateStorage: () => (state) => {
        if (state) applyDarkClass(state.dark);
      },
    },
  ),
);
