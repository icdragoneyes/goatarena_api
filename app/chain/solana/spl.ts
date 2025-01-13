import * as spl from '@solana/spl-token'
import {
  Commitment,
  ComputeBudgetProgram,
  ConfirmOptions,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Signer,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js'
import rpc, { sendRawTransaction } from './rpc.js'
import logger from '@adonisjs/core/services/logger'

const commitment: Commitment = 'confirmed'

export const createMint = async ({
  payer,
  mintAuthority,
  freezeAuthority,
  decimals,
  keypair = Keypair.generate(),
  confirmOption,
  programId = spl.TOKEN_PROGRAM_ID,
}: {
  payer: Signer
  mintAuthority: PublicKey
  freezeAuthority: PublicKey | null
  decimals: number
  keypair?: Keypair
  confirmOption?: ConfirmOptions
  programId?: PublicKey
}) => {
  const lamports = await spl.getMinimumBalanceForRentExemptAccount(rpc)
  const instructions = [
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 10_000,
    }),
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: keypair.publicKey,
      space: spl.MINT_SIZE,
      lamports,
      programId,
    }),
    spl.createInitializeMint2Instruction(
      keypair.publicKey,
      decimals,
      mintAuthority,
      freezeAuthority,
      programId
    ),
  ]

  const transaction = new Transaction().add(...instructions)

  await sendAndConfirmTransaction(rpc, transaction, [payer, keypair], confirmOption)

  return keypair.publicKey
}

export const getMint = async (mint: PublicKey, programId?: PublicKey) => {
  return await spl.getMint(rpc, mint, commitment, programId)
}

export const getOrCreateAssociatedTokenAccount = async ({
  payer,
  mint,
  owner,
  allowOwnerOffCurve = false,
  confirmOptions,
  programId = spl.TOKEN_PROGRAM_ID,
  associatedTokenProgramId = spl.ASSOCIATED_TOKEN_PROGRAM_ID,
}: {
  payer: Signer
  mint: PublicKey
  owner: PublicKey
  allowOwnerOffCurve?: boolean
  confirmOptions?: ConfirmOptions
  programId?: PublicKey
  associatedTokenProgramId?: PublicKey
}) => {
  const associatedToken = spl.getAssociatedTokenAddressSync(
    mint,
    owner,
    allowOwnerOffCurve,
    programId,
    associatedTokenProgramId
  )

  // This is the optimal logic, considering TX fee, client-side computation, RPC roundtrips and guaranteed idempotent.
  // Sadly we can't do this atomically.
  let account: spl.Account
  try {
    account = await spl.getAccount(rpc, associatedToken, commitment, programId)
  } catch (error: unknown) {
    // TokenAccountNotFoundError can be possible if the associated address has already received some lamports,
    // becoming a system account. Assuming program derived addressing is safe, this is the only case for the
    // TokenInvalidAccountOwnerError in this code path.
    if (
      error instanceof spl.TokenAccountNotFoundError ||
      error instanceof spl.TokenInvalidAccountOwnerError
    ) {
      // As this isn't atomic, it's possible others can create associated accounts meanwhile.
      try {
        const transaction = new Transaction().add(
          ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: 50_000,
          }),
          spl.createAssociatedTokenAccountInstruction(
            payer.publicKey,
            associatedToken,
            owner,
            mint,
            programId,
            associatedTokenProgramId
          )
        )

        await sendAndConfirmTransaction(
          rpc.getRpcForTransaction(),
          transaction,
          [payer],
          confirmOptions
        )
      } catch (e: unknown) {
        // Ignore all errors; for now there is no API-compatible way to selectively ignore the expected
        // instruction error if the associated account exists already.
      }

      // Now this should always succeed
      account = await spl.getAccount(rpc, associatedToken, commitment, programId)
    } else {
      throw error
    }
  }

  if (!account.mint.equals(mint)) throw new spl.TokenInvalidMintError()
  if (!account.owner.equals(owner)) throw new spl.TokenInvalidOwnerError()

  return account
}

export const createAssociatedTokenAccountInstruction = async ({
  payer,
  mint,
  owner,
}: {
  payer: Keypair
  mint: PublicKey
  owner: PublicKey
}) => {
  const associatedToken = spl.getAssociatedTokenAddressSync(mint, owner)
  try {
    await spl.getAccount(rpc, associatedToken)

    return null
  } catch (e) {
    if (
      e instanceof spl.TokenAccountNotFoundError ||
      e instanceof spl.TokenInvalidAccountOwnerError
    ) {
      return spl.createAssociatedTokenAccountInstruction(
        payer.publicKey,
        associatedToken,
        owner,
        mint
      )
    }
  }
}

export function getSigners(
  signerOrMultisig: Signer | PublicKey,
  multiSigners: Signer[]
): [PublicKey, Signer[]] {
  return signerOrMultisig instanceof PublicKey
    ? [signerOrMultisig, multiSigners]
    : [signerOrMultisig.publicKey, [signerOrMultisig]]
}

export const mintTo = async ({
  payer,
  mint,
  to,
  authority,
  amount,
  multiSigners = [],
}: {
  payer: Keypair
  mint: PublicKey
  to: PublicKey
  authority: Signer | PublicKey
  amount: number | bigint
  multiSigners?: Signer[]
  programId?: PublicKey
}) => {
  const destination = await spl.getAssociatedTokenAddress(mint, to)
  const [authorityPublicKey, signers] = getSigners(authority, multiSigners)

  const instructions = [
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 100_000,
    }),
  ]

  const createAccountInstruction = await createAssociatedTokenAccountInstruction({
    payer,
    mint,
    owner: to,
  })

  if (createAccountInstruction) {
    instructions.push(createAccountInstruction)
  }

  instructions.push(
    spl.createMintToInstruction(mint, destination, authorityPublicKey, amount, multiSigners)
  )

  const latestBlockhash = await rpc.getLatestBlockhash()
  const message = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: latestBlockhash.blockhash,
    instructions,
  }).compileToV0Message()

  const transaction = new VersionedTransaction(message)

  transaction.sign([payer, ...signers])

  const signature = await sendRawTransaction(transaction.serialize())

  logger.info(
    {
      payer: payer.publicKey.toBase58(),
      destination: destination.toBase58(),
      authority: authorityPublicKey.toBase58(),
      mint: mint.toBase58(),
      signature,
    },
    'Minted'
  )

  await rpc.confirmTransaction(
    {
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    },
    'confirmed'
  )

  return signature
}
