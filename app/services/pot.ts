import BuyTransaction from '#models/buy_transaction'
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SendTransactionError,
  TransactionExpiredBlockheightExceededError,
} from '@solana/web3.js'
import {
  GameIsNotEnded,
  InvalidSignatureForInitiateGame,
  InvalidTransaction,
  NoActiveGame,
  NoClaimableSolInGame,
  TransactionSignatureAlreadyExists,
  ZeroGameTokenSupply,
} from './errors.js'
import Game from '#models/game'
import {
  createOverUnderToken,
  getTokenMetadata,
  getTokenPrice,
  mintToken,
  transferToWinningPotAndBurnOverUnderToken,
  validateBurnTransaction,
} from '../chain/solana/token.js'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import SellTransaction from '#models/sell_transaction'
import { DateTime } from 'luxon'
import {
  getSourceTransferFromDestination,
  transfer,
  transferToMany,
} from '../chain/solana/helpers.js'
import ClaimTransaction from '#models/claim_transaction'
import gmgn from '../chain/gmgn.js'
import base58 from '../chain/solana/base58.js'
import { getMasterWallet } from '../chain/solana/wallet.js'
import { Side } from '../types.js'
import { sleep } from '../utils.js'
import env from '#start/env'

// export const startWithRandomChoice = async () => {
//   const memes = await gmgn.scrape('sol', false).catch((e) => {
//     logger.error(e, 'Failed to scrape memes')

//     return []
//   })

//   if (!memes.length) {
//     return
//   }

//   const meme = memes[Math.floor(Math.random() * memes.length)]

//   return await start({
//     contract: new PublicKey(meme.address),
//   })
// }

export const start = async ({
  contract,
  signature,
}: {
  contract: PublicKey
  signature: string
}) => {
  const masterWallet = getMasterWallet()
  const initiator = await getSourceTransferFromDestination({
    signature,
    destination: masterWallet.publicKey,
    lamports: Number(env.get('SOLANA_INITIATE_LAMPORTS')),
  })

  if (!initiator) {
    throw new InvalidSignatureForInitiateGame(signature, contract.toBase58())
  }

  const metadata = await getTokenMetadata(contract)

  logger.info({ metadata }, 'Selected meme metadata')

  const price = await getTokenPrice(contract)

  logger.info({ price }, 'Selected meme price')

  const game = new Game()

  game.initiator = initiator.source.toBase58()
  game.contractAddress = contract.toBase58()
  game.memecoinName = metadata.name
  game.memecoinSymbol = metadata.symbol
  game.memecoinUsdStart = game.memecoinUsdEnd = price.usd
  game.memecoinPriceStart = game.memecoinPriceEnd = price.sol
  game.tokenDecimal = metadata.decimals
  game.overPrice = game.underPrice = 0.001e9

  const overPotKeypair = Keypair.generate()
  const underPotKeypair = Keypair.generate()

  game.overPotAddress = base58.encode(overPotKeypair.secretKey)
  game.underPotAddress = base58.encode(underPotKeypair.secretKey)

  logger.info(
    {
      metadata,
    },
    'Creating over & under token'
  )

  const response = await createOverUnderToken(overPotKeypair, underPotKeypair)

  logger.info(
    {
      overMint: response.overMint.publicKey.toBase58(),
      underMint: response.underMint.publicKey.toBase58(),
      signature: response.signature,
    },
    'Created over token'
  )

  game.overTokenAddress = base58.encode(response.overMint.secretKey)
  game.underTokenAddress = base58.encode(response.underMint.secretKey)
  game.timeStarted = DateTime.now()

  logger.info({ game: game.serialize() }, 'Creating game')

  await game.save()

  return {
    signature: response.signature,
    game,
  }
}

const calculate = (lamports: number, price: number, decimals = 9) => {
  const afterFee = lamports * 0.99
  const sol = afterFee / 1e9
  const mul = 10 ** decimals
  const token = price / mul
  const result = (sol / token) * mul

  return Number(result.toFixed(0))
}

const processing = {
  buys: new Set<string>(),
  sells: new Set<string>(),
  redeem: new Set<string>(),
}

export const buy = async ({
  owner,
  side,
  signature,
  lamports,
}: {
  owner: PublicKey
  side: Side
  signature: string
  lamports: number
}): Promise<
  | {
      game: Game
      transaction: BuyTransaction
      signature: string
    }
  | undefined
