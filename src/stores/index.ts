import {
  useStrict,
} from 'mobx'

import {
  MetaMaskStore,
} from './MetaMaskStore'
import {
  ContractStore,
} from './ContractStore'
import {
  UsersStore,
} from './UsersStore'
import {
  BroadcastMessagesStore,
} from './BroadcastMessagesStore'

useStrict(true)

export function createStores(): IStores {
  const metaMaskStore = new MetaMaskStore()
  const contractStore = new ContractStore({
    metaMaskStore,
  })
  const usersStore = new UsersStore({
    metaMaskStore,
    contractStore,
  })
  const broadcastMessagesStore = new BroadcastMessagesStore({
    usersStore,
    contractStore,
  })

  return {
    metaMaskStore,
    contractStore,
    usersStore,
    broadcastMessagesStore,
  }
}

export interface IStores {
  metaMaskStore: MetaMaskStore
  contractStore: ContractStore
  usersStore: UsersStore
  broadcastMessagesStore: BroadcastMessagesStore
}
