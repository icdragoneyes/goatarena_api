export class RouteNotFound extends Error {
  constructor(
    public input: string,
    public output: string
  ) {
    super(`Route not found for ${input} -> ${output}`)

    this.name = 'RouteNotFound'
  }
}

export class FailedGetSolanaPriceInUsd extends Error {
  constructor() {
    super('Failed to get Solana price in USD')
  }
}
