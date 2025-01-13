// import type { HttpContext } from '@adonisjs/core/http'

import { PublicKey } from '@solana/web3.js'
import jupiter from '../chain/solana/jupiter.js'
import price from '../chain/solana/price.js'

export default class GmgnsController {
  async index() {
    const sol = await jupiter.getTokenPriceInSol(
      new PublicKey('4KKwiaYwsVnRtWnN5SdH6YfzVP6f6GRyiSMpXW42DZ7Y')
    )

    const usd = await price.solana(sol)

    return {
      '1sol': await price.solana(),
      'sol': sol.toFixed(9),
      'usd': usd.toFixed(9),
    }
  }
}
