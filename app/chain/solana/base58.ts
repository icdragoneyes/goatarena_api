import base58 from 'bs58'

export default {
  encode: base58.encode,
  decode: base58.decode,
}
