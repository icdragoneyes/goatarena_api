import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Meme extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare chain: string

  @column()
  declare address: string

  @column()
  declare symbol: string

  @column()
  declare logo: string

  @column()
  declare price: number

  @column()
  declare priceChangePercent: number

  @column()
  declare swaps: number

  @column()
  declare volume: number

  @column()
  declare liquidity: number

  @column()
  declare marketCap: number

  @column()
  declare hotLevel: number

  @column()
  declare poolCreationTimestamp: number

  @column()
  declare holderCount: number

  @column()
  declare twitterUsername: string | null

  @column()
  declare website: string | null

  @column()
  declare telegram: string | null

  @column()
  declare openTimestamp: number

  @column({ columnName: 'price_change_percent_1m' })
  declare priceChangePercent1m: number

  @column({ columnName: 'price_change_percent_5m' })
  declare priceChangePercent5m: number

  @column({ columnName: 'price_change_percent_1h' })
  declare priceChangePercent1h: number

  @column()
  declare buys: number

  @column()
  declare sells: number

  @column()
  declare initialLiquidity: number

  @column()
  declare isShowAlert: boolean

  @column({ columnName: 'top_10_holder_rate' })
  declare top10HolderRate: number

  @column()
  declare burnRatio: string

  @column()
  declare burnStatus: string

  @column()
  declare launchpad: string

  @column()
  declare dexscrAd: number

  @column()
  declare dexscrUpdateLink: number

  @column()
  declare ctoFlag: number

  @column()
  declare twitterChangeFlag: number

  @column()
  declare creatorTokenStatus: string | null

  @column()
  declare creatorClose: boolean

  @column()
  declare launchpadStatus: number

  @column()
  declare ratTraderAmountRate: number

  @column()
  declare bluechipOwnerPercentage: number

  @column()
  declare smartDegenCount: number

  @column()
  declare renownedCount: number

  @column()
  declare isWashTrading: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
