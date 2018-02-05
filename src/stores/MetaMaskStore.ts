import {
  observable,
  computed,
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

export class MetaMaskStore {
  @observable public connectStatus: METAMASK_CONNECT_STATUS = METAMASK_CONNECT_STATUS.PENDING
  @observable public connectFailCode: METAMASK_CONNECT_FAIL_CODE
  @observable public connectError: Error | undefined
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

  public web3: Web3

  private detectEthereumAccountChangeTimeout: number
  private detectEthereumNetworkChangeTimeout: number

  public connect = () => {
    const metaMasksWeb3 = (window as any).web3
    const provider = typeof metaMasksWeb3 !== 'undefined' ? metaMasksWeb3.currentProvider as IAsyncProvider : undefined

    if (typeof provider === 'undefined') {
      this.processConnectFail(METAMASK_CONNECT_FAIL_CODE.NO_METAMASK)
      return Promise.resolve()
    }

    const setWeb3AndGetNetworkId = async () => {
      const web3 = this.web3 = getWeb3()
      const currentNetworkId: ETHEREUM_NETWORKS = await web3.eth.net.getId()
      return currentNetworkId
    }

    return initialize({ provider })
      .then(async () => {
        const currentNetworkId = await setWeb3AndGetNetworkId()
        this.processConnectSuccess(currentNetworkId)
      })
      .catch(async (err: Error) => {
        const isLocked = (err as TrustbaseError).code === TrustbaseError.CODE.FOUND_NO_ACCOUNT
        if (isLocked) {
          const currentNetworkId = await setWeb3AndGetNetworkId()
          this.setCurrentEthereumNetworkId(currentNetworkId)

          this.processConnectFail(METAMASK_CONNECT_FAIL_CODE.LOCKED)
        } else {
          storeLogger.error(err)
          this.processConnectFail(METAMASK_CONNECT_FAIL_CODE.UNKNOWN, err)
        }
      })
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

  private listenForEthereumAccountChange = async () => {
    window.clearTimeout(this.detectEthereumAccountChangeTimeout)

    const { web3 } = this
    const accounts: string[] = await web3.eth.getAccounts()
    const hasWalletAccount = accounts.length > 0

    if (hasWalletAccount) {
      const isAccountChanged = this.currentEthereumAccount !== accounts[0]

      if (isAccountChanged) {
        this.setCurrentEthereumAccount(accounts[0])
      } else if (this.isLocked) {
        return this.processConnectSuccess(this.currentEthereumNetwork!)
      }
    } else if (!this.isLocked) {
      return this.processConnectFail(METAMASK_CONNECT_FAIL_CODE.LOCKED)
    }

    this.detectEthereumAccountChangeTimeout =
      window.setTimeout(this.listenForEthereumAccountChange, DETECT_ACCOUNT_INTERVAL)
  }

  private listenForEthereumNetworkChange = async () => {
    window.clearTimeout(this.detectEthereumNetworkChangeTimeout)

    const { web3 } = this
    const currentNetworkId: ETHEREUM_NETWORKS = await web3.eth.net.getId()
    const isEthereumNetworkChange = this.currentEthereumNetwork !== currentNetworkId

    if (isEthereumNetworkChange) {
      if (this.isLocked) {
        this.setCurrentEthereumNetworkId(currentNetworkId)
      } else {
        return this.processConnectSuccess(currentNetworkId)
      }
    }

    this.detectEthereumNetworkChangeTimeout =
      window.setTimeout(this.listenForEthereumNetworkChange, DETECT_NETWORK_INTERVAL)
  }

  @action
  private processConnectSuccess = (networkId: ETHEREUM_NETWORKS) => {
    delete this.connectFailCode
    delete this.connectError

    this.connectStatus = METAMASK_CONNECT_STATUS.ACTIVE
    this.currentEthereumNetwork = networkId
    this.currentEthereumAccount = this.web3.eth.defaultAccount

    this.detectEthereumAccountChangeTimeout =
      window.setTimeout(this.listenForEthereumAccountChange, DETECT_ACCOUNT_INTERVAL)
    this.detectEthereumNetworkChangeTimeout =
      window.setTimeout(this.listenForEthereumNetworkChange, DETECT_NETWORK_INTERVAL)
  }

  @action
  private processConnectFail = (
    failCode: METAMASK_CONNECT_FAIL_CODE,
    err?: Error
  ) => {
    if (failCode === METAMASK_CONNECT_FAIL_CODE.LOCKED) {
      // listen for unlock
      this.detectEthereumAccountChangeTimeout =
        window.setTimeout(this.listenForEthereumAccountChange, DETECT_ACCOUNT_INTERVAL)
    } else {
      delete this.currentEthereumNetwork
    }
    delete this.currentEthereumAccount

    this.connectStatus = METAMASK_CONNECT_STATUS.NOT_AVAILABLE
    this.connectFailCode = failCode
    this.connectError = err
  }

  @action
  private setCurrentEthereumNetworkId = (networkId: ETHEREUM_NETWORKS) => {
    this.currentEthereumNetwork = networkId
  }

  @action
  private setCurrentEthereumAccount = (address: string) => {
    this.currentEthereumAccount = this.web3.eth.defaultAccount = address
  }
}

const DETECT_ACCOUNT_INTERVAL = 300 // 0.3 sec
const DETECT_NETWORK_INTERVAL = 300 // 0.3 sec

interface IAsyncProvider {
  sendAsync(payload: JsonRPCRequest, callback: (e: Error, val: JsonRPCResponse) => void): void
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
}) as {
  [networkID: number]: string
}

export const ETHEREUM_NETWORK_TX_URL_PREFIX = Object.freeze({
  [ETHEREUM_NETWORKS.OLYMPIC]: '',
  [ETHEREUM_NETWORKS.MORDEN]: '',
  [ETHEREUM_NETWORKS.MAINNET]: 'https://etherscan.io/tx/',
  [ETHEREUM_NETWORKS.ROPSTEN]: 'https://ropsten.etherscan.io/tx/',
  [ETHEREUM_NETWORKS.RINKEBY]: 'https://rinkeby.etherscan.io/tx/',
  [ETHEREUM_NETWORKS.KOVAN]: 'https://kovan.etherscan.io/tx/',
}) as {
  [networkID: number]: string
}
