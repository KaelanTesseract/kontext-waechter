export type Stand = {
  percent: number
  tokens: number
  window: number
  usd: number | null
  turns: number
  agentRuns: number
  agentTokens: number
}

declare module 'claude-code' {
  interface PluginState {
    'kontext-waechter': { stand: Stand | null; isHidden: boolean; isBusy: boolean }
  }
}
