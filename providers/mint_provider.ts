import Game from '#models/game'
import env from '#start/env'
import type { ApplicationService } from '@adonisjs/core/types'
import { Finality, PublicKey } from '@solana/web3.js'
import rpc from '../app/chain/solana/rpc.js'
import BuyTransaction from '#models/buy_transaction'
import pot from '#services/pot'
import {
  getParsedTransactionsFromAccount,
  getSolTransferInfoFromParsedTransaction,
} from '../app/chain/solana/helpers.js'
import logger from '@adonisjs/core/services/logger'
import { OverUnderGameAccountChangeListeners, Side } from '../app/types.js'

export default class MintProvider {
  protected listeners: OverUnderGameAccountChangeListeners = {}
  protected interval: ReturnType<typeof setInterval> | null = null

  constructor(protected app: ApplicationService) {}

  /**
   * Register bindings to the container
   */
  register() {}

  /**
   * The container bindings have booted
   */
  async boot() {}

  /**
   * The application has been booted
   */
  async start() {}

  /**
   * The process has been started
   */
  async ready() {
    if (env.get('ROLE') === 'api') {
      return
    }

    this.interval = setInterval(async () => {
      const listened = Object.keys(this.listeners)
      const games = await Game.query().whereNull('timeEnded').whereNotIn('id', listened)
      const commitment: Finality = 'confirmed'

      for (const game of games) {
        const over = game.overPotKeypair().publicKey
        const under = game.underPotKeypair().publicKey
        const createListenerFor = (address: PublicKey, side: Side) => {
          logger.info(
            {
              gameId: game.id,
              address: address.toBase58(),
              side,
            },
            '[listener] register minter'
          )

          return rpc.onAccountChange(
            address,
            async () => {
              logger.info(
                {
                  gameId: game.id,
                  address: address.toBase58(),
                  side,
                },
                '[listener] account changed'
              )

              const latest = await BuyTransaction.query()
                .where('gameId', game.id)
                .where('side', side)
                .orderBy('createdAt', 'desc')
                .first()

              const transactions = await getParsedTransactionsFromAccount(address, {
                until: latest?.solanaTxSignature,
                commitment,
                reverse: true,
              })

              for (const [signature, { transaction }] of Object.entries(transactions)) {
                const data = getSolTransferInfoFromParsedTransaction(transaction)

                for (const { source, destination, lamports } of data) {
                  if (destination.equals(address)) {
                    logger.info(
                      {
                        gameId: game.id,
                        source: source.toBase58(),
                        destination: destination.toBase58(),
                        lamports,
                        side,
                      },
                      '[listener] received'
                    )

                    pot
                      .buy({
                        owner: source,
                        side,
                        signature,
                        lamports,
                      })
                      .catch((error) => logger.error(error, '[listener]'))
                  }
                }
              }
            },
            { commitment }
          )
        }

        if (this.listeners[game.id]) {
          rpc.removeAccountChangeListener(this.listeners[game.id].over)
          rpc.removeAccountChangeListener(this.listeners[game.id].under)
        }

        this.listeners[game.id] = {
          over: createListenerFor(over, 'over'),
          under: createListenerFor(under, 'under'),
        }
      }
    }, 1000)
  }

  /**
   * Preparing to shutdown the app
   */
  async shutdown() {
    if (this.interval) {
      clearInterval(this.interval)
    }

    for (const { over, under } of Object.values(this.listeners)) {
      rpc.removeAccountChangeListener(over)
      rpc.removeAccountChangeListener(under)
    }
  }
}
