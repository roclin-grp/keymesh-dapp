import { observable, action, computed } from 'mobx'

import { ContractStore } from './ContractStore'
import { SessionStore } from './SessionStore'

import { getDatabases } from '../databases/index'
import { MessagesDB, IMessage, MESSAGE_STATUS } from '../databases/MessagesDB'
import { ISession } from '../databases/SessionsDB'

import { storeLogger } from '../utils/loggers'
import { sleep } from '../utils'

import ENV from '../config'

export class ChatMessageStore {
  @observable private _messageStatus: MESSAGE_STATUS
  @observable private _confirmationCounter: number = 0
  private readonly messagesDB: MessagesDB

  @computed
  public get confirmationCounter(): number {
    return this._confirmationCounter
  }

  @computed
  public get messageStatus(): MESSAGE_STATUS {
    return this._messageStatus
  }

  public get messageID(): string {
    return this.message.messageID
  }

  constructor(
    private readonly sessionStore: SessionStore,
    private readonly message: IMessage,
    private readonly contractStore: ContractStore,
  ) {
    const { status } = message.meta
    this._messageStatus = status
    this.messagesDB = getDatabases().messagesDB

    if (status === MESSAGE_STATUS.DELIVERING) {
      this.checkMessageStatus()
    }
  }

  public async checkMessageStatus() {
    const { transactionHash } = this.message.meta
    if (transactionHash == null) {
      throw new Error('no transaction hash')
    }

    const { getReceipt } = this.contractStore.getProcessingTransactionHandler(
      transactionHash,
    )

    try {
      await getReceipt(
        ENV.REQUIRED_CONFIRMATION_NUMBER,
        ENV.ESTIMATE_AVERAGE_BLOCK_TIME,
        ENV.TRANSACTION_TIME_OUT_BLOCK_NUMBER,
        this.handleConfirmation.bind(this),
      )

      await this.updateMessageStatus(MESSAGE_STATUS.DELIVERED)
    } catch (err) {
      const checkTransactionTimeout = (err as Error).message.includes('Timeout')
      const hasfetchError = (err as Error).message.includes('Failed to fetch')

      if (checkTransactionTimeout || hasfetchError) {
        storeLogger.warn('check message fail:', err)
        // retry
        await sleep(3000)
        this.checkMessageStatus()
        return
      }

      storeLogger.error('message sending fail:', err)
      await this.updateMessageStatus(MESSAGE_STATUS.FAILED)
    }
  }

  public disposeStore() {
    this.sessionStore.removeCachedChatMessageStore(this)
  }

  private async updateMessageStatus(status: MESSAGE_STATUS) {
    await this.messagesDB.updateMessage(this.message, { status })
    this.updateMemoryMessageStatus(status)
  }

  @action
  private updateMemoryMessageStatus(status: MESSAGE_STATUS) {
    this._messageStatus = status
  }

  @action
  private handleConfirmation(confirmationCount: number) {
    this._confirmationCounter = confirmationCount
  }
}

export interface IChatMessage {
  session: ISession
  message: IMessage
}
