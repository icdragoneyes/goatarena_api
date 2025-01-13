import env from '#start/env'
import { Keypair } from '@solana/web3.js'
import base58 from './base58.js'

export const getMasterWallet = () => {
  const key = env.get('SOLANA_MASTER_WALLET')

  return Keypair.fromSecretKey(base58.decode(key))
}
