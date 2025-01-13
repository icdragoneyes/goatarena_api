import {
  ComputeBudgetProgram,
  Keypair,
  ParsedAccountData,
  ParsedInstruction,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js'
import { createMint, mintTo } from './spl.js'
import rpc, { sendRawTransaction } from './rpc.js'
import {
  createAssociatedTokenAccountInstruction,
  createInitializeMint2Instruction,
  getAssociatedTokenAddress,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptAccount,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { getMasterWallet } from './wallet.js'
import { Metaplex } from '@metaplex-foundation/js'
import { ENV, TokenListProvider } from '@solana/spl-token-registry'
import jupiter from './jupiter.js'
import price from './price.js'
import { FailedGetSolanaPriceInUsd } from './errors.js'
import logger from '@adonisjs/core/services/logger'
import { InvalidContractAddress } from '#services/errors'

export const createToken = async () => {
  const payer = getMasterWallet()

  return await createMint({
    payer,
    mintAuthority: payer.publicKey,
    freezeAuthority: payer.publicKey,
    decimals: 9,
  })
}

export const createOverUnderToken = async (
  overKeypair: Keypair,
  underKeypair: Keypair,
  decimals = 9
) => {
  const overMintKeypair = Keypair.generate()
  const underMintKeypair = Keypair.generate()
  const overAssociatedToken = getAssociatedTokenAddressSync(
    overMintKeypair.publicKey,
    overKeypair.publicKey
  )
  const underAssociatedToken = getAssociatedTokenAddressSync(
    underMintKeypair.publicKey,
    underKeypair.publicKey
  )
  const payer = getMasterWallet()
  const minimum = await getMinimumBalanceForRentExemptAccount(rpc)

  const instructions = [
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 50_000,
    }),
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: overKeypair.publicKey,
      lamports: minimum,
    }),
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: underKeypair.publicKey,
      lamports: minimum,
    }),
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: overMintKeypair.publicKey,
      space: MINT_SIZE,
      lamports: minimum,
      programId: TOKEN_PROGRAM_ID,
    }),
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: underMintKeypair.publicKey,
      space: MINT_SIZE,
      lamports: minimum,
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMint2Instruction(
      overMintKeypair.publicKey,
      decimals,
      payer.publicKey,
      payer.publicKey
    ),
    createInitializeMint2Instruction(
      underMintKeypair.publicKey,
      decimals,
      payer.publicKey,
      payer.publicKey
    ),
    createAssociatedTokenAccountInstruction(
      payer.publicKey,
      overAssociatedToken,
      overKeypair.publicKey,
      overMintKeypair.publicKey
    ),
    createAssociatedTokenAccountInstruction(
      payer.publicKey,
      underAssociatedToken,
      underKeypair.publicKey,
      underMintKeypair.publicKey
    ),
  ]

  const latestBlockhash = await rpc.getLatestBlockhash()
  const message = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: latestBlockhash.blockhash,
    instructions,
  }).compileToV0Message()

  const transaction = new VersionedTransaction(message)

  transaction.sign([payer, overMintKeypair, underMintKeypair])

  rpc
    .simulateTransaction(transaction)
    .then((simulated) => logger.info(simulated, 'Simulate createOverUnderToken'))
    .catch((simulated) => logger.error(simulated, 'Simulate createOverUnderToken'))

  const signature = await sendRawTransaction(transaction.serialize())

  logger.info({ signature }, 'createOverUnderToken')

  await rpc.confirmTransaction(
    {
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    },
    'confirmed'
  )

  return {
    overMint: overMintKeypair,
    underMint: underMintKeypair,
    signature,
  }
}

export const mintToken = async (to: PublicKey, mint: PublicKey, amount: number) => {
  const payer = getMasterWallet()

  return await mintTo({
    payer,
    mint,
    to,
    authority: payer.publicKey,
    amount,
  })
}

