import {
  UsersStore,
} from './UsersStore'
import {
  UserProofsStateStore,
} from './UserProofsStateStore'
import {
  ContractStore,
} from './ContractStore'
import { isUndefined } from '../utils'

export class UserProofsStatesStore {
  private contractStore: ContractStore
  private usersStore: UsersStore
  private cachedUserProofsStateStores: {
    [userAddress: string]: UserProofsStateStore,
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

  public getUserProofsStateStore(userAddress: string): UserProofsStateStore {
    const oldStore = this.cachedUserProofsStateStores[userAddress]
    if (!isUndefined(oldStore)) {
      return oldStore
    }

    const newStore = new UserProofsStateStore(
      userAddress,
      this.contractStore,
      this.usersStore,
    )

    this.cachedUserProofsStateStores[userAddress] = newStore
    return newStore
  }

  public clearCachedStores() {
    this.cachedUserProofsStateStores = {}
  }

  public disposeUserProofsStateStore(userAddress: string) {
    const oldStore = this.cachedUserProofsStateStores[userAddress]
    if (isUndefined(oldStore)) {
      return
    }

    delete this.cachedUserProofsStateStores[userAddress]
  }
}
