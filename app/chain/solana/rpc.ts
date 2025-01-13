import env from '#start/env'
import {
  BlockhashWithExpiryBlockHeight,
  Commitment,
  Connection,
  Keypair,
  PublicKey,
  Signer,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js'

const commitment: Commitment = 'confirmed'

const main = new Connection(env.get('SOLANA_MAIN_RPC_URL'), {
  wsEndpoint: env.get('SOLANA_MAIN_RPC_WS'),
  commitment,
})

const tx = new Connection(env.get('SOLANA_TX_RPC_URL'), {
  wsEndpoint: env.get('SOLANA_TX_RPC_WS'),
  commitment,
})

export const getMainRpc = () => main
export const getRpcForTransaction = () => tx

export const sendRawTransaction = async (raw: Buffer | Uint8Array | Array<number>) => {
  return await tx.sendRawTransaction(raw, {
    skipPreflight: true,
  })
}

export const simulateInstructions = async (
  payer: Keypair,
  instructions: TransactionInstruction[],
  signers: Signer[] = []
) => {
  const latestBlockhash = await main.getLatestBlockhash()
  const transaction = await instructionsToTransaction({
    payerKey: payer.publicKey,
    instructions,
    latestBlockhash,
  })

  transaction.sign(signers)

  return await main.simulateTransaction(transaction)
}

export const instructionsToTransaction = async (args: {
  payerKey: PublicKey
  instructions: TransactionInstruction[]
  latestBlockhash?: BlockhashWithExpiryBlockHeight
  signers?: Signer[]
}) => {
  if (!args.latestBlockhash) {
    args.latestBlockhash = await main.getLatestBlockhash()
  }

  return new VersionedTransaction(await instructionsToMessage(args))
}

export const instructionsToMessage = async (args: {
  payerKey: PublicKey
  instructions: TransactionInstruction[]
  latestBlockhash?: BlockhashWithExpiryBlockHeight
  signers?: Signer[]
}) => {
  if (!args.latestBlockhash) {
    args.latestBlockhash = await main.getLatestBlockhash()
  }

  return new TransactionMessage({
    payerKey: args.payerKey,
    recentBlockhash: args.latestBlockhash.blockhash,
    instructions: args.instructions,
  }).compileToV0Message()
}

export const getFeeForInstructions = async (
  payer: Keypair,
  instructions: TransactionInstruction[]
) => {
  const message = await instructionsToMessage({
    payerKey: payer.publicKey,
    instructions,
  })

  const response = await main.getFeeForMessage(message)

  return response.value || 5000
}

Object.defineProperties(main, {
  getRpcForTransaction: {
    get: () => getRpcForTransaction,
  },
  sendRawTransaction: {
    get: () => sendRawTransaction,
  },
  simulateInstructions: {
    get: () => simulateInstructions,
  },
  instructionsToTransaction: {
    get: () => instructionsToTransaction,
  },
  instructionsToMessage: {
    get: () => instructionsToMessage,
  },
  getFeeForInstructions: {
    get: () => getFeeForInstructions,
  },
})

export default main as Connection & {
  getRpcForTransaction: typeof getRpcForTransaction
  sendRawTransaction: typeof sendRawTransaction
  simulateInstructions: typeof simulateInstructions
  instructionsToTransaction: typeof instructionsToTransaction
  instructionsToMessage: typeof instructionsToMessage
  getFeeForInstructions: typeof getFeeForInstructions
}
