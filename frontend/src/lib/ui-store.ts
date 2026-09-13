import { create } from 'zustand';

type UiState = {
  sidebarCollapsed: boolean;
  dark: boolean;
  commandOpen: boolean;
  toggleSidebar: () => void;
  toggleDark: () => void;
  setCommandOpen: (open: boolean) => void;
};

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  dark: false,
  commandOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleDark: () =>
    set((s) => {
      const dark = !s.dark;
      document.documentElement.classList.toggle('dark', dark);
      return { dark };
    }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
}));
