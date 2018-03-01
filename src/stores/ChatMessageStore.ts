import { observable, action, computed } from 'mobx'

import { MetaMaskStore } from './MetaMaskStore'

import { getDatabases } from '../databases/index'
import { MessagesDB, IMessage, MESSAGE_STATUS } from '../databases/MessagesDB'
import { ISession } from '../databases/SessionsDB'

import { storeLogger } from '../utils/loggers'

import ENV from '../config'

export class ChatMessageStore {
  @observable private _messageStatus: MESSAGE_STATUS
  private readonly messagesDB: MessagesDB
  private isChecking = false

  @computed
  public get messageStatus(): MESSAGE_STATUS {
    return this._messageStatus
  }

  constructor(
    private readonly message: IMessage,
    private readonly metaMaskStore: MetaMaskStore,
  ) {
    this._messageStatus = message.meta.status
    this.messagesDB = getDatabases().messagesDB
  }

  public async checkMessageStatus() {
    if (this.isChecking) {
      return
    }

    const { transactionHash } = this.message.meta
    if (transactionHash == null) {
      throw new Error('no transaction hash')
    }

    const { getReceipt } = this.metaMaskStore.getProcessingTransactionHandler(
      transactionHash,
    )

    this.isChecking = true

    try {
      await getReceipt(
        ENV.REQUIRED_CONFIRMATION_NUMBER,
        ENV.ESTIMATE_AVERAGE_BLOCK_TIME,
        ENV.TRANSACTION_TIME_OUT_BLOCK_NUMBER,
      )

      await this.updateMessageStatus(MESSAGE_STATUS.DELIVERED)
    } catch (err) {
      if ((err as Error).message.includes('Timeout')) {
        storeLogger.warn('check message timeout')
        // retry
        this.checkMessageStatus()
        return
      }

      storeLogger.error('message sending fail:', err)
      await this.updateMessageStatus(MESSAGE_STATUS.FAILED)
    }
  }

  private async updateMessageStatus(status: MESSAGE_STATUS) {
    await this.messagesDB.updateMessage(this.message, { status })
    this.updateMemoryMessageStatus(status)
  }

  @action
  private updateMemoryMessageStatus(status: MESSAGE_STATUS) {
    this._messageStatus = status
  }
}

export interface IChatMessage {
  session: ISession
  message: IMessage
}
