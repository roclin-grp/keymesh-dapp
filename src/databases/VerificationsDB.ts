import Dexie from 'dexie'
import {
  ITables,
  Databases
} from './'

import {
  ETHEREUM_NETWORKS,
} from '../stores/EthereumStore'
import {
  IUser,
} from '../stores/UserStore'
import {
  IVerifications,
  IBindingSocials,
  IBoundSocials,
} from '../stores/BoundSocialsStore'

export class VerificationsDB {
  constructor(private tables: ITables, private dexieDB: Dexie, private dataBases: Databases) {

    // unreachable code just for get rid of lint...
    if (process.env.NODE_ENV === 'foobar') {
      Object.assign({}, this.dexieDB, this.dataBases)
    }
  }

  public createVerifications({
    networkId,
    userAddress,
  }: IUser) {
    const {
      tableVerifications
    } = this.tables
    return tableVerifications
      .add(
        {
          networkId,
          userAddress,
          bindingSocials: {},
          boundSocials: {},
          lastFetchBlock: 0,
        },
      )
      .then((primaryKeys) => tableVerifications.get(primaryKeys)) as Dexie.Promise<IVerifications>
  }

  public getVerifications(networkId: ETHEREUM_NETWORKS, userAddress: string) {
    return this.tables.tableVerifications.get([networkId, userAddress])
  }

  public getVerificationsOfUser({
    networkId,
    userAddress,
  }: IUser) {
    return this.tables.tableVerifications.get([networkId, userAddress])
  }

  public updateVerifications(
    {
      networkId,
      userAddress
    }: IVerifications,
    updateVerificationsOptions: IUpdateVerificationsOptions = {}
  ) {
    const {
      tableVerifications
    } = this.tables
    return this.tables.tableVerifications
      .update(
        [networkId, userAddress],
        updateVerificationsOptions
      )
      .then(() => tableVerifications.get([networkId, userAddress])) as Dexie.Promise<IVerifications>
  }

  public deleteVerifications({
    networkId,
    userAddress
  }: IVerifications) {
    return this.tables.tableVerifications
      .delete([networkId, userAddress])
  }

  public deleteVerificationsOfUser({
    networkId,
    userAddress
  }: IUser) {
    return this.tables.tableVerifications
      .delete([networkId, userAddress])
  }
}

interface IUpdateVerificationsOptions {
  bindingSocials?: IBindingSocials
  boundSocials?: IBoundSocials
  lastFetchBlock?: number
}