> => {
  const masterWallet = getMasterWallet()

  if (owner.equals(masterWallet.publicKey)) {
    return
  }

  if (processing.buys.has(signature)) {
    return
  }

  processing.buys.add(signature)

  try {
    return await db.transaction(async () => {
      const exists = await BuyTransaction.query().where('solanaTxSignature', signature).first()

      if (exists) {
        throw new TransactionSignatureAlreadyExists(signature)
      }

      const game = await Game.query().orderBy('createdAt', 'desc').first()

      if (!game) {
        throw new NoActiveGame()
      }

      const excludes = [
        masterWallet.publicKey,
        game.overPotKeypair().publicKey,
        game.overTokenKeypair().publicKey,
        game.underPotKeypair().publicKey,
        game.underTokenKeypair().publicKey,
      ]

      if (excludes.find((e) => e.equals(owner))) {
        return
      }

      const model = new BuyTransaction()

      const pot = {
        keypair: side === 'over' ? game.overPotKeypair() : game.underPotKeypair(),
        price: Number(side === 'over' ? game.overPrice : game.underPrice),
      }

      model.solanaWalletAddress = owner.toBase58()
      model.tokenPrice = pot.price
      model.gameId = game.id
      model.totalInSolana = lamports
      model.solanaTxSignature = signature
      model.side = side

      game.totalPot = Number(game.totalPot) + lamports

      let minted

      if (side === 'over') {
        const calculated = calculate(lamports, game.overPrice)

        game.overPot = Number(game.overPot) + lamports
        game.overTokenMinted = Number(game.overTokenMinted) + calculated

        logger.info({ owner, calculated }, 'Minting over token')
        minted = await mintToken(owner, game.overTokenKeypair().publicKey, calculated)
        logger.info({ signature: minted }, 'Minted over token')
      } else {
        const calculated = calculate(lamports, game.underPrice)

        game.underPot = Number(game.underPot) + lamports
        game.underTokenMinted = Number(game.underTokenMinted) + calculated

        logger.info({ owner, calculated }, 'Minting under token')
        minted = await mintToken(owner, game.underTokenKeypair().publicKey, calculated)
        logger.info({ signature: minted }, 'Minted under token')
      }

      const fee = Number((lamports * 0.01).toFixed(0))
      game.buyFee = Number(game.buyFee) + fee

      const totalFee = Number(game.buyFee) + Number(game.sellFee)

      game.claimableWinningPotInSol = Number(game.totalPot) - totalFee

      model.fees = fee

      logger.info({ owner, side, lamports, signature, buy: model.serialize() }, 'Saving buy')

      await model.save()

      logger.info({ owner, side, lamports, signature, game: game.serialize() }, 'Saving game')
      await game.save()

      return {
        game,
        transaction: model,
        signature: minted,
      }
    })
  } catch (e) {
    processing.buys.delete(signature)

    if (
      e instanceof TransactionExpiredBlockheightExceededError ||
      e instanceof SendTransactionError
    ) {
      await sleep(100)

      return await buy({ owner, side, signature, lamports })
    }

    throw e
  } finally {
    processing.buys.delete(signature)
  }
}

export const sell = async ({
  owner,
  side,
  signature,
  amount,
}: {
  owner: PublicKey
  side: Side
  signature: string
  amount: number
}): Promise<
  | {
      game: Game
      transaction: SellTransaction
      signature: string
    }
  | undefined
