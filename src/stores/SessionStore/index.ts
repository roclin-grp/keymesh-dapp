import {
  observable,
  runInAction,
  action,
  observe,
  computed,
  Lambda,
  IValueDidChange,
} from 'mobx'

import ChatContext from './ChatContext'

import { ContractStore } from '../ContractStore'
import { UserStore } from '../UserStore'
import { SessionsStore } from '../SessionsStore'
import { ChatMessageStore } from '../ChatMessageStore'

import { getDatabases } from '../../databases'
import { IUpdateSessionOptions, ISession, SessionsDB, ISessionConfigurableMeta } from '../../databases/SessionsDB'
import { IAddMessageOptions, IMessage, MessagesDB } from '../../databases/MessagesDB'

import { sleep } from '../../utils'

export class SessionStore {
  @observable public readonly session: ISession
  @observable.ref public messages: IMessage[] = []
  @observable public isLoadingOldMessages = false
  @observable public newUnreadCount = 0
  @observable public draftMessage = ''
  public readonly chatContext: ChatContext

  public isLoading = false
  private readonly sessionRef: ISession
  private readonly messagesDB: MessagesDB
  private readonly sessionsDB: SessionsDB
  private readonly cachedChatMessageStores: { [messageID: string]: ChatMessageStore } = {}

  private isClearing = false
  private shouldAddUnread = true

  @computed
  public get isCurrentSession(): boolean {
    return this.sessionsStore.isCurrentSession(this.session.sessionTag)
  }

  @computed
  public get isDisabled(): boolean {
    return this.userStore.isDisabled
  }

  constructor(
    session: ISession,
    private readonly sessionsStore: SessionsStore,
    private readonly userStore: UserStore,
    private readonly contractStore: ContractStore,
  ) {
    this.session = this.sessionRef = session
    const { messagesDB, sessionsDB } = getDatabases()
    this.messagesDB = messagesDB
    this.sessionsDB = sessionsDB
    this.chatContext = new ChatContext(userStore, this, contractStore)
  }

  @action
  public setDraft(message: string) {
    this.draftMessage = message
  }

  public setShouldAddUnread(value: boolean) {
    this.shouldAddUnread = value
  }

  public async refreshMemorySession() {
    const session = await this.sessionsDB.getSession(
      this.session.sessionTag,
      this.session.userAddress,
    )
    if (session != null) {
      this.updateMemorySession(session)
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

  public async waitForMessagesLoading(interval = 300) {
    while (this.isLoading) {
      await sleep(interval)
    }
  }

  // TODO: refactor
  public async loadNewMessages(limit?: number) {
    if (this.isLoading) {
      return
    }

    const loadedMessagesCount = this.messages.length
    const hasMessages = loadedMessagesCount > 0
    const lastMessageTimestamp = hasMessages
      ? this.messages[loadedMessagesCount - 1].data.timestamp
      : 0

    if (lastMessageTimestamp === this.session.meta.lastUpdate) {
      // no new messages
      return
    }

    this.isLoading = true
    const newMessages = await this.messagesDB.getMessagesOfSession(this.session, {
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

    if (newMessagesCount > 0) {
      this.appendMessages(newMessages)
    }
    this.isLoading = false
  }

  public async loadOldMessages(limit?: number) {
    const messagesLength = this.messages.length
    if (messagesLength === 0) {
      return
    }

    runInAction(() => {
      this.isLoadingOldMessages = true
    })
    const oldMessages = await this.messagesDB.getMessagesOfSession(this.session, {
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

  /**
   * new conversation
   * save new created session with first message to db
   */
  @action
  public async saveSessionWithMessage(
    firstMessage: IMessage,
    addMessageOptions?: IAddMessageOptions,
  ) {
    this.session.meta.isNewSession = undefined
    await this.sessionsDB.addSession(this.session, firstMessage, {
      ...addMessageOptions,
      shouldAddUnread: false,
    })

    this.addMessage(firstMessage)
  }

  public async saveMessage(message: IMessage, options?: IAddMessageOptions) {
    await this.messagesDB.addMessage(this.session, message, {
      shouldAddUnread: this.shouldAddUnread,
      ...options,
    })

    await this.addMessage(message)
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
      this.isClearing = false
    }
  }

  public async clearUnread() {
    await this.updateSession({
      unreadCount: 0,
    })
  }

  public getMessageStore(message: IMessage): ChatMessageStore {
    const { messageID } = message

    const oldStore = this.cachedChatMessageStores[messageID]
    if (oldStore != null) {
      return oldStore
    }

    const newStore = new ChatMessageStore(this, message, this.contractStore)
    this.cachedChatMessageStores[messageID] = newStore
    return newStore
  }

  public removeCachedChatMessageStore(messageStore: ChatMessageStore) {
    delete this.cachedChatMessageStores[messageStore.messageID]
  }

  public clearCachedChatMessageStores() {
    for (const messageStore of Object.values(this.cachedChatMessageStores)) {
      messageStore.disposeStore()
    }
  }

  public disposeStore() {
    this.clearCachedChatMessageStores()
    this.sessionsStore.removeCachedSessionStore(this)
  }

  public async deleteSession() {
    this.disposeStore()

    if (this.session.meta.isNewSession) {
      this.sessionsStore.removeSession(this.session)
      return
    }

    await this.sessionsStore.deleteSession(this.session)
  }

  private async updateSession(args: IUpdateSessionOptions) {
    const session = await this.sessionsDB.updateSession(this.session, args)
    this.updateMemorySession(session)
  }

  @action
  private updateMemorySession(session: ISession) {
    const {
      meta,
      data,
    } = session

    // set new conversation flag to false
    const extraMeta: ISessionConfigurableMeta = { isNewSession: false }

    Object.assign(this.session.meta, meta, extraMeta)
    Object.assign(this.session.data, data)
    Object.assign(this.sessionRef.meta, meta, extraMeta)
    Object.assign(this.sessionRef.data, data)

    this.sessionsStore.sortSessions()
  }

  @action
  private async addMessage(message: IMessage) {
    if (this.isCurrentSession) {
      this.messages = this.messages.concat(message)
      if (!message.meta.isFromYourself && this.shouldAddUnread) {
        this.newUnreadCount++
      }
    }

    await this.refreshMemorySession()
  }

  @action
  private appendMessages(messages: IMessage[]) {
    this.messages = this.messages.concat(messages)
  }
}
