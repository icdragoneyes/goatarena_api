import {
  Finality,
  ComputeBudgetProgram,
  Keypair,
  ParsedInstruction,
  ParsedTransaction,
  PublicKey,
  SignaturesForAddressOptions,
  SystemProgram,
  TransactionInstruction,
  ParsedTransactionWithMeta,
  ConfirmedSignatureInfo,
  TransactionMessage,
  VersionedTransaction,
  Signer,
} from '@solana/web3.js'
import { MEMO_PROGRAM_ID, SYSTEM_PROGRAM_ID } from './constant.js'
import rpc, { getFeeForInstructions, instructionsToTransaction, sendRawTransaction } from './rpc.js'
import logger from '@adonisjs/core/services/logger'
import { sleep } from '../../utils.js'
import { AccountLayout, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { TransactionSignatureNotExists } from '#services/errors'

export const transfer = async (
  sender: Keypair,
  recipient: PublicKey,
  amount: number,
  {
    memo,
    decreaseWithFee,
    units,
    microLamports,
    signers = [],
  }: {
    memo?: string
    decreaseWithFee?: boolean
    units?: number
    microLamports?: number
    signers?: Keypair[]
  }
): Promise<{
  signature: string
  success: boolean
}> => {
  const retry = async (error: unknown): ReturnType<typeof transfer> => {
    logger.error(
      {
        sender: sender.publicKey.toBase58(),
        recipient: recipient.toBase58(),
        amount,
        options: {
          memo,
          decreaseWithFee,
          units,
          microLamports,
          signers: signers.map((s) => s.publicKey.toBase58()),
        },
        error,
      },
      '[transfer] retrying'
    )

    await sleep(100)

    return transfer(sender, recipient, amount, {
      memo,
      decreaseWithFee,
      units,
      microLamports,
      signers,
    })
  }
  const instructions = []

  if (units) {
    instructions.push(
      ComputeBudgetProgram.setComputeUnitLimit({
        units,
      })
    )
  }

  if (microLamports) {
    instructions.push(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports,
      })
    )
  }

  if (memo) {
    instructions.push(
      new TransactionInstruction({
        keys: [],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(memo),
      })
    )
  }

  if (decreaseWithFee) {
    const fee = await getFeeForInstructions(sender, instructions)

    amount -= fee
  }

  instructions.push(
    SystemProgram.transfer({
      fromPubkey: sender.publicKey,
      toPubkey: recipient,
      lamports: amount,
    })
  )

  let latestBlockhash

  try {
    latestBlockhash = await rpc.getLatestBlockhash()
  } catch (e) {
    return await retry(e)
  }

  let transaction

  try {
    transaction = await instructionsToTransaction({
      payerKey: sender.publicKey,
      instructions,
      latestBlockhash,
    })
  } catch (e) {
    return await retry(e)
  }

  transaction.sign([...signers, sender])

  let signature

  try {
    signature = await sendRawTransaction(transaction.serialize())
  } catch (e) {
    return await retry(e)
  }

  let success

  try {
    await rpc.confirmTransaction(
      {
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      },
      'confirmed'
    )

    success = true
  } catch (error) {
    logger.error(
      {
        sender: sender.publicKey.toBase58(),
        recipient: recipient.toBase58(),
        amount,
        signature,
        error,
      },
      '[transfer]'
    )
    success = false
  }

  return {
    signature,
    success,
  }
}

