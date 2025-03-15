import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'redeemables'

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
      table.string('balance_left').notNullable()
      table.string('token_address').notNullable()
      table.bigint('type').unsigned().defaultTo(0)
      table.boolean('zero_balance_left')
      table.timestamp('created_at')
      table.timestamp('updated_at')

      table.index([
        'game_id',
        'solana_wallet_address',
        'token_address',
       
      ])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}