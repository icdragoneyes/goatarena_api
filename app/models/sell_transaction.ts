import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class SellTransaction extends BaseModel {
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
  declare sellTokenAmount: number

  @column()
  declare solReceived: number

  @column()
  declare progressiveFees: number

  @column()
  declare burnTxSignature: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
