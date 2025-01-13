import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'sell_transactions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').unsigned().notNullable().primary()
      table
        .bigint('game_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('games')
        .onDelete('CASCADE')
      table.string('solana_wallet_address').notNullable()
      table.string('solana_tx_signature').notNullable()
      table.bigint('fees').unsigned().defaultTo(0)
      table.string('side').notNullable()
      table.bigint('token_price').unsigned().defaultTo(0)
      table.bigint('sell_token_amount').unsigned().defaultTo(0)
      table.bigint('sol_received').unsigned().defaultTo(0)
      table.bigint('progressive_fees').unsigned().defaultTo(0)
      table.string('burn_tx_signature').notNullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')

      table.index([
        'game_id',
        'solana_wallet_address',
        'solana_tx_signature',
        'side',
        'burn_tx_signature',
      ])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
