import { IMessage as ITrustmeshRawMessage } from '@keymesh/trustmesh/lib/Messages'

import { ContractStore } from '../ContractStore'
import { UserStore, IUser } from '../UserStore'
import { IChatMessage } from '../ChatMessageStore'

import { sleep } from '../../utils'
import { storeLogger } from '../../utils/loggers'
import { createSession } from '../../databases/SessionsDB'

export class MessageCenter {
  private isFetching = false
  private isOutdatedPrekeysDeleted = false

  // `this.userStore.user` is an observable object
  // and `lastFetchBlockOfChatMessages` will change
  private get user(): IUser {
    return this.userStore.user
  }

  constructor(
    private readonly userStore: UserStore,
    private readonly contractStore: ContractStore,
  ) {
  }

  public async startFetchMessages(
    interval = FETCH_BROADCAST_MESSAGES_INTERVAL,
  ) {
    if (this.isFetching) {
      return
    }

    this.isFetching = true

    while (this.isFetching) {
      try {
        await this.fetchNewChatMessages()
      } finally {
        await sleep(interval)
      }
    }
  }

  public stopFetchChatMessages() {
    this.isFetching = false
  }

  private async fetchNewChatMessages() {
    if (!this.contractStore.isAvailable) {
      return
    }

    const lastFetchBlock = this.user.lastFetchBlockOfChatMessages
    const {
      lastBlock,
      result: trustmeshRawMessages,
    } = await this.contractStore.messagesContract.getMessages({
      fromBlock: lastFetchBlock > 0 ? lastFetchBlock : 0,
    })

    const newLastFetchBlock = lastBlock < 3 ? 0 : lastBlock - 3
    if (trustmeshRawMessages.length === 0) {
      await this.updateUserLastFetchBlockOfChatMessages(newLastFetchBlock)
      return
    }

    const decryptedMessages = await this.decryptMessages(trustmeshRawMessages)
    await this.saveReceivedMessages(decryptedMessages)

    await this.updateUserLastFetchBlockOfChatMessages(newLastFetchBlock)
  }

  private async updateUserLastFetchBlockOfChatMessages(
    lastFetchBlockOfChatMessages: number,
  ) {
    if (!this.isOutdatedPrekeysDeleted) {
      this.userStore.preKeysManager.deleteOutdatedPreKeys()
      this.isOutdatedPrekeysDeleted = true
    }

    return this.userStore.updateUser({
      lastFetchBlockOfChatMessages,
    })
  }

  private async decryptMessages(
    messages: ITrustmeshRawMessage[],
  ): Promise<Array<IChatMessage | null>> {
    const decryptedMessages: Array<IChatMessage | null> = []
    for (const trustmeshRawMessage of messages) {
      const message = await this.userStore.cryptoBox
        .decryptMessage(trustmeshRawMessage)
        .catch(() => {
          // some decrypt errors is expected (Duplicate messages, unmatched receiver)
          // TODO: handle unexpected decrypt errors, avoid message lost
          return null
        })
      decryptedMessages.push(message)
    }
    return decryptedMessages
  }

  private async saveReceivedMessages(messages: Array<IChatMessage | null>) {
    for (const chatMessage of messages) {
      if (chatMessage == null) {
        continue
      }

      await this.saveMessage(chatMessage).catch((err) => {
        storeLogger.error('saving message error:', err)
      })
    }
  }

  private async saveMessage(chatMessage: IChatMessage) {
    const { sessionsStore } = this.userStore

    const { sessionTag } = chatMessage.session
    const existedSession = this.userStore.sessionsStore.sessions
    .find((session) => session.sessionTag === sessionTag)

    const { message } = chatMessage
    if (existedSession == null) {
      const session = await createSession(
        this.userStore.user,
        chatMessage.session.data,
        sessionTag,
      )
      await sessionsStore.saveNewSessionWithMessage(session, message)
      return
    }

    await sessionsStore.getSessionStore(existedSession).saveMessage(message)
  }
}

const FETCH_BROADCAST_MESSAGES_INTERVAL = 10 * 1000
