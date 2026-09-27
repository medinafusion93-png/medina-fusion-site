/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WEBHOOK_COMMANDE_URL?: string;
  readonly VITE_WEBHOOK_DEGUSTATION_URL?: string;
  readonly VITE_WEBHOOK_TIMEOUT_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
