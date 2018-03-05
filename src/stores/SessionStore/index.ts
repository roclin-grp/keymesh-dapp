import {
  observable,
  runInAction,
  action,
  reaction,
  observe,
  computed,
  Lambda,
  IValueDidChange,
  IReactionDisposer,
} from 'mobx'

import ChatContext from './ChatContext'

import { ContractStore } from '../ContractStore'
import { UserStore } from '../UserStore'
import { SessionsStore } from '../SessionsStore'
import { ChatMessageStore } from '../ChatMessageStore'

import { getDatabases } from '../../databases'
import { IUpdateSessionOptions, ISession } from '../../databases/SessionsDB'
import { IAddMessageOptions, IMessage } from '../../databases/MessagesDB'

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
  private readonly disposeUpdateSessionReaction: IReactionDisposer
  private readonly cachedChatMessageStores: { [messageID: string]: ChatMessageStore } = {}

  private isClearing = false
  private shouldAddUnread = true

  @computed
  public get isCurrentSession(): boolean {
    return this.sessionsStore.isCurrentSession(this.session.sessionTag)
  }

  @computed
  private get updateableSessionData(): IUpdateSessionOptions {
    return {
      lastUpdate: this.session.meta.lastUpdate,
      isClosed: this.session.meta.isClosed,
      unreadCount: this.session.meta.unreadCount,
      summary: this.session.data.summary,
    }
  }

  constructor(
    session: ISession,
    private readonly sessionsStore: SessionsStore,
    userStore: UserStore,
    private readonly contractStore: ContractStore,
  ) {
    this.session = this.sessionRef = session
    this.chatContext = new ChatContext(userStore, this, contractStore)

    this.disposeUpdateSessionReaction = reaction(
      () => this.updateableSessionData,
      this.updateReferenceSession.bind(this),
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
      this.updateMemorySession({
        summary: session.data.summary,
        lastUpdate: session.meta.lastUpdate,
        isClosed: session.meta.isClosed,
        unreadCount: session.meta.unreadCount,
      })
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
    const { messagesDB } = getDatabases()
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

  /**
   * new conversation
   * save new created session with first message to db
   */
  public async saveSessionWithMessage(
    firstMessage: IMessage,
    addMessageOptions?: IAddMessageOptions,
  ) {
    const { sessionsDB } = getDatabases()
    await sessionsDB.addSession(this.session, firstMessage, {
      ...addMessageOptions,
      shouldAddUnread: false,
    })

    this.addMessage(firstMessage)
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
    this.disposeUpdateSessionReaction()
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
    await getDatabases().sessionsDB.updateSession(this.session, args)
    this.updateMemorySession(args)
  }

  private updateReferenceSession(args: IUpdateSessionOptions) {
    this.updateSessionOrRefSession(args, true)
  }

  private updateMemorySession(args: IUpdateSessionOptions) {
    this.updateSessionOrRefSession(args)
    this.sessionsStore.sortSessions()
  }

  @action
  private updateSessionOrRefSession(args: IUpdateSessionOptions, ref = false) {
    const oldSummary = ref ? this.sessionRef.data.summary : this.session.data.summary
    const {
      // if we don't use oldSummary as defaul, will set summary to undefined..
      summary = oldSummary,
      ...meta,
    } = args
    const data = {
      summary,
    }

    Object.assign(ref ? this.sessionRef.meta : this.session.meta, meta)
    Object.assign(ref ? this.sessionRef.data : this.session.data, data)
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

  @action
  private appendMessages(messages: IMessage[]) {
    this.messages = this.messages.concat(messages)
  }
}
