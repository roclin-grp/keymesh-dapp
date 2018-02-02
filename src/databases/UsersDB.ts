import Dexie from 'dexie'
import {
  ITables,
  Databases
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
  IContact,
  USER_STATUS,
} from '../stores/UserStore'

export class UsersDB {
  constructor(private tables: ITables, private dexieDB: Dexie, private dataBases: Databases) {
    //
  }

  public getUsers(networkId: ETHEREUM_NETWORKS, status?: USER_STATUS) {
    return this.tables.tableUsers
      .where(Object.assign({networkId}, status === undefined ? null : {status}))
      .toArray()
  }

  public deleteUsers(networkId: ETHEREUM_NETWORKS) {
    const {
      tableUsers,
      tableSessions,
      tableMessages,
      tableVerifications,
    } = this.tables
    return this.dexieDB.transaction('rw', tableUsers, tableSessions, tableMessages, tableVerifications, () => {
      return tableUsers
        .where({networkId})
        .each((user) => this.deleteUser(user))
    })
  }

  public createUser(user: ICreateUserArgs) {
    const {
      tableUsers,
    } = this.tables
    return tableUsers
      .add(Object.assign(
        {},
        {
          status: USER_STATUS.PENDING,
          blockHash: '0x0',
          lastFetchBlockOfMessages: 0,
          lastFetchBlockOfBroadcast: 0,
          lastFetchBlockOfBoundSocials: 0,
          contacts: [],
          boundSocials: {},
          bindingSocials: {},
        },
        user
      ))
      .then((primaryKeys) => tableUsers.get(primaryKeys)) as Dexie.Promise<IUser>
  }

  public async restoreUserFromExportedData(networkId: ETHEREUM_NETWORKS, data: IDumpedDatabases) {
    const user = await this.dexieDB.transaction('rw', this.dexieDB.tables, async () => {
      const oldUsers = await this.getUsers(networkId)
      await restoreDB(this.dexieDB, data.keymail, () => undefined)
      const users = await this.getUsers(networkId)

      const oldUserAddress = oldUsers.reduce(
        (result, _user) => Object.assign(result, { [_user.userAddress]: true }),
        {} as {[userAddress: string]: boolean}
      )
      const newUser = users.find((_user) => !oldUserAddress[_user.userAddress])
      if (typeof newUser === 'undefined') {
        throw new Error('Network not match')
      }

      return newUser
    })
    delete data.keymail

    await Promise.all(
      Object.keys(data)
        .map((dbname) => restoreCryptobox(dbname, data[dbname]))
    )

    return user
  }

  public getUser(networkId: ETHEREUM_NETWORKS, userAddress: string) {
    return this.tables.tableUsers
      .get([networkId, userAddress])
  }

  public updateUser(
    {
      networkId,
      userAddress,
    }: IUser,
    updateOptions: IUpdateUserOptions = {}
  ) {
    const {
      tableUsers,
    } = this.tables
    return tableUsers
      .update([networkId, userAddress], updateOptions)
      .then(() => tableUsers.get([networkId, userAddress])) as Dexie.Promise<IUser>
  }

  public addContact(user: IUser, contact: IContact) {
    if (user.contacts.find((_contact) => _contact.userAddress === contact.userAddress)) {
      return Dexie.Promise.resolve(1)
    }

    return this.updateUser(
      user,
      {
        contacts: user.contacts.concat(contact)
      }
    )
  }

  public deleteContact(user: IUser, contact: IContact) {
    if (!user.contacts.find((_contact) => _contact.userAddress === contact.userAddress)) {
      return Dexie.Promise.resolve(1)
    }

    return this.updateUser(
      user,
      {
        contacts: user.contacts.filter((_contact) => _contact.userAddress !== contact.userAddress)
      }
    )
  }

  public deleteUser(user: IUser) {
    const {
      tableUsers,
      tableSessions,
      tableMessages,
      tableVerifications,
    } = this.tables
    const {
      sessionsDB,
      messagesDB,
      verificationsDB,
    } = this.dataBases
    const {
      networkId,
      userAddress,
    } = user

    return this.dexieDB.transaction('rw', tableUsers, tableSessions, tableMessages, tableVerifications, async () => {
      await tableUsers
        .delete([networkId, userAddress])

      await sessionsDB.deleteSessions(user)

      await messagesDB.deleteMessagesOfUser(user)

      await verificationsDB.deleteVerificationsOfUser(user)
    })
  }

  public disposeDB() {
    const {
      tableUsers,
      tableSessions,
      tableMessages,
      tableVerifications,
    } = this.tables
    return this.dexieDB.transaction('rw', tableUsers, tableSessions, tableMessages, tableVerifications, async () => {
      await Promise.all([
        tableUsers.clear(),
        tableSessions.clear(),
        tableMessages.clear(),
        tableVerifications.clear(),
      ])
    })
  }
}

interface ICreateUserArgs {
  networkId: ETHEREUM_NETWORKS
  userAddress: string
  identityTransactionHash: string
}

interface IUpdateUserOptions {
  status?: USER_STATUS
  blockHash?: string
  identityTransactionHash?: string
  contacts?: IContact[]

  lastFetchBlockOfMessages?: number
}
