import {
  reaction,
} from 'mobx'

import {
  Identities,
  Messages,
  BroadcastMessages,
  BoundSocials
} from 'trustbase'

import {
  EthereumStore,
} from './EthereumStore'

export class ContractStore {
  public identitiesContract: Identities
  public messagesContract: Messages
  public broadcastMessagesContract: BroadcastMessages
  public boundSocialsContract: BoundSocials

  constructor({
    ethereumStore
  }: {
    ethereumStore: EthereumStore
  }) {
    this.ethereumStore = ethereumStore
    reaction(
      () => ({
        isActive: this.ethereumStore.isActive,
        networkId: this.ethereumStore.currentEthereumNetwork
      }),
      ({
        networkId,
        isActive
      }) => {
        if (isActive) {
          this.identitiesContract = new Identities({ networkId })
          this.messagesContract = new Messages({ networkId })
          this.broadcastMessagesContract = new BroadcastMessages({ networkId })
          this.boundSocialsContract = new BoundSocials({ networkId })
        } else {
          delete this.identitiesContract
          delete this.messagesContract
          delete this.broadcastMessagesContract
          delete this.boundSocialsContract
        }
      }
    )
  }

  private ethereumStore: EthereumStore
}

export interface ItransactionLifecycle {
  transactionWillCreate?: () => void
  transactionDidCreate?: (transactionHash: string) => void
}
