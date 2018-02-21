import {
  observable,
  runInAction,
  action,
  reaction,
  observe,
  computed,
  Lambda,
} from 'mobx'
import {
  IUserIdentityKeys,
  IContact,
} from './UserStore'
import {
  IMessage,
} from './ChatMessageStore'
import {
  SessionsStore,
} from './SessionsStore'

import {
  getDatabases,
} from '../databases'
import {
  IUpdateSessionOptions,
} from '../databases/SessionsDB'
import {
  ICreateMessageArgs,
} from '../databases/MessagesDB'

import { sha3 } from 'trustbase'

export class SessionStore {
  @observable public session: ISession
  @observable.ref public messages: IMessage[] = []
  @observable public isLoading = true
  @observable public isLoadingOldMessages = false
  @observable public newUnreadCount = 0
  @observable public draftMessage = ''

  @computed
  public get isCurrentSession() {
    return this.sessionsStore.isCurrentSession(this.session.userAddress, this.session.sessionTag)
  }

  constructor(session: ISession, {
    sessionsStore,
  }: {
    sessionsStore: SessionsStore,
  }) {
    this.session = this.sessionRef = session
    this.sessionsStore = sessionsStore

    reaction(
      () => ({
        lastUpdate: this.session.lastUpdate,
        isClosed: this.session.isClosed,
        unreadCount: this.session.unreadCount,
        summary: this.session.summary,
      }) as IUpdateSessionOptions,
      (observableUserData) => {
        Object.assign(this.sessionRef, observableUserData)
      })
  }

  private sessionRef: ISession
  private sessionsStore: SessionsStore
  private isClearing = false
  private shouldAddUnread = true

  @action
  public setDraft(message: string) {
    this.draftMessage = message
  }

  public setShouldAddUnread(value: boolean) {
    this.shouldAddUnread = value
  }

  public refreshMemorySession = async (): Promise<void> => {
    const session = await getDatabases().sessionsDB.getSession(this.session.sessionTag, this.session.userAddress)
    if (typeof session !== 'undefined') {
      this.updateMemorySession(session)
      this.sessionsStore.sortSessions()
    }
  }

  public listenForNewMessage = (listener: () => void): Lambda => {
    return observe(
      this.session,
      'lastUpdate',
      ({
        newValue,
        oldValue,
      }) => {
        if (newValue > oldValue) {
          listener()
        }
      },
    )
  }

  public static getAvatarHashByContact = (contract: IContact) => {
    return sha3(`${contract.userAddress}${contract.blockHash}`)
  }

  public loadNewMessages = async (limit?: number) => {
    const loadedMessagesCount = this.messages.length
    const hasMessages = loadedMessagesCount > 0
    const lastMessageTimestamp = hasMessages ? this.messages[loadedMessagesCount - 1].timestamp : 0
    if (lastMessageTimestamp === this.session.lastUpdate) {
      // no new messages
      return
    }

    const {
      messagesDB,
    } = getDatabases()
    runInAction(() => {
      this.isLoading = true
    })
    const newMessages = await messagesDB.getMessagesOfSession(this.session, {
      timestampAfter: lastMessageTimestamp + 1,
      limit,
    })
    const newMessagesCount = newMessages.length
    const previousUnreadCount = this.session.unreadCount

    if (previousUnreadCount > 0) {
      let unreadCount = this.session.unreadCount - newMessagesCount
      if (unreadCount < 0) {
        unreadCount = 0
      }

      await this.updateSession({
        unreadCount,
      })
    }

    runInAction(() => {
      if (newMessagesCount > 0) {
        this.messages = this.messages.concat(newMessages)
      }
      this.isLoading = false
    })
  }

  public loadOldMessages = async (limit?: number) => {
    const messagesLength = this.messages.length
    if (messagesLength === 0) {
       return
    }

    const {
      messagesDB,
    } = getDatabases()
    runInAction(() => {
      this.isLoadingOldMessages = true
    })
    const oldMessages = await messagesDB.getMessagesOfSession(this.session, {
      timestampBefore: this.messages[messagesLength - 1].timestamp,
      limit,
    })
    const oldMessagesCount = oldMessages.length
    const previousUnreadCount = this.session.unreadCount

    if (previousUnreadCount > 0) {
      let unreadCount = this.session.unreadCount - oldMessagesCount
      if (unreadCount < 0) {
        unreadCount = 0
      }

      await this.updateSession({
        unreadCount,
      })
    }

    runInAction(() => {
      if (oldMessages.length > 0) {
        this.messages = oldMessages.concat(this.messages)
      }
      this.isLoadingOldMessages = false
    })
  }

  public createMessage = async (args: ICreateMessageArgs) => {
    const message = await getDatabases().messagesDB.createMessage(
      this.session,
      Object.assign<{shouldAddUnread: ICreateMessageArgs['shouldAddUnread']}, ICreateMessageArgs>(
        {
          shouldAddUnread: this.shouldAddUnread,
        },
        args,
      ),
    )

    this.addMessage(message)
    return message
  }

  public clearNewUnreadCount = async () => {
    const {newUnreadCount} = this
    if (!this.isClearing && newUnreadCount > 0) {
      this.isClearing = true
      await this.updateSession({
        unreadCount: this.session.unreadCount - newUnreadCount,
      })
      runInAction(() => {
        this.newUnreadCount = this.newUnreadCount - newUnreadCount
      })
    }
  }

  public clearUnread = () => {
    return this.updateSession({
      unreadCount: 0,
    })
  }

  private async updateSession(args: IUpdateSessionOptions) {
    await getDatabases().sessionsDB.updateSession(this.session, args)
    this.updateMemorySession(args)
  }

  @action
  private updateMemorySession(args: IUpdateSessionOptions) {
    Object.assign(this.session, args)
  }

  @action
  private addMessage = (message: IMessage) => {
    if (this.isCurrentSession) {
      this.messages = this.messages.concat(message)
      if (!message.isFromYourself && this.shouldAddUnread) {
        this.newUnreadCount++
      }
    }

    this.refreshMemorySession()
    return this.messages
  }
}

export interface ISession extends IUserIdentityKeys {
  sessionTag: string
  lastUpdate: number
  contact: IContact
  subject: string
  isClosed: boolean
  unreadCount: number
  summary: string
}
