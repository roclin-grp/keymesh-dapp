import {
  observable,
  runInAction,
  useStrict,
  action,
} from 'mobx'

import {
  initialize,
  getWeb3,
  TrustbaseError,
} from 'trustbase'
import { Web3 } from 'trustbase/typings/web3.d'

import {
  storeLogger
} from '../utils'

import {
  ETHEREUM_CONNECT_STATUS,
  NETWORKS,
  ETHEREUM_CONNECT_ERROR,
} from '../constants'

import {
  IasyncProvider,
} from '../../typings/interface'

useStrict(true)

export class EthereumStore {
  @observable public ethereumConnectStatus: ETHEREUM_CONNECT_STATUS = ETHEREUM_CONNECT_STATUS.PENDING
  @observable public ethereumConnectErrorCode: ETHEREUM_CONNECT_ERROR
  @observable public ethereumConnectError: Error | undefined
  @observable public currentEthereumNetwork: NETWORKS | undefined
  @observable public currentEthereumAccount: string | undefined

  public web3: Web3
  private connectStatusListeners: TypeConnectStatusListener[] = []
  private detectEthereumAccountChangeTimeout: number
  private detectEthereumNetworkChangeTimeout: number

  public connect = () => {
    const metaMasksWeb3 = (window as any).web3
    const provider = typeof metaMasksWeb3 !== 'undefined' ? metaMasksWeb3.currentProvider as IasyncProvider : undefined

    if (typeof provider === 'undefined') {
      this.processEthereumConnectError(ETHEREUM_CONNECT_ERROR.NO_METAMASK)
      return Promise.resolve()
    }

    return initialize({ provider })
      .then(async () => {
        const web3 = this.web3 = getWeb3()
        const currentNetworkId: NETWORKS = await web3.eth.net.getId()
        this.processEthereumConnect(currentNetworkId)
      })
      .catch((err: Error) => {
        if ((err as TrustbaseError).code === TrustbaseError.CODE.FOUND_NO_ACCOUNT) {
          // MetaMask locked
          this.processEthereumConnectError(ETHEREUM_CONNECT_ERROR.LOCKED)
          this.detectEthereumAccountChangeTimeout = window.setTimeout(this.listenForEthereumAccountChange, 100)
        } else {
          this.processEthereumConnectError(ETHEREUM_CONNECT_ERROR.UNKNOWN, err)
        }
      })
  }

  public listenForEthereumConnectStatusChange = (listener: TypeConnectStatusListener) => {
    this.connectStatusListeners.push(listener)
    return () => {
      this.removeEthereumConnectStatusListener(listener)
    }
  }

  public getBlockHash = async (blockNumber: number): Promise<string> => {
    return await getWeb3().eth.getBlock(blockNumber)
      .then((block) => block.hash)
      .catch((err: Error) => {
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
        && this.ethereumConnectErrorCode === ETHEREUM_CONNECT_ERROR.LOCKED
      ) {
        return this.processEthereumConnect(this.currentEthereumNetwork!)
      }
    } else if (this.ethereumConnectStatus !== ETHEREUM_CONNECT_STATUS.ERROR) {
      return this.processEthereumConnectError(ETHEREUM_CONNECT_ERROR.LOCKED)
    }
    this.detectEthereumAccountChangeTimeout = window.setTimeout(this.listenForEthereumAccountChange, 100)
  }

  private listenForEthereumNetworkChange = async () => {
    window.clearTimeout(this.detectEthereumNetworkChangeTimeout)
    const { web3 } = this
    const currentNetworkId: NETWORKS = await web3.eth.net.getId()

    if (this.currentEthereumNetwork !== currentNetworkId) {
      window.clearTimeout(this.detectEthereumAccountChangeTimeout)
      return this.processEthereumConnect(currentNetworkId)
    }
    this.detectEthereumNetworkChangeTimeout = window.setTimeout(this.listenForEthereumNetworkChange, 100)
  }

  @action
  private processEthereumConnect = (networkId: NETWORKS) => {
    delete this.ethereumConnectErrorCode
    delete this.ethereumConnectError

    this.currentEthereumNetwork = networkId
    this.currentEthereumAccount = this.web3.eth.defaultAccount

    const prevConnectStatus = this.ethereumConnectStatus
    this.ethereumConnectStatus = ETHEREUM_CONNECT_STATUS.SUCCESS
    this.ethereumConnectStatusDidChange(prevConnectStatus, this.ethereumConnectStatus)

    window.clearTimeout(this.detectEthereumAccountChangeTimeout)
    window.clearTimeout(this.detectEthereumNetworkChangeTimeout)
    this.detectEthereumAccountChangeTimeout = window.setTimeout(this.listenForEthereumAccountChange, 100)
    this.detectEthereumNetworkChangeTimeout = window.setTimeout(this.listenForEthereumNetworkChange, 100)
  }

  @action
  private processEthereumConnectError = (
    errCode: ETHEREUM_CONNECT_ERROR,
    err?: Error
  ) => {
    if (errCode !== ETHEREUM_CONNECT_ERROR.LOCKED) {
      delete this.currentEthereumNetwork
    }
    delete this.currentEthereumAccount

    const prevConnectStatus = this.ethereumConnectStatus
    this.ethereumConnectStatus = ETHEREUM_CONNECT_STATUS.ERROR
    this.ethereumConnectErrorCode = errCode
    this.ethereumConnectError = err
    this.ethereumConnectStatusDidChange(prevConnectStatus, this.ethereumConnectStatus)
  }

  private ethereumConnectStatusDidChange = (
    prevStatus: ETHEREUM_CONNECT_STATUS,
    currentStatus: ETHEREUM_CONNECT_STATUS
  ) => this.connectStatusListeners.forEach((listener) => {
    listener(prevStatus, currentStatus)
  })
}

type TypeConnectStatusListener = (prev: ETHEREUM_CONNECT_STATUS, cur: ETHEREUM_CONNECT_STATUS) => void
