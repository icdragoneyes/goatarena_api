import logger from '@adonisjs/core/services/logger'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

export const host = 'https://gmgn.ai'

export type RawTokenScraped = {
  data: {
    rank: {
      id: number
      chain: 'sol'
      address: string
      symbol: string
      logo: string
      price: number
      price_change_percent: number
      swaps: number
      volume: number
      liquidity: number
      market_cap: number
      hot_level: number
      pool_creation_timestamp: number
      holder_count: number
      twitter_username: string | null
      website: string | null
      telegram: string | null
      open_timestamp: number
      price_change_percent1m: number
      price_change_percent5m: number
      price_change_percent1h: number
      buys: number
      sells: number
      initial_liquidity: number
      is_show_alert: boolean
      top_10_holder_rate: number
      burn_ratio: string
      burn_status: 'burn' | 'none' | 'unknown'
      launchpad: string
      dexscr_ad: number
      dexscr_update_link: number
      cto_flag: number
      twitter_change_flag: number
      creator_token_status:
        | 'creator_close'
        | 'creator_add_liquidity'
        | 'creator_hold'
        | 'creator_sell'
        | 'creator_buy'
        | 'creator_remove_liquidity'
        | null
      creator_close: boolean
      launchpad_status: number
      rat_trader_amount_rate: number
      bluechip_owner_percentage: number
      smart_degen_count: number
      renowned_count: number
      is_wash_trading: boolean
    }[]
  }
}

const scrape = async (chain: 'sol', headless: boolean = true) => {
  puppeteer.default.use(StealthPlugin())

  // const browser = await puppeteer.default.connect({
  //   browserWSEndpoint: 'wss://browser.zenrows.com?apikey=eec8af30cf84502aa148a903d32634530b342e8a',
  // })

  const browser = await puppeteer.default.launch({
    headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  const page = await browser.pages().then(async (pages) => {
    if (pages.length > 0) {
      return pages[0]
    }

    return await browser.newPage()
  })

  const action = new Promise<RawTokenScraped>((resolve, reject) => {
    page
      .waitForResponse(
        (r) => {
          if (r.request().resourceType() === 'xhr') {
            logger.info(r.url(), 'XHR request')

            return r.url().includes(`/defi/quotation/v1/rank/${chain}/swaps/1h`)
          }

          return false
        },
        { timeout: 60_000 }
      )
      .then(async (r) => {
        return (await r.json()) as RawTokenScraped
      })
      .then(resolve)
      .catch(reject)
  })

  try {
    const url = new URL(host)

    url.searchParams.set('chain', chain)

    const opened = await page.goto(url.toString())

    if (opened?.status() !== 200) {
      logger.error({ host: opened?.url(), status: opened?.status() }, 'Failed to open page')

      return []
    }

    logger.info({ host: opened?.url(), status: opened?.status() }, 'Page opened')

    page.screenshot({ path: 'before.png' })

    const response = await action

    return response.data.rank.map((r) => ({
      id: r.id,
      chain: r.chain,
      address: r.address,
      symbol: r.symbol,
      logo: r.logo,
      price: r.price,
      priceChangePercent: r.price_change_percent,
      swaps: r.swaps,
      volume: r.volume,
      liquidity: r.liquidity,
      marketCap: r.market_cap,
      hotLevel: r.hot_level,
      poolCreationTimestamp: r.pool_creation_timestamp,
      holderCount: r.holder_count,
      twitterUsername: r.twitter_username,
      website: r.website,
      telegram: r.telegram,
      openTimestamp: r.open_timestamp,
      priceChangePercent1m: r.price_change_percent1m,
      priceChangePercent5m: r.price_change_percent5m,
      priceChangePercent1h: r.price_change_percent1h,
      buys: r.buys,
      sells: r.sells,
      initialLiquidity: r.initial_liquidity,
      isShowAlert: r.is_show_alert,
      top10HolderRate: r.top_10_holder_rate,
      burnRatio: r.burn_ratio,
      burnStatus: r.burn_status,
      launchpad: r.launchpad,
      dexscrAd: r.dexscr_ad,
      dexscrUpdateLink: r.dexscr_update_link,
      ctoFlag: r.cto_flag,
      twitterChangeFlag: r.twitter_change_flag,
      creatorTokenStatus: r.creator_token_status,
      creatorClose: r.creator_close,
      launchpadStatus: r.launchpad_status,
      ratTraderAmountRate: r.rat_trader_amount_rate,
      bluechipOwnerPercentage: r.bluechip_owner_percentage,
      smartDegenCount: r.smart_degen_count,
      renownedCount: r.renowned_count,
      isWashTrading: r.is_wash_trading,
    }))

    // const data = response.data.rank
    // const randomIndex = Math.floor(Math.random() * data.length)
    // const randomMemecoin = data[randomIndex]

    // return randomMemecoin // Return the randomized memecoin as valid JSON
  } catch (e) {
    logger.error(e, 'Failed to scrape GMGN')

    return []
  } finally {
    await page.screenshot({ path: 'after.png' })

    setTimeout(() => browser.close(), 20_000)
  }
}

export default { scrape }
