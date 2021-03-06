import Dexie from 'dexie'
import {
  TypeDexieWithTables,
  Databases,
} from './'
import {
  restoreDB,
  restoreCryptobox,
  IDumpedDatabases,
} from '../utils/data'

import {
  ETHEREUM_NETWORKS,
} from '../stores/MetaMaskStore'
import {
  IUser,
  USER_STATUS,
} from '../stores/UserStore'

export class UsersDB {
  constructor(private dexieDB: TypeDexieWithTables, private databases: Databases) {}

  public getUsers(networkId: ETHEREUM_NETWORKS, status?: USER_STATUS) {
    return this.dexieDB.users
      .where({ networkId , ...(status && { status })})
      .toArray()
  }

  public deleteUsers(networkId: ETHEREUM_NETWORKS) {
    const {
      users,
      sessions,
      messages,
    } = this.dexieDB
    return this.dexieDB.transaction('rw', users, sessions, messages, () => {
      return users
        .where({ networkId })
        .each((user) => this.deleteUser(user))
    })
  }

  public createUser(user: ICreateUserArgs) {
    const {
      users,
    } = this.dexieDB
    const defaultData = {
      status: USER_STATUS.PENDING,
      blockHash: '0x0',
      lastFetchBlockOfChatMessages: 0,
    }
    const newUser: IUser = {
      ...defaultData,
      ...user,
    }

    return users
      .add(newUser)
      .then((primaryKeys) => users.get(primaryKeys)) as Dexie.Promise<IUser>
  }

  public async restoreUserFromExportedData(networkId: ETHEREUM_NETWORKS, data: IDumpedDatabases) {
    const user = await this.dexieDB.transaction('rw', this.dexieDB.tables, async () => {
      const oldUsers = await this.getUsers(networkId)
      await restoreDB(this.dexieDB, data.keymesh, () => undefined)
      const users = await this.getUsers(networkId)

      const oldUserAddresses: { [userAddress: string]: boolean } = {}
      for (const oldUser of oldUsers) {
        oldUserAddresses[oldUser.userAddress] = true
      }

      const newUser = users.find((_user) => !oldUserAddresses[_user.userAddress])
      if (newUser == null) {
        throw new Error('Network not match')
      }

      return newUser
    })
    delete data.keymesh

    await Promise.all(
      Object.keys(data)
        .map((dbname) => restoreCryptobox(dbname, data[dbname])),
    )

    return user
  }

  public getUser(networkId: ETHEREUM_NETWORKS, userAddress: string) {
    return this.dexieDB.users
      .get([networkId, userAddress])
  }

  public updateUser(
    {
      networkId,
      userAddress,
    }: IUser,
    updateOptions: IUpdateUserOptions = {},
  ) {
    const {
      users,
    } = this.dexieDB
    return users
      .update([networkId, userAddress], updateOptions)
      .then(() => users.get([networkId, userAddress])) as Dexie.Promise<IUser>
  }

  public deleteUser(user: IUser) {
    const {
      users,
      sessions,
      messages,
    } = this.dexieDB
    const {
      networkId,
      userAddress,
    } = user

    return this.dexieDB.transaction('rw', users, sessions, messages, async () => {
      await users
        .delete([networkId, userAddress])

      await this.databases.sessionsDB.deleteSessions(user, { isDeleteUser: true })

      await this.databases.messagesDB.deleteMessagesOfUser(user)
    })
  }

  public disposeDB() {
    const {
      users,
      sessions,
      messages,
    } = this.dexieDB
    return this.dexieDB.transaction('rw', users, sessions, messages, async () => {
      await Promise.all([
        users.clear(),
        sessions.clear(),
        messages.clear(),
      ])
    })
  }
}

export interface ICreateUserArgs {
  networkId: ETHEREUM_NETWORKS
  userAddress: string
  identityTransactionHash: string
}

export interface IUpdateUserOptions {
  status?: USER_STATUS
  blockHash?: string
  lastFetchBlockOfChatMessages?: number
}
