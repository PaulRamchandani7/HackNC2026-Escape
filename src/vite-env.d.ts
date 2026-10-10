/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SOLANA_RPC: string
  readonly VITE_SOLANA_NETWORK: string
  readonly VITE_SOLANA_EXPLORER: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