> => {
  const masterWallet = getMasterWallet()

  if (masterWallet.publicKey.equals(owner)) {
    return
  }

  if (processing.sells.has(signature)) {
    return
  }

  processing.sells.add(signature)

  try {
    return await db.transaction(async () => {
      const exists = await SellTransaction.query().where('burnTxSignature', signature).first()

      if (exists) {
        throw new TransactionSignatureAlreadyExists(signature)
      }

      const game = await Game.query().whereNull('timeEnded').orderBy('createdAt', 'desc').first()

      if (!game) {
        throw new NoActiveGame()
      }

      const excludes = [
        masterWallet.publicKey,
        game.overPotKeypair().publicKey,
        game.overTokenKeypair().publicKey,
        game.underPotKeypair().publicKey,
        game.underTokenKeypair().publicKey,
      ]

      if (excludes.find((e) => e.equals(owner))) {
        return
      }

      const model = new SellTransaction()

      model.gameId = game.id
      model.solanaWalletAddress = owner.toBase58()
      model.side = side

      const price = side === 'over' ? game.overPrice : game.underPrice

      model.tokenPrice = price

      logger.info({ game: game.serialize() }, 'Selling token game state before')

      const underValue = Number(game.underPrice) * (amount / 1e9)
      const overValue = Number(game.overPrice) * (amount / 1e9)
      const solValue = side === 'over' ? overValue : underValue

      if (side === 'under') {
        game.underTokenBurnt = Number(game.underTokenBurnt) + amount
      } else {
        game.overTokenBurnt = Number(game.overTokenBurnt) + amount
      }

      const fee = Number((solValue * 0.01).toFixed(0))
      const nett = solValue - fee
      const startTime = game.timeStarted || game.createdAt
      const now = DateTime.now()
      // const next1hour = startTime.plus({ hours: 1 })
      const elapsed = now.diff(startTime, 'minutes').minutes
      const progressiveTax = (elapsed / 60) * (99 / 100)
      const lamportsNettMinusTax = Math.floor((1 - progressiveTax) * nett)
      const lamportsRedistribution = Math.floor((2 * progressiveTax * nett) / 3)

      model.sellTokenAmount = amount
      model.solReceived = lamportsNettMinusTax

      game.sellFee = Number(game.sellFee) + fee

      const sourcePotKeypair = side === 'under' ? game.underPotKeypair() : game.overPotKeypair()
      const targetPotKeypair = side === 'under' ? game.overPotKeypair() : game.underPotKeypair()

      if (side === 'under') {
        game.overPot = Number(game.overPot) + Number(lamportsRedistribution)
        game.underPot = Number(game.underPot) - (Number(lamportsRedistribution) + 5000)
      } else {
        game.overPot = Number(game.overPot) - (Number(lamportsRedistribution) + 5000)
        game.underPot = Number(game.underPot) + Number(lamportsRedistribution)
      }

      game.totalPot = Number(game.overPot) + Number(game.underPot)

      const underTokenOutstanding = Number(game.underTokenMinted) - Number(game.underTokenBurnt)
      const overTokenOutstanding = Number(game.overTokenMinted) - Number(game.overTokenBurnt)

      if (underTokenOutstanding > 0) {
        game.underPrice = Math.round(
          (Number(game.underPot) / underTokenOutstanding) * LAMPORTS_PER_SOL
        )
      }

      if (overTokenOutstanding > 0) {
        game.overPrice = Math.round(
          (Number(game.overPot) / overTokenOutstanding) * LAMPORTS_PER_SOL
        )
      }

      logger.info({ game: game.serialize() }, 'Selling token game state after')

      const memo = `goatPotMoving_${game.id}`

      logger.info(
        {
          sourcePot: sourcePotKeypair.publicKey.toBase58(),
          targetPot: targetPotKeypair.publicKey.toBase58(),
          owner: owner.toBase58(),
          lamportsRedistribution,
          lamportsNettMinusTax,
          memo,
        },
        'Transferring sell proceeds'
      )

      const transferred = await transferToMany(
        sourcePotKeypair,
        [
          { address: targetPotKeypair.publicKey, lamports: lamportsRedistribution },
          { address: owner, lamports: lamportsNettMinusTax - 5000 },
        ],
        { memo }
      )

      logger.info(
        {
          sourcePot: sourcePotKeypair.publicKey.toBase58(),
          targetPot: targetPotKeypair.publicKey.toBase58(),
          owner: owner.toBase58(),
          lamportsRedistribution,
          lamportsNettMinusTax,
          memo,
          transferred,
        },
        'Transferred sell proceeds'
      )

      model.burnTxSignature = signature
      model.solanaTxSignature = transferred.signature

      await model.save()
      await game.save()

      return {
        game,
        transaction: model,
        signature: transferred.signature,
      }
    })
  } catch (e) {
    processing.sells.delete(signature)

    if (
      e instanceof TransactionExpiredBlockheightExceededError ||
      e instanceof SendTransactionError
    ) {
      return await sell({ owner, side, signature, amount })
    }

    throw e
  } finally {
    processing.sells.delete(signature)
  }
}

