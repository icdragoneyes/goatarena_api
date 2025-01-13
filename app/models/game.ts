import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { Keypair } from '@solana/web3.js'
import base58 from '../chain/solana/base58.js'

export default class Game extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare initiator: string

  @column()
  declare initiatorSignature: string

  @column.dateTime()
  declare timeStarted: DateTime

  @column.dateTime()
  declare timeEnded: DateTime | null

  @column()
  declare memecoinName: string

  @column()
  declare memecoinSymbol: string

  @column()
  declare memecoinUsdStart: number

  @column()
  declare memecoinUsdEnd: number

  @column()
  declare tokenDecimal: number

  @column()
  declare contractAddress: string

  @column()
  declare memecoinPriceStart: number

  @column()
  declare memecoinPriceEnd: number

  @column()
  declare overUnderPriceLine: number

  @column()
  declare totalPot: number

  @column()
  declare overPot: number

  @column()
  declare underPot: number

  @column()
  declare overTokenMinted: number

  @column()
  declare underTokenMinted: number

  @column()
  declare overTokenBurnt: number

  @column()
  declare underTokenBurnt: number

  @column()
  declare overPrice: number

  @column()
  declare underPrice: number

  @column()
  declare claimableWinningPotInSol: number

  @column({
    serialize(value: string) {
      const keypair = Keypair.fromSecretKey(base58.decode(value))

      return keypair.publicKey
    },
  })
  declare overTokenAddress: string

  @column({
    serialize(value: string) {
      const keypair = Keypair.fromSecretKey(base58.decode(value))

      return keypair.publicKey
    },
  })
  declare underTokenAddress: string

  @column({
    serialize(value: string) {
      const keypair = Keypair.fromSecretKey(base58.decode(value))

      return keypair.publicKey
    },
  })
  declare overPotAddress: string

  @column({
    serialize(value: string) {
      const keypair = Keypair.fromSecretKey(base58.decode(value))

      return keypair.publicKey
    },
  })
  declare underPotAddress: string

  @column({ serializeAs: null })
  declare buyFee: number

  @column({ serializeAs: null })
  declare sellFee: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  public overTokenKeypair() {
    return Keypair.fromSecretKey(base58.decode(this.overTokenAddress))
  }

  public underTokenKeypair() {
    return Keypair.fromSecretKey(base58.decode(this.underTokenAddress))
  }

  public overPotKeypair() {
    return Keypair.fromSecretKey(base58.decode(this.overPotAddress))
  }

  public underPotKeypair() {
    return Keypair.fromSecretKey(base58.decode(this.underPotAddress))
  }

  public buyAndSellFee() {
    return Number(this.buyFee) + Number(this.sellFee)
  }
}
