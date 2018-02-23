import Dexie from 'dexie'
import {
  TypeDexieWithTables,
} from './'
import {
  ETHEREUM_NETWORKS,
} from '../stores/MetaMaskStore'
import { IUserCaches, IUserCachesVerification , IUserCachesIdentity } from '../stores/UserCachesStore'

export class UserCachesDB {
  constructor(private dexieDB: TypeDexieWithTables) {}

  public get(networkId: ETHEREUM_NETWORKS, userAddress: string): Dexie.Promise<IUserCaches | undefined> {
    return this.table.get([networkId, userAddress]).catch(() => undefined)
  }

  public update(
    userAddress: string,
    networkId: ETHEREUM_NETWORKS,
    newData: {
      identity?: IUserCachesIdentity
      verification?: IUserCachesVerification,
    },
  ): Dexie.Promise<IUserCaches> {
    return this.table
      .update(
        [networkId, userAddress],
        newData,
      )
      .then(() => this.table.get([networkId, userAddress])) as Dexie.Promise<IUserCaches>
  }

  public create(userCache: IUserCaches): Promise<IUserCaches> {
    return this.table.put(userCache)
      .then(() => this.table.get([userCache.networkId, userCache.userAddress])) as Dexie.Promise<IUserCaches>
  }

  private get table() {
    return this.dexieDB.userCaches
  }
}
