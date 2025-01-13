import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'buy_transactions'

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
      table.bigint('buy_token_amount').unsigned().defaultTo(0)
      table.bigint('total_in_solana').unsigned().defaultTo(0)
      table.bigint('tokens_received').unsigned().defaultTo(0)
      table.timestamp('created_at')
      table.timestamp('updated_at')

      table.index(['game_id', 'solana_wallet_address', 'solana_tx_signature', 'side'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
