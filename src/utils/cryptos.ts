import Web3 from 'web3'
import { Utils } from 'web3/types'
import { base58ToHex } from './hex'

const web3Utils = (Web3 as typeof Web3 & { utils: Utils }).utils

// FIXME: Make a PR to web3.js to add utils as static property
export const sha3 = web3Utils.sha3
export const toChecksumAddress = web3Utils.toChecksumAddress
export const isAddress = web3Utils.isAddress

export function base58ToChecksumAddress(encodedAddress: string): string {
  return toChecksumAddress(base58ToHex(encodedAddress))
}
