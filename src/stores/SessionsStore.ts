import {
  observable,
  action,
  runInAction,
} from 'mobx'
import {
  SessionStore,
  Isession,
} from './SessionStore'
import {
  UserStore,
} from './UserStore'

import DB from '../DB'

export class SessionsStore {
  @observable.ref public sessions: Isession[] = []
  @observable.ref public currentSessionStore: SessionStore | undefined
  @observable public isLoading = false

  constructor({
    db,
    userStore,
  }: {
    db: DB
    userStore: UserStore
  }) {
    this.db = db
    this.userStore = userStore
  }

  private db: DB
  private userStore: UserStore

  public loadSessions = async () => {
    runInAction(() => {
      this.isLoading = true
    })
    const sessions = await this.db.getSessions(this.userStore.user)
    runInAction(() => {
      this.sessions = sessions
      if (sessions.length > 0) {
        this.selectSession(sessions[0])
      }
      this.isLoading = false
    })
  }

  public deleteSession = async (session: Isession) => {
    await this.db.deleteSession(this.userStore.user, session)
    this.removeSession(session)
  }

  @action
  public selectSession = async (session: Isession) => {
    this.currentSessionStore = new SessionStore(session, {
      db: this.db,
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
  private removeSession = (session: Isession) => {
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
