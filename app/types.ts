import Game from '#models/game'
import { Connection } from '@solana/web3.js'

export type Side = 'over' | 'under'

export type OverUnderGameAccountChangeListeners = Record<
  Game['id'],
  {
    over: ReturnType<Connection['onAccountChange']>
    under: ReturnType<Connection['onAccountChange']>
  }
>
