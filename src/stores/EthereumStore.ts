import {
  observable,
  computed,
  runInAction,
  action,
} from 'mobx'

import {
  initialize,
  getWeb3,
  TrustbaseError,
} from 'trustbase'
import {
  Web3,
  JsonRPCRequest,
  JsonRPCResponse,
} from 'trustbase/typings/web3.d'

import {
  storeLogger,
} from '../utils/loggers'

export class EthereumStore {
  @observable public ethereumConnectStatus: ETHEREUM_CONNECT_STATUS = ETHEREUM_CONNECT_STATUS.PENDING
  @observable public ethereumConnectErrorCode: ETHEREUM_CONNECT_ERROR_CODE
  @observable public ethereumConnectError: Error | undefined
  @observable public currentEthereumNetwork: ETHEREUM_NETWORKS | undefined
  @observable public currentEthereumAccount: string | undefined

  @computed
  public get isPending() {
    return this.ethereumConnectStatus === ETHEREUM_CONNECT_STATUS.PENDING
  }

  @computed
  public get isActive() {
    return this.ethereumConnectStatus === ETHEREUM_CONNECT_STATUS.ACTIVE
  }

  @computed
  public get hasError() {
    return this.ethereumConnectStatus === ETHEREUM_CONNECT_STATUS.ERROR
  }

  @computed
  public get isMetaMaskLocked() {
    return this.ethereumConnectErrorCode === ETHEREUM_CONNECT_ERROR_CODE.LOCKED
  }

  @computed
  public get hasNotMetaMask() {
    return this.ethereumConnectErrorCode === ETHEREUM_CONNECT_ERROR_CODE.NO_METAMASK
  }

  public web3: Web3

  private connectStatusListeners: TypeConnectStatusListener[] = []
  private detectEthereumAccountChangeTimeout: number
  private detectEthereumNetworkChangeTimeout: number

  public connect = () => {
    const metaMasksWeb3 = (window as any).web3
    const provider = typeof metaMasksWeb3 !== 'undefined' ? metaMasksWeb3.currentProvider as IasyncProvider : undefined

    if (typeof provider === 'undefined') {
      this.processEthereumConnectError(ETHEREUM_CONNECT_ERROR_CODE.NO_METAMASK)
      return Promise.resolve()
    }

    return initialize({ provider })
      .then(async () => {
        const web3 = this.web3 = getWeb3()
        const currentNetworkId: ETHEREUM_NETWORKS = await web3.eth.net.getId()
        this.processEthereumConnect(currentNetworkId)
      })
      .catch((err: Error) => {
        if ((err as TrustbaseError).code === TrustbaseError.CODE.FOUND_NO_ACCOUNT) {
          // MetaMask locked
          this.processEthereumConnectError(ETHEREUM_CONNECT_ERROR_CODE.LOCKED)
          this.detectEthereumAccountChangeTimeout = window.setTimeout(this.listenForEthereumAccountChange, 100)
        } else {
          this.processEthereumConnectError(ETHEREUM_CONNECT_ERROR_CODE.UNKNOWN, err)
        }
      })
  }

  public listenForEthereumConnectStatusChange = (listener: TypeConnectStatusListener) => {
    this.connectStatusListeners.push(listener)
    return () => {
      this.removeEthereumConnectStatusListener(listener)
    }
  }

  public getBlockHash = (blockNumber: number) => {
    return this.web3.eth.getBlock(blockNumber)
      .then((block) => block.hash)
      .catch((err) => {
        storeLogger.error(err)
        return '0x0'
      })
  }

  private removeEthereumConnectStatusListener = (listener: TypeConnectStatusListener) => {
    this.connectStatusListeners = this.connectStatusListeners.filter((_listener) => _listener !== listener)
  }

