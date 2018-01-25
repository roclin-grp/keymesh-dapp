import { EthereumStore } from './EthereumStore'
import { ContractStore } from './ContractStore'
import { UsersStore } from './UsersStore'
import { UserStore } from './UserStore'

import {
  storeLogger
} from '../utils'

import DB from '../DB'

export interface Istores {
  ethereumStore: EthereumStore
  usersStore: UsersStore
}

export function createStores(): Istores {
  const db = new DB()
  const ethereumStore = new EthereumStore()
  ethereumStore.connect().catch(storeLogger.error)
  const contractStore = new ContractStore({
    ethereumStore
  })
  const usersStore = new UsersStore({
    ethereumStore,
    contractStore,
    db
  })

  return {
    ethereumStore,
    usersStore
  }
}

export {
  EthereumStore,
  ContractStore,
  UserStore,
  UsersStore,
}
