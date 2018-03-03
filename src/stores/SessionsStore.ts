import { observable, action, runInAction, computed } from 'mobx'

import { MetaMaskStore } from './MetaMaskStore'
import { ContractStore } from './ContractStore'
import { getUserPublicKey } from './UsersStore'
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

export class SessionsStore {
  @observable.ref public sessions: ISession[] = []
  @observable.ref public currentSessionStore: SessionStore | undefined
  @observable public isSwitchingSession = false

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
    private readonly metaMaskStore: MetaMaskStore,
    private readonly contractStore: ContractStore,
  ) {
    this.sessionsDB = getDatabases().sessionsDB
    if (userStore.isRegisterCompleted) {
      this.loadSessions()
    }
  }

  public async tryCreateNewSession(receiverAddress: string, subject?: string): Promise<ISession> {
    const existedSession = this.sessions.find((session) => session.data.contact === receiverAddress)
    if (existedSession != null) {
      return existedSession
    }

    this.validateReceiver(receiverAddress)

    const sessionData: ISessionData = {
      contact: receiverAddress,
      subject,
    }
    const newSession = createSession(this.userStore.user, sessionData, undefined, { isNewSession: true })
    return newSession
  }

  public async loadSessions() {
    const sessions = await this.sessionsDB.getSessions(this.userStore.user)

    runInAction(() => {
      this.sessions = sessions
      if (sessions.length > 0) {
        this.selectSession(sessions[0])
      }
    })
  }

  public isCurrentSession(sessionTag: string): boolean {
    return (
      this.hasSelectedSession &&
      this.currentSessionStore!.session.sessionTag === sessionTag
    )
  }

  public async saveNewSession(
    session: ISession,
    firstMessage?: IMessage,
    addMessageOptions?: IAddMessageOptions,
  ) {
    await this.sessionsDB.addSession(session, firstMessage, addMessageOptions)
    this.addSession(session)
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
      this.metaMaskStore,
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
    const currentSessionStore = this.getSessionStore(session)
    await currentSessionStore.loadNewMessages()
    runInAction(() => {
      this.currentSessionStore = currentSessionStore
    })
  }

  @action
  public sortSessions() {
    this.sessions.sort(
      (sessionA, sessionB) =>
        sessionA.meta.lastUpdate > sessionB.meta.lastUpdate ? -1 : 1,
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
      if (remainSessions.length > 0) {
        this.selectSession(remainSessions[0])
      }
    }
  }

  private async validateReceiver(receiverAddress: string) {
        // TODO: should cache public keys
    // try to get user's public key
    const publicKey = await getUserPublicKey(receiverAddress, this.contractStore)
    // try to get user's pre-keys
    await getPreKeysPackage(receiverAddress, publicKey)
  }
}
