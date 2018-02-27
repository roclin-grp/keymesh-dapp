import {
  observable,
  action,
  runInAction,
  computed,
} from 'mobx'
import {
  SessionStore,
} from './SessionStore'
import {
  UserStore,
} from './UserStore'

import {
  getDatabases,
} from '../databases'
import {
  SessionsDB,
  ISession,
} from '../databases/SessionsDB'
import { IMessage, IAddMessageOptions } from '../databases/MessagesDB'

export class SessionsStore {
  @observable.ref public sessions: ISession[] = []
  @observable.ref public currentSessionStore: SessionStore | undefined
  @observable public isLoadingSessions = false
  @observable public isSwitchingSession = false
  @observable public isLoaded = false

  private sessionsDB: SessionsDB
  private cachedSessionStores: {
    [sessionTag: string]: SessionStore,
  } = {}

  @computed
  public get hasSelectedSession(): boolean {
    return this.currentSessionStore != null
  }

  constructor(private userStore: UserStore) {
    this.sessionsDB = getDatabases().sessionsDB
  }

  public isCurrentSession(sessionTag: string): boolean {
    return (
      this.hasSelectedSession
      && this.currentSessionStore!.session.sessionTag === sessionTag
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

  public async saveSession(
    session: ISession,
    firstMessage?: IMessage,
    addMessageOptions?: IAddMessageOptions,
  ) {
    await this.sessionsDB.addSession(
      session,
      firstMessage,
      addMessageOptions,
    )

    this.addSession(session)
  }

  public async deleteSession(session: ISession) {
    await this.sessionsDB.deleteSession(session)
    this.removeSession(session)
  }

  public getSessionStore(session: ISession): SessionStore {
    const { sessionTag } = session
    const oldStore = this.cachedSessionStores[sessionTag]
    if (oldStore != null) {
      return oldStore
    }

    const newStore = new SessionStore(session, this)
    this.cachedSessionStores[sessionTag] = newStore
    return newStore
  }

  public clearCachedStores() {
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
    this.sessions.sort((sessionA, sessionB) => sessionA.meta.lastUpdate > sessionB.meta.lastUpdate ? -1 : 1)
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

  @action
  private addSession(session: ISession) {
    this.sessions = [session].concat(this.sessions)
  }

  @action
  private removeSession(session: ISession) {
    const remainSessions = this.sessions = this.sessions.filter(
      (_session) => session.sessionTag !== _session.sessionTag,
    )

    if (this.isCurrentSession(session.sessionTag)) {
      this.unselectSession()
      if (remainSessions.length > 0) {
        this.selectSession(remainSessions[0])
      }
    }
  }
}