export const redeem = async ({
  id,
  owner,
  amount,
  signature,
}: {
  id: number
  owner: PublicKey
  amount: number
  signature: string
}) => {
  const game = await Game.findByOrFail('id', id)

  if (game.timeEnded === null) {
    throw new GameIsNotEnded(game)
  }

  if (game.claimableWinningPotInSol < 1) {
    throw new NoClaimableSolInGame(game)
  }

  const exists = await ClaimTransaction.query().where('burnTxSignature', signature).first()

  if (exists) {
    throw new TransactionSignatureAlreadyExists(signature)
  }

  const model = new ClaimTransaction()

  model.gameId = game.id
  model.solanaWalletAddress = owner.toBase58()

  const side = game.memecoinPriceEnd < game.memecoinPriceStart ? 'under' : 'over'
  const overTokenSupply = game.overTokenMinted - game.overTokenBurnt
  const underTokenSupply = game.underTokenMinted - game.underTokenBurnt
  const tokenSupply = side === 'over' ? overTokenSupply : underTokenSupply

  if (tokenSupply === 0) {
    throw new ZeroGameTokenSupply(game, side)
  }

  const tokenMintAddress = new PublicKey(
    side === 'over' ? game.overTokenAddress : game.underTokenAddress
  )

  let isValid = false

  try {
    isValid = await validateBurnTransaction({
      sender: owner,
      amount,
      mint: tokenMintAddress,
      signature,
    })
  } catch (e) {
    throw new InvalidTransaction(signature, `${e}`)
  }

  if (!isValid) {
    throw new InvalidTransaction(signature, 'Invalid transaction signature')
  }

  const value = (amount / tokenSupply) * game.claimableWinningPotInSol

  if (side === 'under') {
    game.underTokenBurnt = Number(game.underTokenBurnt) + amount
  } else {
    game.overTokenBurnt = Number(game.overTokenBurnt) + amount
  }

  model.claimTokenAmount = amount
  model.solReceived = value

  const sourcePotKeypair = side === 'over' ? game.overPotKeypair() : game.underPotKeypair()
  // const targetPotKeypair = side === 'over' ? game.underPotKeypair() : game.overPotKeypair()

  game.claimableWinningPotInSol = Number(game.claimableWinningPotInSol) - value

  const claimed = await transfer(sourcePotKeypair, owner, value - 5000, {
    memo: `goatClaim_${game.id}`,
  })

  model.burnTxSignature = signature
  model.solanaTxSignature = claimed.signature
  model.targetSolanaWalletAddress = owner.toBase58()

  await model.save()
  await game.save()
}

export const settle = async (game: Game) => {
  logger.info({ game: game.serialize() }, '[settlement] settling game')

  const elapsed = DateTime.now().diff(game.timeStarted, 'minutes').minutes

  if (elapsed < 60) {
    return
  }

  game.timeEnded = DateTime.now()

  await game.save()

  const buyer = await BuyTransaction.query()
    .where('gameId', game.id)
    .orderBy('createdAt', 'asc')
    .first()

  if (!buyer) {
    logger.info({ gameId: game.id }, `[settlement] game doesn't have buyer skipping`)

    return
  }

  try {
    const masterWallet = getMasterWallet()
    const initialPrice = game.memecoinPriceStart
    const currentPrice = await getTokenPrice(new PublicKey(game.contractAddress))
    const winnerSide = currentPrice.sol > initialPrice ? 'over' : 'under'
    const isOverWinner = winnerSide === 'over'
    const winnerKeypair = isOverWinner ? game.overPotKeypair() : game.underPotKeypair()
    const winnerMint = isOverWinner ? game.overTokenKeypair() : game.underTokenKeypair()
    const looserKeypair = isOverWinner ? game.underPotKeypair() : game.overPotKeypair()
    const looserMint = isOverWinner ? game.underTokenKeypair() : game.overTokenKeypair()
    const memo = `goatSettle_${game.id}`

    logger.info(
      {
        gameId: game.id,
        winner: winnerSide,
        winnerAddress: winnerKeypair.publicKey.toBase58(),
        winnerMint: winnerMint.publicKey.toBase58(),
        memo,
      },
      '[settlement] transfer from looser to winner and burn both token'
    )

    const signature = await transferToWinningPotAndBurnOverUnderToken({
      payer: masterWallet,
      winnerKeypair,
      winnerMint: winnerMint.publicKey,
      looserKeypair,
      looserMint: looserMint.publicKey,
      memo,
    })

    logger.info(
      {
        gameId: game.id,
        winner: winnerSide,
        winnerAddress: winnerKeypair.publicKey.toBase58(),
        winnerMint: winnerMint.publicKey.toBase58(),
        memo,
        signature,
      },
      '[settlement] transferred from looser to winner and burn both token'
    )

    if (isOverWinner) {
      game.overPot = Number(game.overPot) + Number(game.underPot)
      game.underPot = 0
    } else {
      game.underPot = Number(game.underPot) + Number(game.overPot)
      game.overPot = 0
    }

    game.timeEnded = DateTime.now()
    game.memecoinUsdEnd = currentPrice.usd
    game.memecoinPriceEnd = currentPrice.sol

    await game.save()
  } catch (error) {
    logger.error({
      game: game.serialize(),
      error,
    })
  }
}

export default {
  // startWithRandomChoice,
  start,
  buy,
  sell,
  redeem,
  settle,
}
