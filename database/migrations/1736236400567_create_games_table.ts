import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'games'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').unsigned().notNullable().primary()
      table.string('initiator').notNullable()
      table.string('initiator_signature').notNullable()
      table.timestamp('time_started')
      table.timestamp('time_ended').nullable().defaultTo(null)
      table.string('memecoin_name')
      table.string('memecoin_symbol')
      table.double('memecoin_usd_start', 9, 20).defaultTo(0)
      table.double('memecoin_usd_end', 9, 20).defaultTo(0)
      table.integer('token_decimal').defaultTo(6)
      table.string('contract_address')
      table.double('memecoin_price_start', 9, 32).defaultTo(0)
      table.double('memecoin_price_end', 9, 32).defaultTo(0)
      table.integer('over_under_price_line').defaultTo(0)
      table.integer('total_pot').unsigned().defaultTo(0)
      table.integer('over_pot').unsigned().defaultTo(0)
      table.integer('under_pot').unsigned().defaultTo(0)
      table.bigint('over_token_minted').unsigned().defaultTo(0)
      table.bigint('under_token_minted').unsigned().defaultTo(0)
      table.bigint('over_token_burnt').unsigned().defaultTo(0)
      table.bigint('under_token_burnt').unsigned().defaultTo(0)
      table.bigint('over_price').unsigned().defaultTo(0)
      table.bigint('under_price').unsigned().defaultTo(0)
      table.bigint('claimable_winning_pot_in_sol').defaultTo(0)
      table.string('over_token_address')
      table.string('under_token_address')
      table.string('over_pot_address')
      table.string('under_pot_address')
      table.bigint('buy_fee').unsigned().defaultTo(0)
      table.bigint('sell_fee').unsigned().defaultTo(0)
      table.timestamp('created_at')
      table.timestamp('updated_at')

      table.index([
        'memecoin_symbol',
        'time_started',
        'time_ended',
        'contract_address',
        'over_token_address',
        'under_token_address',
        'over_pot_address',
        'under_pot_address',
      ])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
