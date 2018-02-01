import {
  useStrict,
} from 'mobx'

import {
  EthereumStore,
} from './EthereumStore'
import {
  ContractStore,
} from './ContractStore'
import {
  UsersStore,
} from './UsersStore'

import DB from '../DB'
import { BroadcastMessagesStore } from './BroadcastMessagesStore'

useStrict(true)

export function createStores(): Istores {
  const db = new DB()
  const ethereumStore = new EthereumStore()
  const contractStore = new ContractStore({
    ethereumStore
  })
  const usersStore = new UsersStore({
    ethereumStore,
    contractStore,
    db
  })
  ethereumStore.connect()
  const broadcastMessagesStore = new BroadcastMessagesStore({
    usersStore,
    contractStore,
  })

  return {
    ethereumStore,
    contractStore,
    usersStore,
    broadcastMessagesStore,
  }
}

export interface Istores {
  ethereumStore: EthereumStore
  contractStore: ContractStore
  usersStore: UsersStore
  broadcastMessagesStore: BroadcastMessagesStore
}
