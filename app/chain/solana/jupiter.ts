import env from '#start/env'
import {
  AddressLookupTableAccount,
  BlockhashWithExpiryBlockHeight,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js'
import { RouteNotFound } from './errors.js'
import rpc from './rpc.js'

export type QuoteResponse = {
  inputMint: string
  inAmount: string
  outputMint: string
  outAmount: string
  otherAmountThreshold: string
  swapMode: string
  slippageBps: number
  platformFee: string
  priceImpactPct: string
  routePlan: {
    swapInfo: {
      ammKey: string
      label: string
      inputMint: string
      outputMint: string
      inAmount: string
      outAmount: string
      feeAmount: string
      feeMint: string
    }
    percent: number
  }[]
  contextSlot: number
  timeTaken: number
}

export type InstructionResponse = {
  programId: string
  accounts: {
    pubkey: string
    isSigner: boolean
    isWritable: boolean
  }[]
  data: string
}

export type SwapInstructionResponse = {
  computeBudgetInstructions: InstructionResponse[]
  setupInstructions: InstructionResponse[]
  swapInstruction: InstructionResponse
  cleanupInstruction: InstructionResponse
  otherInstructions: InstructionResponse[]
  addressLookupTableAddresses: string[]
}

export type AddressLookupTableAccountsAndInstructions = {
  addressLookupTableAccounts: AddressLookupTableAccount[]
  instructions: TransactionInstruction[]
}

export type QuoteOptions = {
  slippageBps?: number
  swapMode?: 'ExactIn' | 'ExactOut'
  dexes?: string[]
  excludeDexes?: string[]
  platformFeeBps?: number
  autoSlippage?: boolean
  maxAutoSlippageBps?: number
  autoSlippageCollisionUsdValue?: number
}

export type SwapOptions = QuoteOptions & { payer?: PublicKey }

export const SOL = new PublicKey('So11111111111111111111111111111111111111112')

const deserializeInstruction = (instruction: InstructionResponse) => {
  return new TransactionInstruction({
    programId: new PublicKey(instruction.programId),
    keys: instruction.accounts.map((key) => ({
      pubkey: new PublicKey(key.pubkey),
      isSigner: key.isSigner,
      isWritable: key.isWritable,
    })),
    data: Buffer.from(instruction.data, 'base64'),
  })
}

const getAddressLookupTableAccounts = async (
  keys: string[]
): Promise<AddressLookupTableAccount[]> => {
  const addressLookupTableAccountInfos = await rpc.getMultipleAccountsInfo(
    keys.map((key) => new PublicKey(key))
  )

  return addressLookupTableAccountInfos.reduce((acc, accountInfo, index) => {
    const addressLookupTableAddress = keys[index]
    if (accountInfo) {
      const addressLookupTableAccount = new AddressLookupTableAccount({
        key: new PublicKey(addressLookupTableAddress),
        state: AddressLookupTableAccount.deserialize(accountInfo.data),
      })
      acc.push(addressLookupTableAccount)
    }

    return acc
  }, [] as AddressLookupTableAccount[])
}

export const getAddressLookupTableAccountsAndInstructions = async (
  quoteResponse: QuoteResponse,
  {
    buyer,
    wrapAndUnwrapSol = true,
    dynamicComputeUnitLimit = true,
    priorityFee,
    dynamicSlippage,
  }: {
    buyer: PublicKey
    latestBlockhash: BlockhashWithExpiryBlockHeight
    payer?: PublicKey
    wrapAndUnwrapSol?: boolean
    dynamicComputeUnitLimit?: boolean
    priorityFee?:
      | number
      | {
          priorityLevelWithMaxLamports: {
            maxLamports: number
            priorityLevel: 'veryHigh'
          }
        }
    dynamicSlippage?: {
      minBps?: number
      maxBps?: number
    }
  }
) => {
  const payload = {
    quoteResponse,
    userPublicKey: buyer.toBase58(),
    wrapAndUnwrapSol,
    dynamicComputeUnitLimit,
    dynamicSlippage,
    prioritizationFeeLamports: priorityFee,
  }

  const host = env.get('JUPITER_HOST')
  const url = new URL(`${host}/swap-instructions`)
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const text = await response.text()

  if (response.status !== 200) {
    throw new Error(text)
  }

  const json = JSON.parse(text) as SwapInstructionResponse

  if (
    !json.computeBudgetInstructions ||
    !json.setupInstructions ||
    !json.swapInstruction ||
    !json.cleanupInstruction ||
    !json.otherInstructions ||
    !json.addressLookupTableAddresses
  ) {
    throw new Error(`Invalid response: ${text}`)
  }

  const addressLookupTableAccounts = await getAddressLookupTableAccounts(
    json.addressLookupTableAddresses
  )

  return {
    addressLookupTableAccounts,
    instructions: [
      ...json.computeBudgetInstructions.map(deserializeInstruction),
      ...json.setupInstructions.map(deserializeInstruction),
      deserializeInstruction(json.swapInstruction),
      deserializeInstruction(json.cleanupInstruction),
      // ...json.otherInstructions.map(deserializeInstruction),
    ],
  }
}

export const getTransactionMessage = async (
  payer: PublicKey,
  { addressLookupTableAccounts, instructions }: AddressLookupTableAccountsAndInstructions,
  latestBlockhash?: BlockhashWithExpiryBlockHeight
) => {
  if (!latestBlockhash) {
    latestBlockhash = await rpc.getLatestBlockhash()
  }

  return new TransactionMessage({
    payerKey: payer,
    recentBlockhash: latestBlockhash.blockhash,
    instructions,
  }).compileToV0Message(addressLookupTableAccounts)
}

export const quote = async (
  inputMint: PublicKey,
  outputMint: PublicKey,
  amount: number,
  options: QuoteOptions = {}
) => {
  const host = env.get('JUPITER_HOST')
  const url = new URL(`${host}/quote`)

  url.searchParams.set('inputMint', inputMint.toBase58())
  url.searchParams.set('outputMint', outputMint.toBase58())
  url.searchParams.set('amount', Math.round(amount).toString())

  if (options.slippageBps) {
    url.searchParams.set('slippageBps', options.slippageBps.toString())
  }

  if (options.swapMode) {
    url.searchParams.set('swapMode', options.swapMode)
  }

  if (options.dexes) {
    url.searchParams.set('dexes', options.dexes.join(','))
  }

  if (options.excludeDexes) {
    url.searchParams.set('excludeDexes', options.excludeDexes.join(','))
  }

  if (options.platformFeeBps) {
    url.searchParams.set('platformFeeBps', options.platformFeeBps.toString())
  }

  if (options.autoSlippage) {
    url.searchParams.set('autoSlippage', 'true')
  }

  if (options.maxAutoSlippageBps) {
    url.searchParams.set('maxAutoSlippageBps', options.maxAutoSlippageBps.toString())
  }

  if (options.autoSlippageCollisionUsdValue) {
    url.searchParams.set(
      'autoSlippageCollisionUsdValue',
      options.autoSlippageCollisionUsdValue.toString()
    )
  }

  const response = await fetch(url.toString())
  const text = await response.text()

  if (text.includes('NO_ROUTES_FOUND')) {
    throw new RouteNotFound(inputMint.toBase58(), outputMint.toBase58())
  }

  const json = JSON.parse(text)

  if (response.status !== 200) {
    throw new Error(json.error)
  }

  return json as QuoteResponse
}

export const swap = async (
  buyer: PublicKey,
  input: PublicKey,
  output: PublicKey,
  amount: number,
  options: SwapOptions = {}
) => {
  const quoteResponse = await quote(input, output, amount, options)
  const latestBlockhash = await rpc.getLatestBlockhash()
  const addressLookupTableAccountsAndInstructions =
    await getAddressLookupTableAccountsAndInstructions(quoteResponse, {
      buyer,
      latestBlockhash,
    })

  const message = await getTransactionMessage(
    options.payer || buyer,
    addressLookupTableAccountsAndInstructions,
    latestBlockhash
  )

  return {
    quoteResponse,
    latestBlockhash,
    transaction: new VersionedTransaction(message),
    inAmount: Number(quoteResponse.inAmount),
    outAmount: Number(quoteResponse.outAmount),
  }
}

export const buy = async (
  buyer: PublicKey,
  token: PublicKey,
  amount: number,
  options: SwapOptions = {}
) => {
  return await swap(buyer, SOL, token, amount, options)
}

export const sell = async (
  seller: PublicKey,
  token: PublicKey,
  amount: number,
  options: SwapOptions = {}
) => {
  return await swap(seller, token, SOL, amount, options)
}

export const getTokenPriceInSol = async (output: PublicKey) => {
  const prices = await getTokenPrices([SOL], output)

  return prices[SOL.toBase58()]
}

export const getTokenPrices = async (inputMints: PublicKey[], outputMint: PublicKey) => {
  const exists: Record<string, number> = {}
  const host = env.get('JUPITER_HOST')
  const url = new URL(`${host}/price`)
  const inputMint = inputMints.map((mint) => mint.toBase58())

  url.searchParams.set('ids', inputMint.join(','))
  url.searchParams.set('vsToken', outputMint.toBase58())

  const response = await fetch(url).then(
    (r) =>
      r.json() as Promise<{
        data: Record<
          string,
          {
            id: string
            price: number
          }
        >
      }>
  )

  const values = Object.values(response.data)

  for (const { id, price } of values) {
    exists[id] = price
  }

  return exists
}

export default {
  quote,
  swap,
  buy,
  sell,
  getTokenPriceInSol,
}
