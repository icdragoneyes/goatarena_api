import vine from '@vinejs/vine'

const paginate = vine.compile(
  vine.object({
    page: vine.number().positive().nullable().optional(),
    limit: vine.number().positive().nullable().optional(),
  })
)

const start = vine.compile(
  vine.object({
    contract: vine.string().publicKey(),
    signature: vine.string().transactionExist(),
  })
)

const buy = vine.compile(
  vine.object({
    signature: vine.string().transactionExist(),
  })
)

const sell = vine.compile(
  vine.object({
    signature: vine.string().transactionExist(),
  })
)

const redeem = vine.compile(
  vine.object({
    id: vine.number().positive(),
    owner: vine.string().publicKey(),
    amount: vine.number().positive(),
    signature: vine.string().transactionExist(),
  })
)

export default {
  paginate,
  start,
  buy,
  sell,
  redeem,
}
