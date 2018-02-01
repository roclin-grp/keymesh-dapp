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
import {
  BroadcastMessagesStore,
} from './BroadcastMessagesStore'

import {
  Databases,
} from '../databases'

useStrict(true)

export function createStores(): IStores {
  const databases = new Databases()
  const ethereumStore = new EthereumStore()
  const contractStore = new ContractStore({
    ethereumStore
  })
  const usersStore = new UsersStore({
    ethereumStore,
    contractStore,
    databases
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

export interface IStores {
  ethereumStore: EthereumStore
  contractStore: ContractStore
  usersStore: UsersStore
  broadcastMessagesStore: BroadcastMessagesStore
}
