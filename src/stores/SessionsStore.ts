import { observable, action, runInAction, computed } from 'mobx'

import { MetaMaskStore } from './MetaMaskStore'
import { ContractStore } from './ContractStore'
import { getUserPublicKey } from './UsersStore'
import { UserStore } from './UserStore'
import { SessionStore } from './SessionStore'
import { IChatMessage } from './ChatMessageStore'

import { getDatabases } from '../databases'
import {
  SessionsDB,
  ISession,
  createSession,
  ISessionData,
} from '../databases/SessionsDB'
import { IMessage, IAddMessageOptions } from '../databases/MessagesDB'

export class SessionsStore {
  @observable.ref public sessions: ISession[] = []
  @observable.ref public currentSessionStore: SessionStore | undefined
  @observable public isLoadingSessions = false
  @observable public isSwitchingSession = false
  @observable public isLoaded = false

  private readonly sessionsDB: SessionsDB
  private cachedSessionStores: {
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
  }

  public isCurrentSession(sessionTag: string): boolean {
    return (
      this.hasSelectedSession &&
      this.currentSessionStore!.session.sessionTag === sessionTag
    )
  }

  public async loadSessions() {
    if (this.isLoaded) {
      return
    }

    runInAction(() => {
      this.isLoadingSessions = true
    })

    const sessions = await this.sessionsDB.getSessions(this.userStore.user)
    this.cachedSessionStores = {}

    runInAction(() => {
      this.sessions = sessions
      this.isLoadingSessions = false
      if (sessions.length > 0) {
        this.selectSession(sessions[0])
      }
      this.isLoaded = true
    })
  }

  public async tryCreateNewSession(receiverAddress: string, subject?: string) {
    const existedSession = this.sessions.find((session) => session.data.contact === receiverAddress)
    if (existedSession != null) {
      // jump to exist session
      await this.selectSession(existedSession)
      return
    }

    // TODO: should cache public keys
    // try to get user public key
    await getUserPublicKey(receiverAddress, this.contractStore)

    const sessionData: ISessionData = {
      contact: receiverAddress,
      subject,
    }

    // create and select session
    const newSession = createSession(this.userStore.user, sessionData, undefined, { isNewSession: true })
    this.addSession(newSession)
    this.selectSession(newSession)
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

  public clearCachedStores() {
    for (const sessionStore of Object.values(this.cachedSessionStores)) {
      // clear message stores
      sessionStore.clearCachedStores()
    }
    this.cachedSessionStores = {}
  }

  public disposeSessionStore(session: ISession) {
    const { sessionTag } = session
    const oldStore = this.cachedSessionStores[sessionTag]
    if (oldStore == null) {
      return
    }

    delete this.cachedSessionStores[sessionTag]
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
  public async selectSession(session: ISession) {
    const currentSessionStore = this.getSessionStore(session)
    this.isSwitchingSession = true
    await currentSessionStore.loadNewMessages()
    runInAction(() => {
      this.currentSessionStore = currentSessionStore
      this.isSwitchingSession = false
    })
  }

  @action
  public unselectSession() {
    this.currentSessionStore = undefined
  }

  public async saveMessage(
    chatMessage: IChatMessage,
    saveMessageOptions?: IAddMessageOptions,
  ) {
    const { session, message } = chatMessage
    const oldSession = await getDatabases().sessionsDB.getSession(
      session.sessionTag,
      session.userAddress,
    )

    if (oldSession == null) {
      await this.saveSession(
        session,
        message,
        saveMessageOptions,
      )
      return
    }

    await this.getSessionStore(oldSession).saveMessage(message, saveMessageOptions)
  }

  @action
  private addSession(session: ISession) {
    this.sessions = [session].concat(this.sessions)
  }

  @action
  private removeSession(session: ISession) {
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

  private async saveSession(
    session: ISession,
    firstMessage?: IMessage,
    addMessageOptions?: IAddMessageOptions,
  ) {
    await this.sessionsDB.addSession(session, firstMessage, addMessageOptions)

    if (session.meta.isNewSession) {
      // is a local new session
      // we already add this session, need reload data
      await this.getSessionStore(session).refreshMemorySession()
      return
    }

    this.addSession(session)
  }
}
