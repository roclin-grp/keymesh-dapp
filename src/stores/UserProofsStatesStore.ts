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
  private contractStore: ContractStore
  private usersStore: UsersStore
  private cachedUserProofsStateStores: {
    [primaryKey: string]: UserProofsStateStore,
  } = {}

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
