const endpoint = 'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'

type Response = {
  solana: {
    usd: number
  }
}

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
  const response = await fetch(endpoint).then((r) => r.json() as Promise<Response>)

  if (response?.solana?.usd) {
    queue.latest = response.solana.usd
  }

  return queue.latest
}

export default { solana }
