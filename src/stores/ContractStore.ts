import {
  reaction,
} from 'mobx'

import {
  Identities,
  Messages,
  BroadcastMessages,
  BoundSocials
} from 'trustbase'

import { EthereumStore } from './EthereumStore'

import {
  ETHEREUM_CONNECT_STATUS,
} from '../constants'

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
        connectStatus: this.ethereumStore.ethereumConnectStatus,
        networkId: this.ethereumStore.currentEthereumNetwork
      }),
      ({
        networkId,
        connectStatus
      }) => {
        if (
          connectStatus === ETHEREUM_CONNECT_STATUS.SUCCESS
          && typeof networkId !== 'undefined'
        ) {
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
