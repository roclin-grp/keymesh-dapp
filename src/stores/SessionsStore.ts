import {
  observable,
  action,
  runInAction,
} from 'mobx'
import {
  SessionStore,
  ISession,
} from './SessionStore'
import {
  UserStore,
} from './UserStore'

import {
  Databases,
} from '../databases'

export class SessionsStore {
  @observable.ref public sessions: ISession[] = []
  @observable.ref public currentSessionStore: SessionStore | undefined
  @observable public isLoading = false

  constructor({
    databases,
    userStore,
  }: {
    databases: Databases
    userStore: UserStore
  }) {
    this.databases = databases
    this.userStore = userStore
  }

  private databases: Databases
  private userStore: UserStore

  public loadSessions = async () => {
    runInAction(() => {
      this.isLoading = true
    })
    const sessions = await this.databases.sessionsDB.getSessions(this.userStore.user)
    runInAction(() => {
      this.sessions = sessions
      if (sessions.length > 0) {
        this.selectSession(sessions[0])
      }
      this.isLoading = false
    })
  }

  public deleteSession = async (session: ISession) => {
    await this.databases.sessionsDB.deleteSession(session)
    this.removeSession(session)
  }

  @action
  public selectSession = async (session: ISession) => {
    this.currentSessionStore = new SessionStore(session, {
      databases: this.databases,
      userStore: this.userStore
    })
  }

  // @action
  // private addSession = (session: Isession) => {
  //   this.sessions.unshift(session)
  //   this.sessions = this.sessions.slice()
  //   this.selectSession(session)
  // }

  @action
  private removeSession = (session: ISession) => {
    const remainSessions = this.sessions = this.sessions.filter(
      (_session) => session.sessionTag !== _session.sessionTag
    )

    if (
      typeof this.currentSessionStore !== 'undefined'
      && this.currentSessionStore.session.sessionTag === session.sessionTag
    ) {
      this.unsetSession()
      if (remainSessions.length > 0) {
        this.selectSession(remainSessions[0])
      }
    }
  }

  @action
  private unsetSession = () => {
    delete this.currentSessionStore
  }
}
