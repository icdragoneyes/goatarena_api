import Game from '#models/game'
import pot from '#services/pot'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import type { ApplicationService } from '@adonisjs/core/types'
import { DateTime } from 'luxon'

export default class SettlementProvider {
  protected settling: Set<Game['id']> = new Set()
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

    if (!env.get('SETTLEMENT')) {
      logger.info('[settlement] disable')

      return
    }

    this.interval = setInterval(async () => {
      const games = await Game.query()
        .whereNull('timeEnded')
        .whereNotIn('id', [...this.settling])

      for (const game of games) {
        const now = DateTime.now()
        const start = game.timeStarted || game.createdAt

        if (
          now.toMillis() > start.toMillis() &&
          Math.abs(start.diff(now, 'minutes').minutes) < 60
        ) {
          continue
        }

        if (this.settling.has(game.id)) {
          continue
        }

        this.settling.add(game.id)

        pot
          .settle(game)
          .catch((error) => logger.error({ error }, '[settlement]'))
          .finally(() => setTimeout(() => this.settling.delete(game.id), 100))
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
  }
}