export const transferToMany = async (
  sender: Keypair,
  recipients: { address: PublicKey; lamports: number }[],
  {
    memo,
    units,
    microLamports,
    signers = [],
  }: {
    memo?: string
    units?: number
    microLamports?: number
    signers?: Keypair[]
  }
): Promise<{
  signature: string
  success: boolean
}> => {
  const retry = async (error: unknown): ReturnType<typeof transferToMany> => {
    logger.error(
      {
        sender: sender.publicKey.toBase58(),
        recipients: recipients.map((recipient) => {
          return {
            address: recipient.address.toBase58(),
            lamports: recipient.lamports,
          }
        }),
        options: {
          memo,
          units,
          microLamports,
          signers: signers.map((s) => s.publicKey.toBase58()),
        },
        error,
      },
      '[transferToMany] retrying'
    )

    await sleep(100)

    return await transferToMany(sender, recipients, {
      memo,
      units,
      microLamports,
      signers,
    })
  }
  const instructions = []

  if (units) {
    instructions.push(
      ComputeBudgetProgram.setComputeUnitLimit({
        units,
      })
    )
  }

  if (microLamports) {
    instructions.push(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports,
      })
    )
  }

  if (memo) {
    instructions.push(
      new TransactionInstruction({
        keys: [],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(memo),
      })
    )
  }

  for (const { address, lamports } of recipients) {
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: sender.publicKey,
        toPubkey: address,
        lamports,
      })
    )
  }

  let latestBlockhash

  try {
    latestBlockhash = await rpc.getLatestBlockhash()
  } catch (e) {
    return await retry(e)
  }

  let transaction

  try {
    transaction = await instructionsToTransaction({
      payerKey: sender.publicKey,
      instructions,
      latestBlockhash,
    })
  } catch (e) {
    return await retry(e)
  }

  transaction.sign([...signers, sender])

  const signature = await sendRawTransaction(transaction.serialize())
  let success

  try {
    await rpc.confirmTransaction(
      {
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      },
      'confirmed'
    )

    success = true
  } catch (error) {
    logger.error(
      {
        sender: sender.publicKey.toBase58(),
        recipients: recipients.map(({ address, lamports }) => ({
          address: address.toBase58(),
          lamports,
        })),
        signature,
        error,
      },
      'Transfer'
    )

    success = false
  }

  return {
    signature,
    success,
  }
}

export const getParsedTransactionsFromAccount = async (
  owner: PublicKey,
  options?: SignaturesForAddressOptions & {
    commitment?: Finality
    reverse?: boolean
  }
) => {
  let error

  for (let i = 0; i < 3; i++) {
    try {
      let signatures = await rpc.getSignaturesForAddress(owner, options)

      if (options?.reverse) {
        signatures = signatures.reverse()
      }

      logger.info(
        {
          owner,
        },
        'Finding transactions for owner'
      )

      const transactions = await rpc
        .getParsedTransactions(
          signatures.map((s) => s.signature),
          {
            maxSupportedTransactionVersion: 0,
          }
        )
        .then((txs) => {
          return txs
            .map((tx, j) => {
              const s = signatures[j]
              const t = {
                exists: tx !== null,
                ...s,
                ...tx,
              }
              return [s.signature, t] as unknown as [
                string,
                ParsedTransactionWithMeta &
                  ConfirmedSignatureInfo & {
                    exists: boolean
                  },
              ]
            })
            .filter(([_, tx]) => tx.exists)
        })

      return Object.fromEntries(transactions)
    } catch (e) {
      logger.error({ error: e }, 'Finding transactions for owner')
      error = e
    }

    await sleep(200)
  }

  if (!error) {
    return {}
  }

  throw error
}

export const getSolTransferInfoFromParsedTransaction = (transaction: ParsedTransaction) => {
  const transfers = []
  const instructions = transaction.message.instructions

  for (const instruction of instructions) {
    if (instruction.programId.equals(SYSTEM_PROGRAM_ID)) {
      const i = instruction as ParsedInstruction
      const { type, info } = i.parsed as {
        type: string
        info: {
          source: string
          destination: string
          lamports: number
        }
      }

      if (type === 'transfer') {
        transfers.push({
          source: new PublicKey(info.source),
          destination: new PublicKey(info.destination),
          lamports: Number(info.lamports),
        })
      }
    }
  }

  return transfers
}

export const getTokenTransferInfoFromParsedTransaction = async (
  transaction: ParsedTransaction,
  programId = TOKEN_PROGRAM_ID
) => {
  const transfers = []
  const instructions = transaction.message.instructions

  type Checked = {
    destination: string
    mint: string
    multisigAuthority: string
    source: string
    tokenAmount: {
      amount: string
      decimals: number
      uiAmount: number
    }
  }

  type NotChecked = {
    destination: string
    mint: string
    multisigAuthority: string
    source: string
    amount: string
  }

  for (const instruction of instructions) {
    if (instruction.programId.equals(programId)) {
      const data = instruction as ParsedInstruction
      const { type, info } = data.parsed as {
        type: string
        info: Checked | NotChecked
      }

      if (type.includes('transfer')) {
        const source = new PublicKey(info.source)
        const destination = new PublicKey(info.destination)
        const account = await rpc.getAccountInfo(source)

        if (account) {
          const deserialized = AccountLayout.decode(account.data)
          const amount = (info as Checked).tokenAmount?.amount || (info as NotChecked).amount

          transfers.push({
            owner: deserialized.owner,
            source,
            destination,
            amount: Number(amount),
          })
        }
      }
    }
  }

  return transfers
}

