import type { HttpContext } from '@adonisjs/core/http'

import Game from '#models/game'
import pot from '#services/pot'
import logger from '@adonisjs/core/services/logger'
import validation from '#validators/game'
import { PublicKey } from '@solana/web3.js'
import {
  GameIsNotEnded,
  InvalidContractAddress,
  InvalidTransaction,
  NoActiveGame,
  NoClaimableSolInGame,
  TransactionSignatureAlreadyExists,
  TransactionSignatureNotExists,
  ZeroGameTokenSupply,
} from '#services/errors'
import {
  getTransferSolFromSignature,
  getTransferTokenFromSignature,
} from '../chain/solana/helpers.js'
import { Side } from '../types.js'
import { RouteNotFound } from '../chain/solana/errors.js'

export default class GamesController {
  public async fighting({ request }: HttpContext) {
    const payload = await request.validateUsing(validation.paginate)
    const games = await Game.query()
      .whereNull('time_ended')
      .orderBy('createdAt', 'desc')
      .paginate(payload.page || 1, payload.limit || 10)

    return games
  }

  // public async startWithRandomChoice({ response }: HttpContext) {
  //   try {
  //     return response.created(await pot.startWithRandomChoice())
  //   } catch (e) {
  //     logger.error(e, 'Failed to start game')

  //     return response.internalServerError({
  //       error: `${e}`,
  //     })
  //   }
  // }

  public async startWithCustomContract({ request, response }: HttpContext) {
    logger.info(request.body(), '[payload] /v1/game/start')
    const { contract, signature } = await request.validateUsing(validation.start)

    let exists = await Game.query()
      .whereNull('timeEnded')
      .where('contractAddress', contract)
      .first()

    if (exists) {
      return response.badRequest({
        message: 'Game is on fight',
      })
    }

    exists = await Game.query().where('initiatorSignature', signature).first()

    if (exists) {
      return response.badRequest({
        message: 'Signature has been initiated',
      })
    }

    try {
      return response.created(
        await pot.start({
          contract: new PublicKey(contract),
          signature,
        })
      )
    } catch (e) {
      logger.error(e, '[response] /v1/game/start')
      if (e instanceof InvalidContractAddress || e instanceof RouteNotFound) {
        return response.badRequest({
          message: e.message,
        })
      }

      return response.internalServerError({
        message: JSON.stringify(e),
      })
    }
  }

  public async buy({ request, response }: HttpContext) {
    logger.info(request.body(), '[payload] /v1/game/buy')
    const { signature } = await request.validateUsing(validation.buy)

    try {
      const transfers = await getTransferSolFromSignature(signature)
      const games = await Game.query().whereNotNull('timeEnded')
      const validated = []

      for (const game of games) {
        const overPotKeypair = game.overPotKeypair()
        const underPotKeypair = game.underPotKeypair()

        for (const transfer of transfers) {
          if (
            overPotKeypair.publicKey.equals(transfer.destination) ||
            underPotKeypair.publicKey.equals(transfer.destination)
          ) {
            validated.push({
              owner: transfer.source,
              side: overPotKeypair.publicKey.equals(transfer.destination) ? 'over' : 'under',
              amount: transfer.lamports,
            })
          }
        }
      }

      if (validated.length === 0) {
        return response.badRequest({
          message: `No valid transfer to over or under address`,
        })
      }

      const responses = []

      for (const valid of validated) {
        const bought = await pot.buy({
          owner: valid.owner,
          side: valid.side as Side,
          lamports: valid.amount,
          signature,
        })

        if (bought) {
          responses.push({
            gameId: bought.game.id,
            transactionId: bought.transaction.id,
            signature: bought.signature,
          })
        }
      }

      return response.created(responses)
    } catch (e) {
      logger.error(e, '[response] /v1/game/buy')
      if (
        e instanceof NoActiveGame ||
        e instanceof TransactionSignatureAlreadyExists ||
        e instanceof InvalidTransaction ||
        e instanceof GameIsNotEnded ||
        e instanceof NoClaimableSolInGame ||
        e instanceof ZeroGameTokenSupply ||
        e instanceof InvalidTransaction ||
        e instanceof TransactionSignatureNotExists
      ) {
        return response.badRequest({
          message: `${e}`,
        })
      }

      logger.error(e, 'Failed to buy')

      return response.internalServerError({
        error: `${e}`,
      })
    }
  }

