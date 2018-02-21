import {
  observable,
  action,
  runInAction,
  computed,
} from 'mobx'
import {
  SessionStore,
  ISession,
} from './SessionStore'
import {
  UserStore,
} from './UserStore'

import {
  getDatabases,
} from '../databases'
import {
  ICreateSessionArgs,
  SessionsDB,
} from '../databases/SessionsDB'

export class SessionsStore {
  @observable.ref public sessions: ISession[] = []
  @observable.ref public currentSessionStore: SessionStore | undefined
  @observable public isLoadingSessions = false
  @observable public isSwitchingSession = false
  @observable public isLoaded = false

  private sessionsDB: SessionsDB
  private userStore: UserStore
  private cachedSessionStores: {
    [primaryKey: string]: SessionStore,
  } = {}

  @computed
  public get hasSelectedSession() {
    return typeof this.currentSessionStore !== 'undefined'
  }

  constructor({
    userStore,
  }: {
      userStore: UserStore,
    }) {
    this.userStore = userStore
    this.sessionsDB = getDatabases().sessionsDB
  }

  public isCurrentSession = (userAddress: string, sessionTag: string) => {
    return (
      this.hasSelectedSession
      && this.currentSessionStore!.session.userAddress === userAddress
      && this.currentSessionStore!.session.sessionTag === sessionTag
    )
  }

  public loadSessions = async () => {
    if (!this.isLoaded) {
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
  }

  public createSession = async (args: ICreateSessionArgs) => {
    const { user } = this.userStore

    const session = await this.sessionsDB.createSession(
      user,
      args,
    )
    this.addSession(session)
    return session
  }

  public deleteSession = async (session: ISession) => {
    await this.sessionsDB.deleteSession(session)
    this.removeSession(session)
  }

  public getSessionStore = (session: ISession): SessionStore => {
    const primaryKey = `${session.userAddress}${session.sessionTag}`
    let store = this.cachedSessionStores[primaryKey]
    if (typeof store === 'undefined') {
      store = new SessionStore(session, {
        sessionsStore: this,
      })
      this.cachedSessionStores[primaryKey] = store
    }
    return store
  }

  @action
  public sortSessions = () => {
    this.sessions.sort((sessionA, sessionB) => sessionA.lastUpdate > sessionB.lastUpdate ? -1 : 1)
    this.sessions = this.sessions.slice()
  }

  @action
  public selectSession = async (session: ISession) => {
    const currentSessionStore = this.getSessionStore(session)
    this.isSwitchingSession = true
    await currentSessionStore.loadNewMessages()
    runInAction(() => {
      this.currentSessionStore = currentSessionStore
      this.isSwitchingSession = false
    })
  }

  @action
  public unselectSession = () => {
    this.currentSessionStore = undefined
  }

  @action
  private addSession = (session: ISession) => {
    this.sessions = [session].concat(this.sessions)
  }

  @action
  private removeSession = (session: ISession) => {
    const remainSessions = this.sessions = this.sessions.filter(
      (_session) => session.sessionTag !== _session.sessionTag,
    )

    if (this.isCurrentSession(session.userAddress, session.sessionTag)) {
      this.unselectSession()
      if (remainSessions.length > 0) {
        this.selectSession(remainSessions[0])
      }
    }
  }
}
