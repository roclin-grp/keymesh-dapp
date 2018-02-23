import {
  observable,
  computed,
  action,
  runInAction,
} from 'mobx'

import Web3 from 'web3'

import {
  storeLogger,
} from '../utils/loggers'

async function sleep(ms: number) {
  return new Promise((resolve) => {
    setInterval(() => {
      resolve()
    }, ms)
  })
}

function getMetaMaskProvider(): { isMetaMask: true } | null {
  const win = window as any
  if (!win.web3) {
    return null
  }

  if (win.web3.currentProvider.isMetaMask) {
    return win.web3.currentProvider
  }

  return null
}

export function getMetaMaskWeb3(): Web3 | null {
  const provider = getMetaMaskProvider()
  if (!provider) {
    return null
  }

  return new Web3(provider as any)
}

export class MetaMaskStore {
  // FIXME: would it be better to just collapse
  @observable public connectStatus: METAMASK_CONNECT_STATUS = METAMASK_CONNECT_STATUS.PENDING
  @observable public connectFailCode?: METAMASK_CONNECT_FAIL_CODE

  @observable public currentEthereumNetwork: ETHEREUM_NETWORKS | undefined
  @observable public currentEthereumAccount: string | undefined

  @computed
  public get isPending() {
    return this.connectStatus === METAMASK_CONNECT_STATUS.PENDING
  }

  @computed
  public get isActive() {
    return this.connectStatus === METAMASK_CONNECT_STATUS.ACTIVE
  }

  @computed
  public get isNotAvailable() {
    return this.connectStatus === METAMASK_CONNECT_STATUS.NOT_AVAILABLE
  }

  @computed
  public get hasNoMetaMask() {
    return this.connectFailCode === METAMASK_CONNECT_FAIL_CODE.NO_METAMASK
  }

  @computed
  public get isLocked() {
    return this.connectFailCode === METAMASK_CONNECT_FAIL_CODE.LOCKED
  }

  constructor(private web3: Web3) {
    this.connect()
  }

  public getBlockHash = (blockNumber: number) => {
    return this.web3.eth.getBlock(blockNumber)
      .then((block) => {
        if (typeof block === 'undefined') {
          return '0x0'
        }
        return block.hash
      })
      .catch((err) => {
        storeLogger.error(err)
        return '0x0'
      })
  }

  public getTransactionReceipt = (transactionHash: string) => {
    return this.web3.eth.getTransactionReceipt(transactionHash)
  }

  @action
  private async connect() {
    this.startStatusPoll()
  }

  /**
   * Update MetaMask status at regular intervals
   */
  private async startStatusPoll() {
    while (true) {
      this.updateStatus()
      await sleep(300)
    }
  }

  @action
  private async updateStatus() {
    const {
      networkID,
      account,
    } = await this.getMetamaskInfo()

    if (this.currentEthereumAccount === account && this.currentEthereumNetwork === networkID) {
      // nothing changed
      return
    }

    runInAction(() => {
      this.currentEthereumAccount = undefined
      this.currentEthereumNetwork = undefined

      delete this.connectFailCode

      if (account && networkID) {
        // metamask is available and unlocked
        this.currentEthereumAccount = account
        this.currentEthereumNetwork = networkID
        this.web3.eth.defaultAccount = account
        this.connectStatus = METAMASK_CONNECT_STATUS.ACTIVE
        return
      }

      // FIXME: when does this occur?
      this.connectStatus = METAMASK_CONNECT_STATUS.NOT_AVAILABLE

      if (!account && networkID) {
        this.connectFailCode = METAMASK_CONNECT_FAIL_CODE.LOCKED
        return
      }
    })
  }

  private async getMetamaskInfo() {
    const networkID: ETHEREUM_NETWORKS = await this.web3.eth.net.getId()

    // MetaMask would always return just one account, or empty array if locked.
    const accounts = await this.web3.eth.getAccounts()
    const account = accounts[0]

    return {
      networkID,
      account,
    }
  }
}

export enum METAMASK_CONNECT_STATUS {
  PENDING = 0,
  ACTIVE,
  NOT_AVAILABLE,
}

export enum METAMASK_CONNECT_FAIL_CODE {
  NO_METAMASK = 0,
  LOCKED,
  UNKNOWN,
}

export enum ETHEREUM_NETWORKS {
  OLYMPIC = 0,
  MAINNET = 1,
  MORDEN = 2,
  ROPSTEN = 3,
  RINKEBY = 4,
  KOVAN = 42,
}

export const ETHEREUM_NETWORK_NAMES = Object.freeze({
  [ETHEREUM_NETWORKS.OLYMPIC]: 'Olympic',
  [ETHEREUM_NETWORKS.MAINNET]: 'Mainnet',
  [ETHEREUM_NETWORKS.MORDEN]: 'Morden',
  [ETHEREUM_NETWORKS.ROPSTEN]: 'Ropsten',
  [ETHEREUM_NETWORKS.RINKEBY]: 'Rinkeby',
  [ETHEREUM_NETWORKS.KOVAN]: 'Kovan',
})

export const ETHEREUM_NETWORK_TX_URL_PREFIX = Object.freeze({
  [ETHEREUM_NETWORKS.OLYMPIC]: '',
  [ETHEREUM_NETWORKS.MORDEN]: '',
  [ETHEREUM_NETWORKS.MAINNET]: 'https://etherscan.io/tx/',
  [ETHEREUM_NETWORKS.ROPSTEN]: 'https://ropsten.etherscan.io/tx/',
  [ETHEREUM_NETWORKS.RINKEBY]: 'https://rinkeby.etherscan.io/tx/',
  [ETHEREUM_NETWORKS.KOVAN]: 'https://kovan.etherscan.io/tx/',
})

export enum TRANSACTION_STATUS {
  FAIL = 0,
  SUCCESS,
}
