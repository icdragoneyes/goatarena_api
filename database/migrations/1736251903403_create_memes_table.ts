import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'memes'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').unsigned().notNullable().primary()
      table.string('chain').notNullable()
      table.string('address').notNullable()
      table.string('symbol').notNullable()
      table.string('logo').notNullable()
      table.double('price', 32, 9).defaultTo(0)
      table.double('price_change_percent', 8, 9).defaultTo(0)
      table.bigint('swaps').unsigned().defaultTo(0)
      table.double('volume', 32, 9).defaultTo(0)
      table.double('liquidity', 32, 9).defaultTo(0)
      table.double('market_cap', 32, 9).defaultTo(0)
      table.integer('hot_level').unsigned().defaultTo(0)
      table.bigint('pool_creation_timestamp').unsigned().defaultTo(0)
      table.bigint('holder_count').unsigned().defaultTo(0)
      table.string('twitter_username').nullable().defaultTo(null)
      table.string('website').nullable().defaultTo(null)
      table.string('telegram').nullable().defaultTo(null)
      table.bigint('open_timestamp').unsigned().defaultTo(0)
      table.double('price_change_percent_1m', 8, 9).defaultTo(0)
      table.double('price_change_percent_5m', 8, 9).defaultTo(0)
      table.double('price_change_percent_1h', 8, 9).defaultTo(0)
      table.bigint('buys').unsigned().defaultTo(0)
      table.bigint('sells').unsigned().defaultTo(0)
      table.double('initial_liquidity', 32, 9).defaultTo(0)
      table.boolean('is_show_alert').defaultTo(false)
      table.double('top_10_holder_rate', 8, 9).defaultTo(0)
      table.string('burn_ratio')
      table.string('burn_status').notNullable()
      table.string('launchpad').nullable().defaultTo(null)
      table.integer('dexscr_ad').unsigned().defaultTo(0)
      table.integer('dexscr_update_link').unsigned().defaultTo(0)
      table.integer('cto_flag').unsigned().defaultTo(0)
      table.integer('twitter_change_flag').unsigned().defaultTo(0)
      table.string('creator_token_status').nullable().defaultTo(null)
      table.boolean('creator_close').defaultTo(false)
      table.integer('launchpad_status').unsigned().defaultTo(0)
      table.double('rat_trader_amount_rate', 8, 9).defaultTo(0)
      table.double('bluechip_owner_percentage', 8, 9).defaultTo(0)
      table.integer('smart_degen_count').unsigned().defaultTo(0)
      table.integer('renowned_count').unsigned().defaultTo(0)
      table.boolean('is_wash_trading').defaultTo(false)
      table.timestamp('created_at')
      table.timestamp('updated_at')

      table.index(['chain', 'address', 'symbol'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