  private listenForEthereumAccountChange = async () => {
    window.clearTimeout(this.detectEthereumAccountChangeTimeout)
    const { web3 } = this
    const accounts: string[] = await web3.eth.getAccounts()

    if (accounts.length > 0) {
      if (this.currentEthereumAccount !== accounts[0]) {
        runInAction(() => {
          this.currentEthereumAccount = web3.eth.defaultAccount = accounts[0]
        })
      }
      if (
        this.ethereumConnectStatus === ETHEREUM_CONNECT_STATUS.ERROR
        && this.ethereumConnectErrorCode === ETHEREUM_CONNECT_ERROR_CODE.LOCKED
      ) {
        return this.processEthereumConnect(this.currentEthereumNetwork!)
      }
    } else if (this.ethereumConnectStatus !== ETHEREUM_CONNECT_STATUS.ERROR) {
      return this.processEthereumConnectError(ETHEREUM_CONNECT_ERROR_CODE.LOCKED)
    }
    this.detectEthereumAccountChangeTimeout = window.setTimeout(this.listenForEthereumAccountChange, 100)
  }

  private listenForEthereumNetworkChange = async () => {
    window.clearTimeout(this.detectEthereumNetworkChangeTimeout)
    const { web3 } = this
    const currentNetworkId: ETHEREUM_NETWORKS = await web3.eth.net.getId()

    if (this.currentEthereumNetwork !== currentNetworkId) {
      window.clearTimeout(this.detectEthereumAccountChangeTimeout)
      return this.processEthereumConnect(currentNetworkId)
    }
    this.detectEthereumNetworkChangeTimeout = window.setTimeout(this.listenForEthereumNetworkChange, 100)
  }

  @action
  private processEthereumConnect = (networkId: ETHEREUM_NETWORKS) => {
    delete this.ethereumConnectErrorCode
    delete this.ethereumConnectError

    this.currentEthereumNetwork = networkId
    this.currentEthereumAccount = this.web3.eth.defaultAccount

    this.ethereumConnectStatus = ETHEREUM_CONNECT_STATUS.ACTIVE

    window.clearTimeout(this.detectEthereumAccountChangeTimeout)
    window.clearTimeout(this.detectEthereumNetworkChangeTimeout)
    this.detectEthereumAccountChangeTimeout = window.setTimeout(this.listenForEthereumAccountChange, 100)
    this.detectEthereumNetworkChangeTimeout = window.setTimeout(this.listenForEthereumNetworkChange, 100)
  }

  @action
  private processEthereumConnectError = (
    errCode: ETHEREUM_CONNECT_ERROR_CODE,
    err?: Error
  ) => {
    if (errCode !== ETHEREUM_CONNECT_ERROR_CODE.LOCKED) {
      delete this.currentEthereumNetwork
    }
    delete this.currentEthereumAccount

    this.ethereumConnectStatus = ETHEREUM_CONNECT_STATUS.ERROR
    this.ethereumConnectErrorCode = errCode
    this.ethereumConnectError = err
  }
}

type TypeConnectStatusListener = (prev: ETHEREUM_CONNECT_STATUS, cur: ETHEREUM_CONNECT_STATUS) => void

interface IasyncProvider {
  sendAsync(payload: JsonRPCRequest, callback: (e: Error, val: JsonRPCResponse) => void): void
}

export enum ETHEREUM_CONNECT_STATUS {
  PENDING = 0,
  ACTIVE,
  ERROR
}

export enum ETHEREUM_CONNECT_ERROR_CODE {
  NO_METAMASK = 0,
  LOCKED,
  UNKNOWN
}

export enum ETHEREUM_NETWORKS {
  OLYMPIC = 0,
  MAINNET = 1,
  MORDEN = 2,
  ROPSTEN = 3,
  RINKEBY = 4,
  KOVAN = 42
}

export const ETHEREUM_NETWORK_NAMES = Object.freeze({
  [ETHEREUM_NETWORKS.OLYMPIC]: 'Olympic',
  [ETHEREUM_NETWORKS.MAINNET]: 'Mainnet',
  [ETHEREUM_NETWORKS.MORDEN]: 'Morden',
  [ETHEREUM_NETWORKS.ROPSTEN]: 'Ropsten',
  [ETHEREUM_NETWORKS.RINKEBY]: 'Rinkeby',
  [ETHEREUM_NETWORKS.KOVAN]: 'Kovan'
}) as {
  [networkID: number]: string
}
