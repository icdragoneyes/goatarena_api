import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class BuyTransaction extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare gameId: number

  @column()
  declare solanaWalletAddress: string

  @column()
  declare solanaTxSignature: string

  @column()
  declare fees: number

  @column()
  declare side: string

  @column()
  declare tokenPrice: number

  @column()
  declare buyTokenAmount: number

  @column()
  declare totalInSolana: number

  @column()
  declare tokensReceived: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
