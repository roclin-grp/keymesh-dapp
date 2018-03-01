import {
  observable,
  runInAction,
  action,
  reaction,
  observe,
  computed,
  Lambda,
  IValueDidChange,
} from 'mobx'

import ChatContext from './ChatContext'

import { MetaMaskStore } from '../MetaMaskStore'
import { ContractStore } from '../ContractStore'
import { UserStore } from '../UserStore'
import { SessionsStore } from '../SessionsStore'
import { ChatMessageStore } from '../ChatMessageStore'

import { getDatabases } from '../../databases'
import { IUpdateSessionOptions, ISession } from '../../databases/SessionsDB'
import { IAddMessageOptions, IMessage } from '../../databases/MessagesDB'

export class SessionStore {
  @observable public readonly session: ISession
  @observable.ref public messages: IMessage[] = []
  @observable public isLoading = true
  @observable public isLoadingOldMessages = false
  @observable public newUnreadCount = 0
  @observable public draftMessage = ''
  public readonly chatContext: ChatContext

  private readonly sessionRef: ISession

  private cachedMessageStores: { [messageID: string]: ChatMessageStore } = {}
  private isClearing = false
  private shouldAddUnread = true

  @computed
  public get isCurrentSession(): boolean {
    return this.sessionsStore.isCurrentSession(this.session.sessionTag)
  }

  constructor(
    session: ISession,
    private readonly sessionsStore: SessionsStore,
    userStore: UserStore,
    private readonly metaMaskStore: MetaMaskStore,
    contractStore: ContractStore,
  ) {
    this.session = this.sessionRef = session
    this.chatContext = new ChatContext(userStore, this, contractStore)

    reaction(
      () =>
        ({
          lastUpdate: this.session.meta.lastUpdate,
          isClosed: this.session.meta.isClosed,
          unreadCount: this.session.meta.unreadCount,
          summary: this.session.data.summary,
        } as IUpdateSessionOptions),
      (observableUserData) => {
        Object.assign(this.sessionRef, observableUserData)
      },
    )
  }

  @action
  public setDraft(message: string) {
    this.draftMessage = message
  }

  public setShouldAddUnread(value: boolean) {
    this.shouldAddUnread = value
  }

  public async refreshMemorySession() {
    const session = await getDatabases().sessionsDB.getSession(
      this.session.sessionTag,
      this.session.userAddress,
    )
    if (session != null) {
      this.updateMemorySession(session.meta)
      this.sessionsStore.sortSessions()
    }
  }

  public listenForNewMessage(listener: () => void): Lambda {
    return observe(
      this.session.meta,
      'lastUpdate',
      ({ oldValue, newValue }: IValueDidChange<ISession['meta']['lastUpdate']>) => {
        if (oldValue == null || newValue > oldValue) {
          listener()
        }
      },
    )
  }

  public async loadNewMessages(limit?: number) {
    const loadedMessagesCount = this.messages.length
    const hasMessages = loadedMessagesCount > 0
    const lastMessageTimestamp = hasMessages
      ? this.messages[loadedMessagesCount - 1].data.timestamp
      : 0
    if (lastMessageTimestamp === this.session.meta.lastUpdate) {
      // no new messages
      return
    }

    const { messagesDB } = getDatabases()
    runInAction(() => {
      this.isLoading = true
    })
    const newMessages = await messagesDB.getMessagesOfSession(this.session, {
      timestampAfter: lastMessageTimestamp + 1,
      limit,
    })
    const newMessagesCount = newMessages.length
    const previousUnreadCount = this.session.meta.unreadCount

    if (previousUnreadCount > 0) {
      let unreadCount = previousUnreadCount - newMessagesCount
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

  public async loadOldMessages(limit?: number) {
    const messagesLength = this.messages.length
    if (messagesLength === 0) {
      return
    }

    const { messagesDB } = getDatabases()
    runInAction(() => {
      this.isLoadingOldMessages = true
    })
    const oldMessages = await messagesDB.getMessagesOfSession(this.session, {
      timestampBefore: this.messages[messagesLength - 1].data.timestamp,
      limit,
    })
    const oldMessagesCount = oldMessages.length
    const previousUnreadCount = this.session.meta.unreadCount

    if (previousUnreadCount > 0) {
      let unreadCount = previousUnreadCount - oldMessagesCount
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

  public async saveMessage(message: IMessage, options?: IAddMessageOptions) {
    await getDatabases().messagesDB.addMessage(this.session, message, {
      shouldAddUnread: this.shouldAddUnread,
      ...options,
    })

    this.addMessage(message)
  }

  public async clearNewUnreadCount() {
    const { newUnreadCount } = this
    if (!this.isClearing && newUnreadCount > 0) {
      this.isClearing = true
      await this.updateSession({
        unreadCount: this.session.meta.unreadCount - newUnreadCount,
      })
      runInAction(() => {
        this.newUnreadCount = this.newUnreadCount - newUnreadCount
      })
    }
  }

  public async clearUnread() {
    await this.updateSession({
      unreadCount: 0,
    })
  }

  public getMessageStore(message: IMessage): ChatMessageStore {
    const { messageID } = message

    const oldStore = this.cachedMessageStores[messageID]
    if (oldStore != null) {
      return oldStore
    }

    const newStore = new ChatMessageStore(message, this.metaMaskStore)
    this.cachedMessageStores[messageID] = newStore
    return newStore
  }

  public clearCachedStores() {
    this.cachedMessageStores = {}
  }

  public disposeStore() {
    this.sessionsStore.disposeSessionStore(this.session)
  }

  public async deleteSession() {
    this.disposeStore()
    await this.sessionsStore.deleteSession(this.session)
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
  private addMessage(message: IMessage) {
    if (this.isCurrentSession) {
      this.messages = this.messages.concat(message)
      if (!message.meta.isFromYourself && this.shouldAddUnread) {
        this.newUnreadCount++
      }
    }

    this.refreshMemorySession()
  }
}
