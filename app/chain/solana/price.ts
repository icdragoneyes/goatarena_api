import jupiter, { SOL, USDC } from './jupiter.js'

const queue = {
  latest: 0,
  interval: null as ReturnType<typeof setInterval> | null,
}

const solana = async (n = 1) => {
  if (queue.interval === null) {
    setInterval(update, 30_000)
  }

  if (queue.latest > 0) {
    return queue.latest * n
  }

  return (await update()) * n
}

const update = async () => {
  const response = await jupiter.getTokenPrices([SOL], USDC)

  queue.latest = response[SOL.toBase58()]

  return queue.latest
}

export default { solana }