export const getTransferSolFromSignature = async (signature: string) => {
  let parsedTransactionWithMeta

  try {
    parsedTransactionWithMeta = await rpc.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    })
  } catch (e) {
    throw new TransactionSignatureNotExists(signature)
  }

  if (!parsedTransactionWithMeta) {
    throw new TransactionSignatureNotExists(signature)
  }

  return getSolTransferInfoFromParsedTransaction(parsedTransactionWithMeta.transaction)
}

export const getSourceTransferFromDestination = async (payload: {
  signature: string
  destination: PublicKey
  lamports?: number
}) => {
  const transfers = await getTransferSolFromSignature(payload.signature)

  for (const { destination, source, lamports } of transfers) {
    // console.log({ destination: destination.toBase58(), source: source.toBase58(), lamports })
    if (destination.equals(payload.destination)) {
      if (payload.lamports && lamports < payload.lamports) {
        return null
      }

      return {
        source,
        lamports,
      }
    }
  }

  return null
}

export const getTransferTokenFromSignature = async (signature: string) => {
  let parsedTransactionWithMeta

  try {
    parsedTransactionWithMeta = await rpc.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    })
  } catch (e) {
    throw new TransactionSignatureNotExists(signature)
  }

  if (!parsedTransactionWithMeta) {
    throw new TransactionSignatureNotExists(signature)
  }

  return getTokenTransferInfoFromParsedTransaction(parsedTransactionWithMeta.transaction)
}

const getAvailableBalanceToTransferAll = async (
  account: PublicKey,
  {
    append = [],
    payer,
  }: {
    append: TransactionInstruction[]
    payer?: Keypair | Signer
  }
) => {
  const lamports = await rpc.getBalance(account)
  const destination = Keypair.generate()
  const diff = await getInsufficientLamports(payer?.publicKey || account, [
    SystemProgram.transfer({
      fromPubkey: account,
      toPubkey: destination.publicKey,
      lamports,
    }),
    SystemProgram.allocate({
      accountPubkey: account,
      space: 0,
    }),
    ...append,
  ])

  return lamports - diff
}

const getInsufficientLamports = async (
  payer: PublicKey,
  instructions: TransactionInstruction[]
) => {
  const latestBlockhash = await rpc.getLatestBlockhash()
  const message = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: latestBlockhash.blockhash,
    instructions,
  }).compileToV0Message()

  const transaction = new VersionedTransaction(message)

  const simulated = JSON.stringify(await rpc.simulateTransaction(transaction).catch((e) => e))
  const regex = /insufficient lamports ([\d]+), need ([\d]+)/
  const match = simulated.match(regex)

  if (!match) {
    return 0
  }

  const needed = Number(match[2])
  const requested = Number(match[1])

  return Math.abs(requested - needed)
}

export const closeAccount = async (
  account: Keypair,
  destination: PublicKey,
  options: {
    memo?: string
    payer?: Keypair | Signer
  } = {}
): Promise<string> => {
  const retry = async (error: unknown) => {
    logger.error(
      {
        account: account.publicKey.toBase58(),
        destination: destination.toBase58(),
        options,
        error,
      },
      '[closeAccount]'
    )

    await sleep(100)

    return closeAccount(account, destination, options)
  }

  const append = []

  if (options?.memo) {
    append.push(
      new TransactionInstruction({
        keys: [],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(options.memo),
      })
    )
  }

  const balance = await getAvailableBalanceToTransferAll(account.publicKey, {
    append,
    payer: options?.payer,
  })

  let latestBlockhash

  try {
    latestBlockhash = await rpc.getLatestBlockhash()
  } catch (e) {
    return await retry(e)
  }

  const message = new TransactionMessage({
    payerKey: options?.payer?.publicKey || account.publicKey,
    recentBlockhash: latestBlockhash.blockhash,
    instructions: [
      SystemProgram.transfer({
        fromPubkey: account.publicKey,
        toPubkey: destination,
        lamports: balance,
      }),
      SystemProgram.allocate({
        accountPubkey: account.publicKey,
        space: 0,
      }),
      ...append,
    ],
  }).compileToV0Message()

  const transaction = new VersionedTransaction(message)

  if (options.payer) {
    transaction.sign([account, options.payer])
  } else {
    transaction.sign([account])
  }

  let signature

  try {
    signature = await sendRawTransaction(transaction.serialize())
  } catch (e) {
    return retry(e)
  }

  await rpc.confirmTransaction({
    signature,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  })

  return signature
}
