import type { ApplicationService } from '@adonisjs/core/types'
import { OverUnderGameAccountChangeListeners, Side } from '../app/types.js'
import rpc from '../app/chain/solana/rpc.js'
import Game from '#models/game'
import { Finality, PublicKey } from '@solana/web3.js'
import { getAssociatedTokenAddress } from '@solana/spl-token'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import ClaimTransaction from '#models/claim_transaction'
import {
  getParsedTransactionsFromAccount,
  getTokenTransferInfoFromParsedTransaction,
} from '../app/chain/solana/helpers.js'
import pot from '#services/pot'

export default class RedeemProvider {
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
      const games = await Game.query()
        .whereNotIn('id', listened)
        .whereNotNull('timeEnded')
        .where('claimableWinningPotInSol', '>', 0)
      const commitment: Finality = 'confirmed'

      for (const game of games) {
        const overMint = game.overTokenKeypair()
        const overPotKeypair = game.overPotKeypair()
        const overAssociatedTokenAccount = await getAssociatedTokenAddress(
          overMint.publicKey,
          overPotKeypair.publicKey
        )
        const underMint = game.underTokenKeypair()
        const underPotKeypair = game.underPotKeypair()
        const underAssociatedTokenAccount = await getAssociatedTokenAddress(
          underMint.publicKey,
          underPotKeypair.publicKey
        )
        const createListenerFor = (
          address: PublicKey,
          associatedTokenAccount: PublicKey,
          side: Side
        ) => {
          logger.info(
            {
              gameId: game.id,
              address: address.toBase58(),
              ata: associatedTokenAccount.toBase58(),
              side,
            },
            '[listener] register receiver'
          )

          return rpc.onAccountChange(
            associatedTokenAccount,
            async () => {
              logger.info(
                {
                  gameId: game.id,
                  address: associatedTokenAccount.toBase58(),
                  side,
                },
                '[listener] account changed'
              )

              const latest = await ClaimTransaction.query()
                .where('gameId', game.id)
                .where('side', side)
                .orderBy('createdAt', 'desc')
                .first()

              const transactions = await getParsedTransactionsFromAccount(associatedTokenAccount, {
                until: latest?.solanaTxSignature,
                commitment,
                reverse: true,
              })

              for (const [signature, { transaction }] of Object.entries(transactions)) {
                const data = await getTokenTransferInfoFromParsedTransaction(transaction)

                for (const { owner, source, destination, amount } of data) {
                  if (destination.equals(associatedTokenAccount)) {
                    logger.info(
                      {
                        gameId: game.id,
                        owner: owner.toBase58(),
                        source: source.toBase58(),
                        destination: destination.toBase58(),
                        address: address.toBase58(),
                        amount,
                        side,
                      },
                      `[listener] received`
                    )

                    pot
                      .redeem({
                        id: game.id,
                        owner,
                        signature,
                        amount,
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
          over: createListenerFor(overPotKeypair.publicKey, overAssociatedTokenAccount, 'over'),
          under: createListenerFor(underPotKeypair.publicKey, underAssociatedTokenAccount, 'under'),
        }
      }
    }, 1000)
  }

  /**
   * Preparing to shutdown the app
   */
  async shutdown() {
    if (this.interval !== null) {
      clearInterval(this.interval)
    }

    for (const { over, under } of Object.values(this.listeners)) {
      rpc.removeAccountChangeListener(over)
      rpc.removeAccountChangeListener(under)
    }
  }
}
