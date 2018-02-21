import {
  UsersStore,
} from './UsersStore'
import {
  UserProofsStateStore,
} from './UserProofsStateStore'
import {
  ETHEREUM_NETWORKS,
} from './MetaMaskStore'
import {
  ContractStore,
} from './ContractStore'

export class UserProofsStatesStore {
  constructor({
    usersStore,
    contractStore,
  }: {
    usersStore: UsersStore
    contractStore: ContractStore,
  }) {
    this.usersStore = usersStore
    this.contractStore = contractStore
  }

  private contractStore: ContractStore
  private usersStore: UsersStore
  private cachedUserProofsStateStores: {
    [primaryKey: string]: UserProofsStateStore,
  } = {}

  public getUserProofsStateStore = (networkId: ETHEREUM_NETWORKS, userAddress: string): UserProofsStateStore => {
    const primaryKey = `${networkId}${userAddress}`
    let store = this.cachedUserProofsStateStores[primaryKey]
    if (typeof store === 'undefined') {
      store = new UserProofsStateStore({
        userAddress,
        contractStore: this.contractStore,
        usersStore: this.usersStore,
      })

      this.cachedUserProofsStateStores[primaryKey] = store
    }
    return store
  }
}
