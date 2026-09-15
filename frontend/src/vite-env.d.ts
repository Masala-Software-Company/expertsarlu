/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_APP_VERSION?: string;
  readonly VITE_PUBLIC_VERIFY_BASE_URL?: string;
  readonly VITE_PUBLIC_FORM_BASE_URL?: string;
  readonly VITE_PUBLIC_SUIVI_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
