import { reaction, observable, computed, action } from 'mobx'

import Web3 from 'web3'
import { getContracts, ITrustMeshContracts } from '@keymesh/trustmesh'

import { MetaMaskStore } from './MetaMaskStore'

import {
  IProcessingTransactionHandlers,
  getProcessingTransactionHandlers,
} from '../utils/transaction'
import { storeLogger } from '../utils/loggers'

export class ContractStore {
  @observable.ref private contracts?: ITrustMeshContracts
  @observable private _isLoading = true

  @computed
  public get isLoadingContracts() {
    return this._isLoading
  }

  @computed
  public get allContracts() {
    const { contracts } = this
    if (contracts == null) {
      throw new Error('Accessing contract while contracts is not available')
    }

    return contracts
  }

  @computed
  public get identitiesContract() {
    return this.allContracts.identities
  }

  @computed
  public get messagesContract() {
    return this.allContracts.messages
  }

  @computed
  public get broadcastMessagesContract() {
    return this.allContracts.broadcastMessages
  }

  @computed
  public get socialProofsContract() {
    return this.allContracts.socialProofs
  }

  @computed
  public get isAvailable(): boolean {
    return this.contracts != null
  }

  constructor(private web3: Web3, private metaMaskStore: MetaMaskStore) {
    reaction(
      () => this.metaMaskStore.currentEthereumNetwork,
      () => this.configureTrustMesh(),
    )
  }

  public getProcessingTransactionHandler(
    hash: string,
  ): IProcessingTransactionHandlers {
    return getProcessingTransactionHandlers(this.web3, hash)
  }

  private async configureTrustMesh() {
    const { metaMaskStore } = this
    if (metaMaskStore.currentEthereumNetwork == null) {
      this.setContracts(undefined)
      return
    }

    if (metaMaskStore.isWrongNetwork) {
      return
    }

    try {
      this.setIsLoading(true)
      const contracts = await getContracts(this.web3)
      this.setContracts(contracts)
    } catch (err) {
      storeLogger.error('Failed to get trustmesh contracts:', err)
      this.setContracts(undefined)
    }
  }

  @action
  private setIsLoading(value: boolean) {
    this._isLoading = value
  }

  @action
  private setContracts(contracts?: ITrustMeshContracts) {
    this.contracts = contracts
    this.setIsLoading(false)
  }
}

export interface ITransactionLifecycle {
  transactionWillCreate?: () => void
  transactionDidCreate?: (transactionHash: string) => void
}
