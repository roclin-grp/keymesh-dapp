import Web3 from 'web3'
import { Utils } from 'web3/types'

// FIXME: Make a PR to web3.js to add utils as static property
export const sha3 = (Web3 as typeof Web3 & { utils: Utils }).utils.sha3
