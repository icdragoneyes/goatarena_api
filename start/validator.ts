import { PublicKey } from '@solana/web3.js'
import vine, { VineString } from '@vinejs/vine'
import base58 from 'bs58'
import { getMint } from '@solana/spl-token'
import { sleep } from '../app/utils.js'
import { getMainRpc } from '../app/chain/solana/rpc.js'

declare module '@vinejs/vine' {
  interface VineString {
    publicKey(): this
    transactionExist(): this
    tokenProgram(): this
  }
}

const tokenProgram = vine.createRule(async (value: unknown, _, field) => {
  if (typeof value !== 'string') {
    field.report('The {{ field }} must be a string', 'tokenProgram', field)

    return
  }

  try {
    base58.decode(value)
  } catch (error) {
    field.report('The {{ field }} must be a valid base58 encoded string', 'tokenProgram', field)
  }

  try {
    new PublicKey(value)
  } catch (error) {
    field.report('The {{ field }} must be a valid public key', 'tokenProgram', field)

    return
  }

  const contract = new PublicKey(value)

  try {
    const connection = getMainRpc()

    await getMint(connection, contract)
  } catch (e) {
    field.report(`${e}`, 'tokenProgram', field)
  }
})

const publicKey = vine.createRule(async (value: unknown, _, field) => {
  if (typeof value !== 'string') {
    field.report('The {{ field }} must be a string', 'publicKey', field)

    return
  }

  try {
    base58.decode(value)
  } catch (error) {
    field.report('The {{ field }} must be a valid base58 encoded string', 'publicKey', field)
  }

  try {
    new PublicKey(value)
  } catch (error) {
    field.report('The {{ field }} must be a valid public key', 'publicKey', field)
  }
})

const transactionExist = vine.createRule(async (value: unknown, _, field) => {
  if (typeof value !== 'string') {
    field.report('The {{ field }} must be a string', 'transactionExist', field)

    return
  }

  try {
    base58.decode(value)
  } catch (error) {
    field.report('The {{ field }} must be a valid base58 encoded string', 'transactionExist', field)
  }

  let retry = 0

  const connection = getMainRpc()

  while (retry < 3) {
    try {
      const transaction = await connection.getParsedTransaction(value, {
        maxSupportedTransactionVersion: 0,
      })

      if (transaction === null) {
        if (retry > 2) {
          field.report('The transaction does not exist', 'transactionExist', field)
        }
      } else {
        break
      }
    } catch (e) {
      if (retry > 2) {
        field.report(`${e}`, 'transactionExist', field)
      }
    } finally {
      retry++

      await sleep(100)
    }
  }
})

VineString.macro('tokenProgram', function (this: VineString) {
  return this.use(tokenProgram())
})

VineString.macro('publicKey', function (this: VineString) {
  return this.use(publicKey())
})

VineString.macro('transactionExist', function (this: VineString) {
  return this.use(transactionExist())
})
