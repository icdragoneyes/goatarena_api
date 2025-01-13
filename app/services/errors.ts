import Game from '#models/game'
import { Side } from '../types.js'

export class InvalidSignatureForInitiateGame extends Error {
  public name = 'InvalidSignatureForInitiateGame'

  constructor(
    public signature: string,
    public contract: string
  ) {
    const message = `Transaction signature is invalid for initiating ${contract}: ${signature}`

    super(message)
  }
}

export class InvalidContractAddress extends Error {
  public name = 'InvalidContractAddress'

  constructor(public contract: string) {
    const message = `Invalid contract address: ${contract}`

    super(message)
  }
}

export class TransactionSignatureAlreadyExists extends Error {
  public name = 'TransactionSignatureAlreadyExists'

  constructor(public signature: string) {
    super('Transaction signature already exists')
    this.message = `Transaction ${signature || this.signature} already exists`
  }
}

export class TransactionSignatureNotExists extends Error {
  public name = 'TransactionSignatureNotExists'

  constructor(public signature: string) {
    const message = `Transaction signature not exists: ${signature}`

    super(message)
  }
}

export class NoActiveGame extends Error {
  public name = 'NoActiveGame'

  constructor() {
    super('No active game')
    this.message = 'No active game'
  }
}

export class GameIsNotEnded extends Error {
  public name = 'GameIsNotEnded'

  constructor(game: Game) {
    const message = `Game ${game.id} is not ended`

    super(message)
    this.message = message
  }
}

export class ZeroGameTokenSupply extends Error {
  public name = 'ZeroGameTokenSupply'

  constructor(game: Game, side: Side) {
    const message = `Game ${game.id} not has ${side} token supply`

    super(message)
    this.message = message
  }
}

export class NoClaimableSolInGame extends Error {
  constructor(game: Game) {
    const message = `No claimable SOL in game ${game.id}`

    super(message)
    this.message = message
  }
}

export class InvalidTransaction extends Error {
  constructor(
    public signature: string,
    public message: string
  ) {
    super(`Invalid transaction signature ${signature}: ${message}`)
    this.message = `Invalid transaction signature ${signature}: ${message}`
  }
}
