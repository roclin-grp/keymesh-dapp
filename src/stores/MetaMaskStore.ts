import {
  observable,
  computed,
  action,
  observe,
  IValueDidChange,
} from 'mobx'

import Web3 from 'web3'

import { sleep } from '../utils'
import ENV from '../config'

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
  // TODO: currentEthereumNetwork and currentEthereumAccount should be private
  @observable public currentEthereumNetwork: ETHEREUM_NETWORKS | undefined
  @observable public currentEthereumAccount: string | undefined

  @observable private connectStatus: METAMASK_CONNECT_STATUS = METAMASK_CONNECT_STATUS.PENDING

  @computed
  public get networkID() {
    const { currentEthereumNetwork } = this
    if (currentEthereumNetwork == null) {
      throw new Error('Trying to access networkID while MetaMask is not connected')
    }

    return currentEthereumNetwork
  }

  @computed
  public get walletAddress() {
    const { currentEthereumAccount } = this
    if (currentEthereumAccount == null) {
      throw new Error('Trying to access walletAddress while MetaMask is locked or not connected')
    }

    return currentEthereumAccount
  }

  @computed
  public get isPending() {
    return this.connectStatus === METAMASK_CONNECT_STATUS.PENDING
  }

  @computed
  public get isActive() {
    return !this.isWrongNetwork && this.connectStatus === METAMASK_CONNECT_STATUS.ACTIVE
  }

  @computed
  public get isLocked() {
    return this.connectStatus === METAMASK_CONNECT_STATUS.LOCKED
  }

  @computed
  public get isWrongNetwork() {
    if (process.env.NODE_ENV === 'development') {
      return (
        this.currentEthereumNetwork !== ENV.DEPLOYED_NETWORK_ID &&
        // allow custom network
        Object.values(ETHEREUM_NETWORKS).includes(this.currentEthereumNetwork)
      )
    }

    return this.currentEthereumNetwork !== ENV.DEPLOYED_NETWORK_ID
  }

  constructor(private web3: Web3) {
    this.startStatusPoll()
  }

  public listenForNetworkChange(
    cb: (
      currentValue: MetaMaskStore['currentEthereumNetwork'],
      prevValue: MetaMaskStore['currentEthereumNetwork'],
    ) => void,
  ) {
    return observe(
      this,
      'currentEthereumNetwork',
      ({ oldValue, newValue }: IValueDidChange<MetaMaskStore['currentEthereumNetwork']>) =>
        cb(newValue, oldValue),
    )
  }

  public listenForWalletAccountChange(
    cb: (
      currentAccount: MetaMaskStore['currentEthereumAccount'],
      prevAccount: MetaMaskStore['currentEthereumAccount'],
    ) => void,
  ) {
    return observe(
      this,
      'currentEthereumAccount',
      ({ oldValue, newValue }: IValueDidChange<MetaMaskStore['currentEthereumAccount']>) =>
        cb(newValue, oldValue),
    )
  }

  public async getBlockHash(blockNumber: number): Promise<string> {
    const block = await this.web3.eth.getBlock(blockNumber)
    if (block == null) {
      return '0x0'
    }

    return block.hash
  }

  /**
   * Update MetaMask status at regular intervals
   */
  private async startStatusPoll() {
    let i = 0
    let networkID = await this.getMetaMaskNetID()

    while (true) {
      // Check the network once every 3 seconds
      i = (i + 1) % 10
      if (i === 0) {
        networkID = await this.getMetaMaskNetID()
      }

      const account = await this.getMetaMaskAccount()
      await this.updateStatus(networkID, account)

      await sleep(300)
    }
  }

  @action
  private async updateStatus(networkID: ETHEREUM_NETWORKS, account: string | null) {
    const isSameNetwork = this.currentEthereumNetwork === networkID
    if (this.currentEthereumAccount === account && isSameNetwork) {
      // nothing changed
      return
    }

    if (!isSameNetwork) {
      this.currentEthereumNetwork = networkID
    }

    if (account) {
      this.connectStatus = METAMASK_CONNECT_STATUS.ACTIVE
      this.currentEthereumAccount = account
      this.web3.eth.defaultAccount = account
    } else {
      this.connectStatus = METAMASK_CONNECT_STATUS.LOCKED
      this.currentEthereumAccount = undefined
    }
  }

  private async getMetaMaskAccount(): Promise<string | null> {
    const accounts = await this.web3.eth.getAccounts()
    return accounts[0]
  }

  private async getMetaMaskNetID(): Promise<ETHEREUM_NETWORKS> {
    const networkID: ETHEREUM_NETWORKS = await this.web3.eth.net.getId()
    return networkID
  }
}

export enum METAMASK_CONNECT_STATUS {
  PENDING,
  ACTIVE,
  LOCKED,
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
  [ETHEREUM_NETWORKS.MAINNET]: 'https://etherscan.io/tx/',
  [ETHEREUM_NETWORKS.ROPSTEN]: 'https://ropsten.etherscan.io/tx/',
  [ETHEREUM_NETWORKS.RINKEBY]: 'https://rinkeby.etherscan.io/tx/',
  [ETHEREUM_NETWORKS.KOVAN]: 'https://kovan.etherscan.io/tx/',
})
