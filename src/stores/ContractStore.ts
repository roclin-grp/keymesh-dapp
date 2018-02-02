import {
  reaction,
  observable,
  computed,
} from 'mobx'

import {
  Identities,
  Messages,
  BroadcastMessages,
  BoundSocials
} from 'trustbase'

import {
  MetaMaskStore,
} from './MetaMaskStore'

export class ContractStore {
  @observable.ref public identitiesContract: Identities
  @observable.ref public messagesContract: Messages
  @observable.ref public broadcastMessagesContract: BroadcastMessages
  @observable.ref public boundSocialsContract: BoundSocials
  @observable public instantiationError: Error | undefined

  @computed
  public get isNotAvailable() {
    return typeof this.instantiationError !== 'undefined'
  }

  constructor({
    metaMaskStore
  }: {
    metaMaskStore: MetaMaskStore
  }) {
    this.metaMaskStore = metaMaskStore
    reaction(
      () => ({
        isActive: this.metaMaskStore.isActive,
        networkId: this.metaMaskStore.currentEthereumNetwork
      }),
      ({
        networkId,
        isActive
      }) => {
        if (isActive) {
          try {
            this.identitiesContract = new Identities({ networkId })
            this.messagesContract = new Messages({ networkId })
            this.broadcastMessagesContract = new BroadcastMessages({ networkId })
            this.boundSocialsContract = new BoundSocials({ networkId })
            this.instantiationError = undefined
          } catch (err) {
            this.instantiationError = err
          }
        } else {
          delete this.identitiesContract
          delete this.messagesContract
          delete this.broadcastMessagesContract
          delete this.boundSocialsContract
        }
      }
    )
  }

  private metaMaskStore: MetaMaskStore
}

export interface ITransactionLifecycle {
  transactionWillCreate?: () => void
  transactionDidCreate?: (transactionHash: string) => void
}
