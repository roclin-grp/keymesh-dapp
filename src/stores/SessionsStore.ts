import { observable, action, runInAction, computed } from 'mobx'

import { ContractStore } from './ContractStore'
import { UsersStore } from './UsersStore'
import { UserStore } from './UserStore'
import { SessionStore } from './SessionStore'

import { getDatabases } from '../databases'
import {
  SessionsDB,
  ISession,
  createSession,
  ISessionData,
} from '../databases/SessionsDB'
import { IMessage, IAddMessageOptions } from '../databases/MessagesDB'
import { getPreKeysPackage } from '../PreKeysPackage'

import { sleep } from '../utils'
import { publicKeyFromHexStr } from '../utils/proteus'

export class SessionsStore {
  @observable.ref public sessions: ISession[] = []
  @observable.ref public currentSessionStore: SessionStore | undefined
  @observable public isLoadingSessions = false

  private readonly sessionsDB: SessionsDB
  private readonly cachedSessionStores: {
    [sessionTag: string]: SessionStore,
  } = {}

  @computed
  public get hasSelectedSession(): boolean {
    return this.currentSessionStore != null
  }

  constructor(
    private readonly userStore: UserStore,
    private readonly usersStore: UsersStore,
    private readonly contractStore: ContractStore,
  ) {
    this.sessionsDB = getDatabases().sessionsDB
    if (userStore.isRegisterCompleted) {
      this.loadSessions()
    }
  }

  public getSession(sessionTag: string): ISession | undefined {
    return this.sessions.find((session) => session.sessionTag === sessionTag)
  }

  public getSessionByReceiver(userAddress: string): ISession[] {
    return this.sessions.filter((session) => session.data.contact === userAddress)
  }

  public async validateReceiver(receiverAddress: string) {
    const {
      publicKey: publicKeyHex,
    } = await this.usersStore.userCachesStore.getIdentityByUserAddress(receiverAddress)
    const publicKey = publicKeyFromHexStr(publicKeyHex)
    // try to get user's pre-keys
    await getPreKeysPackage(this.userStore.user.networkId, publicKey)
  }

  public createNewConversation(receiverAddress: string, subject?: string): ISession {
    const sessionData: ISessionData = {
      contact: receiverAddress,
      subject,
    }
    const newSession = createSession(this.userStore.user, sessionData, undefined, { isNewSession: true })
    return newSession
  }

  public async waitForSessions(interval = 50) {
    while (this.isLoadingSessions) {
      await sleep(interval)
    }
  }

  @action
  public async loadSessions() {
    this.isLoadingSessions = true
    const sessions = await this.sessionsDB.getSessions(this.userStore.user)

    runInAction(() => {
      this.isLoadingSessions = false
      this.sessions = sessions
    })
  }

  public isCurrentSession(sessionTag: string): boolean {
    return (
      this.hasSelectedSession &&
      this.currentSessionStore!.session.sessionTag === sessionTag
    )
  }

  public async saveNewSessionWithMessage(
    session: ISession,
    firstMessage: IMessage,
    addMessageOptions?: IAddMessageOptions,
  ) {
    await this.sessionsDB.addSession(session, firstMessage, addMessageOptions)

    const newSession = await getDatabases().sessionsDB.getSession(
      session.sessionTag,
      session.userAddress,
    )
    if (newSession == null) {
      throw new Error('fail to save session')
    }

    this.addSession(newSession)
  }

  public async deleteSession(session: ISession) {
    // TODO: maybe we should move these logic into db
    const { sessionsDB } = this
    const sessionInDB = await sessionsDB.getSession(session.sessionTag, session.userAddress)
    if (sessionInDB == null) {
      return
    }

    await sessionsDB.deleteSession(session)
    this.removeSession(session)
  }

  public getSessionStore(session: ISession): SessionStore {
    const { sessionTag } = session
    const oldStore = this.cachedSessionStores[sessionTag]
    if (oldStore != null) {
      return oldStore
    }

    const newStore = new SessionStore(
      session,
      this,
      this.userStore,
      this.contractStore,
    )
    this.cachedSessionStores[sessionTag] = newStore
    return newStore
  }

  public removeCachedSessionStore(sessionStore: SessionStore) {
    delete this.cachedSessionStores[sessionStore.session.sessionTag]
  }

  public clearCachedSessionStores() {
    for (const sessionStore of Object.values(this.cachedSessionStores)) {
      // clear message stores
      sessionStore.disposeStore()
    }
  }

  /**
   * dispose this store and sub-stores
   * clean up side effect and caches
   */
  public disposeStore() {
    this.clearCachedSessionStores()
  }

  @action
  public async selectSession(session: ISession) {
    const newSessionStore = this.getSessionStore(session)

    const { currentSessionStore } = this
    if (currentSessionStore != null && currentSessionStore.session.meta.isNewSession) {
      // remove new created conversation
      this.removeSession(currentSessionStore.session)
    }

    this.currentSessionStore = newSessionStore

    await newSessionStore.loadNewMessages()
  }

  @action
  public sortSessions() {
    this.sessions.sort(
      (sessionA, sessionB) => {
        if (sessionA.meta.isNewSession) {
          // stick to top
          return -1
        }
        return sessionA.meta.lastUpdate > sessionB.meta.lastUpdate ? -1 : 1
      },
    )
    this.sessions = this.sessions.slice()
  }

  @action
  public unselectSession() {
    this.currentSessionStore = undefined
  }

  @action
  public addSession(session: ISession) {
    this.sessions = [session].concat(this.sessions)
  }

  @action
  public removeSession(session: ISession) {
    const remainSessions = this.sessions.filter(
      (_session) => session.sessionTag !== _session.sessionTag,
    )
    this.sessions = remainSessions

    if (this.isCurrentSession(session.sessionTag)) {
      this.unselectSession()
    }
  }
}
