import {
  reaction,
  runInAction,
  observable,
  computed,
} from 'mobx'

import {
  getContracts,
  ITrustMeshContracts,
} from '@keymesh/trustmesh'

import {
  MetaMaskStore,
} from './MetaMaskStore'
import Web3 from 'web3'

export class ContractStore {
  /**
   * All TrustMesh contracts
   */
  @observable.ref public trustmesh?: ITrustMeshContracts

  @computed
  public get identitiesContract() {
    return this.trustmesh!.identities
  }

  @computed
  public get messagesContract() {
    return this.trustmesh!.messages
  }

  @computed
  public get broadcastMessagesContract() {
    return this.trustmesh!.broadcastMessages
  }

  @computed
  public get socialProofsContract() {
    return this.trustmesh!.socialProofs
  }

  @computed
  public get isNotAvailable(): boolean {
    return !this.trustmesh
  }

  constructor(
    private web3: Web3,
    private metaMaskStore: MetaMaskStore,
  ) {
    this.configureTrustMesh()

    reaction(
      () => this.metaMaskStore.currentEthereumNetwork,
      () => this.configureTrustMesh(),
    )
  }

  private async configureTrustMesh() {
    const contracts = await getContracts(this.web3)
    runInAction(() => {
      this.trustmesh = contracts
    })
  }
}

export interface ITransactionLifecycle {
  transactionWillCreate?: () => void
  transactionDidCreate?: (transactionHash: string) => void
}