export const validateTransferTransaction = async ({
  sender,
  target,
  amount,
  signature,
}: {
  sender: PublicKey
  target: PublicKey
  amount: number
  signature: string
}) => {
  const lamports = amount

  const parsed = await rpc.getParsedTransaction(signature, {
    maxSupportedTransactionVersion: 0,
  })

  if (!parsed) {
    return false
  }

  const instructions = parsed.transaction.message.instructions as ParsedInstruction[]

  for (const instruction of instructions) {
    if (instruction.program === 'system') {
      const source = new PublicKey(instruction.parsed.info.source)
      const destination = new PublicKey(instruction.parsed.info.destination)
      const amountTransferred = Number(instruction.parsed.info.lamports)

      if (source.equals(sender) && destination.equals(target) && amountTransferred >= lamports) {
        return true
      }
    }
  }

  return false
}

export const validateBurnTransaction = async ({
  sender,
  amount,
  signature,
  mint,
}: {
  sender: PublicKey
  amount: number
  signature: string
  mint: PublicKey
}) => {
  const associatedTokenAddress = await getAssociatedTokenAddress(mint, sender)
  const parsed = await rpc.getParsedTransaction(signature, {
    maxSupportedTransactionVersion: 0,
  })

  if (!parsed) {
    return false
  }

  // Extract transaction instructions
  const instructions = parsed.transaction.message.instructions as ParsedInstruction[]

  // Validate each instruction
  for (const instruction of instructions) {
    // Check if the instruction is from the SPL Token Program
    if (instruction.programId.equals(TOKEN_PROGRAM_ID)) {
      const parsedInfo = instruction.parsed?.info

      if (!parsedInfo) continue

      const sourceTokenAccount = new PublicKey(parsedInfo.source)
      const destinationTokenAccount = new PublicKey(parsedInfo.destination)
      const mintAddress = new PublicKey(parsedInfo.mint)
      const amountTransferred = Number(parsedInfo.tokenAmount?.amount || 0)

      // Fetch the mint address of the source token account
      const senderTokenAccount = await rpc.getParsedAccountInfo(sourceTokenAccount)
      const senderParsedData = senderTokenAccount.value?.data as ParsedAccountData | null
      const senderMintAddress = new PublicKey(senderParsedData?.parsed?.info?.mint)

      if (
        sourceTokenAccount &&
        destinationTokenAccount &&
        mintAddress &&
        senderMintAddress &&
        associatedTokenAddress.equals(sourceTokenAccount) &&
        mint.equals(senderMintAddress) &&
        Number(amountTransferred) === Number(amount)
      ) {
        return true // Transaction matches the criteria
      }
    }
  }

  return false // No matching instruction found
}

export const getTokenMetadata = async (mint: PublicKey) => {
  try {
    const metaplex = Metaplex.make(rpc)

    let name
    let symbol
    let logo

    const metadataAccount = metaplex.nfts().pdas().metadata({ mint })

    const metadataAccountInfo = await rpc.getAccountInfo(metadataAccount)
    const tokenAccountInfo = await rpc.getParsedAccountInfo(mint)
    var decimals = 0

    if (!tokenAccountInfo || !tokenAccountInfo.value) {
      throw new Error('Failed to fetch token account info.')
    }

    // Extract decimals from the token mint account data
    const data = tokenAccountInfo.value.data as ParsedAccountData
    decimals = data.parsed.info.decimals

    if (metadataAccountInfo) {
      const token = await metaplex.nfts().findByMint({ mintAddress: mint })
      name = token.name
      symbol = token.symbol
      logo = token.json?.image
    } else {
      const provider = await new TokenListProvider().resolve()
      const tokenList = provider.filterByChainId(ENV.MainnetBeta).getList()
      const tokenMap = tokenList.reduce((map, item) => {
        map.set(item.address, item)

        return map
      }, new Map())

      const token = tokenMap.get(mint.toBase58())

      name = token?.name
      symbol = token?.symbol
      logo = token?.logoURI
    }

    return {
      name,
      symbol,
      logo,
      decimals,
    }
  } catch (e) {
    throw new InvalidContractAddress(mint.toBase58())
  }
}

export const getTokenPrice = async (mint: PublicKey) => {
  const sol = await jupiter.getTokenPriceInSol(mint)
  let usd = await price.solana()

  if (usd === 0) {
    throw new FailedGetSolanaPriceInUsd()
  }

  usd = await price.solana(sol)

  return {
    sol: Number(sol.toFixed(9)),
    usd: Number(usd.toFixed(9)),
  }
}

export const getTokenAccountOwner = async () => {}
