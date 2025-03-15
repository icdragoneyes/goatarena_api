import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Redeemable extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare gameId: number

  @column()
  declare solanaWalletAddress: string

  @column()
  declare balanceLeft: string

  @column()
  declare tokenAddress: string

  @column()
  declare type: number

  @column()
  declare zeroBalanceLeft: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}