  public async sell({ request, response }: HttpContext) {
    logger.info(request.body(), '[payload] /v1/game/sell')
    const { signature } = await request.validateUsing(validation.sell)

    try {
      const transfers = await getTransferTokenFromSignature(signature)
      const games = await Game.query().whereNotNull('timeEnded')
      const validated = []

      for (const game of games) {
        const overPotKeypair = game.overPotKeypair()
        const underPotKeypair = game.underPotKeypair()

        for (const transfer of transfers) {
          if (
            overPotKeypair.publicKey.equals(transfer.destination) ||
            underPotKeypair.publicKey.equals(transfer.destination)
          ) {
            validated.push({
              owner: transfer.source,
              side: overPotKeypair.publicKey.equals(transfer.destination) ? 'over' : 'under',
              amount: transfer.amount,
            })
          }
        }
      }

      if (validated.length === 0) {
        return response.badRequest({
          message: `No valid transfer to over or under address`,
        })
      }

      const responses = []

      for (const valid of validated) {
        const sold = await pot.sell({
          owner: valid.owner,
          side: valid.side as Side,
          amount: valid.amount,
          signature,
        })

        if (sold) {
          responses.push({
            gameId: sold.game.id,
            transactionId: sold.transaction.id,
            signature: sold.signature,
          })
        }
      }

      return response.created(responses)
    } catch (e) {
      logger.error(e, '[response] /v1/game/sell')

      if (
        e instanceof NoActiveGame ||
        e instanceof TransactionSignatureAlreadyExists ||
        e instanceof InvalidTransaction ||
        e instanceof GameIsNotEnded ||
        e instanceof NoClaimableSolInGame ||
        e instanceof ZeroGameTokenSupply ||
        e instanceof InvalidTransaction ||
        e instanceof TransactionSignatureNotExists
      ) {
        return response.badRequest({
          message: `${e}`,
        })
      }

      return response.internalServerError({
        error: `${e}`,
      })
    }
  }

  public async redeem({ request, response }: HttpContext) {
    logger.info(request.body(), '[payload] /v1/game/redeem')
    const { signature } = await request.validateUsing(validation.sell)

    try {
      const transfers = await getTransferTokenFromSignature(signature)
      const games = await Game.query().whereNotNull('timeEnded')
      const validated = []

      for (const game of games) {
        const overPotKeypair = game.overPotKeypair()
        const underPotKeypair = game.underPotKeypair()

        for (const transfer of transfers) {
          if (
            overPotKeypair.publicKey.equals(transfer.destination) ||
            underPotKeypair.publicKey.equals(transfer.destination)
          ) {
            validated.push({
              game,
              owner: transfer.source,
              side: overPotKeypair.publicKey.equals(transfer.destination) ? 'over' : 'under',
              amount: transfer.amount,
            })
          }
        }
      }

      if (validated.length === 0) {
        return response.badRequest({
          message: `No valid transfer to over or under address`,
        })
      }

      const responses = []

      for (const valid of validated) {
        const sold = await pot.redeem({
          id: valid.game.id,
          owner: valid.owner,
          amount: valid.amount,
          signature,
        })

        if (sold) {
          responses.push({
            gameId: sold.game.id,
            transactionId: sold.transaction.id,
            signature: sold.signature,
          })
        }
      }

      return response.created(responses)
    } catch (e) {
      logger.error(e, '[response] /v1/game/redeem')

      if (
        e instanceof NoActiveGame ||
        e instanceof TransactionSignatureAlreadyExists ||
        e instanceof InvalidTransaction ||
        e instanceof GameIsNotEnded ||
        e instanceof NoClaimableSolInGame ||
        e instanceof ZeroGameTokenSupply ||
        e instanceof InvalidTransaction ||
        e instanceof TransactionSignatureNotExists
      ) {
        return response.badRequest({
          message: `${e}`,
        })
      }

      return response.internalServerError({
        error: `${e}`,
      })
    }
  }
}
