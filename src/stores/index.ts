import {
  useStrict,
} from 'mobx'

import { EthereumStore } from './EthereumStore'
import { ContractStore } from './ContractStore'
import { UsersStore } from './UsersStore'
import { UserStore } from './UserStore'
import { SessionStore } from './SessionStore'

import DB from '../DB'

export interface Istores {
  ethereumStore: EthereumStore
  usersStore: UsersStore
}

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

  return {
    ethereumStore,
    usersStore
  }
}

export {
  EthereumStore,
  ContractStore,
  UsersStore,
  UserStore,
  SessionStore,
}
