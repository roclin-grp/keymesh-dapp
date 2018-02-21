import {
  useStrict,
} from 'mobx'

import {
  getMetaMaskWeb3,
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
  const web3 = getMetaMaskWeb3()

  // FIXME handle this error more nicely. Right now want better code structure.
  if (web3 == null) {
    throw new Error('MetaMask not installed')
  }

  const metaMaskStore = new MetaMaskStore(web3)
  const contractStore = new ContractStore(web3, metaMaskStore)
  const usersStore = new UsersStore(metaMaskStore, contractStore)
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
