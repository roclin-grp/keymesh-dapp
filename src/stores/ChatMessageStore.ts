
import {
  observable,
  runInAction,
} from 'mobx'

import {
  MetaMaskStore,
} from './MetaMaskStore'

import {
  getDatabases,
} from '../databases/index'
import {
  MessagesDB,
  IMessage,
  MESSAGE_STATUS,
} from '../databases/MessagesDB'
import ENV from '../config'
import { storeLogger } from '../utils/loggers'

export class ChatMessageStore {
  public stopCheckMessageStatus: (() => void) | null = null
  @observable public messageStatus: MESSAGE_STATUS
  private messagesDB: MessagesDB

  constructor(private message: IMessage, private metaMaskStore: MetaMaskStore) {
    this.messageStatus = message.meta.status
    this.messagesDB = getDatabases().messagesDB
  }

  public async checkMessageStatus() {
    const { transactionHash } = this.message.meta
    console.log('checkMessageStatus', transactionHash)

    if (transactionHash == null) {
      throw new Error('no transaction hash')
    }

    const {
      stopGetReceipt,
      getReceipt,
    } = this.metaMaskStore.getProcessingTransactionHandler(transactionHash)

    this.stopCheckMessageStatus = stopGetReceipt

    try {
      const receipt = await getReceipt(
        ENV.REQUIRED_CONFIRMATION_NUMBER,
        ENV.ESTIMATE_AVERAGE_BLOCK_TIME,
        ENV.TRANSACTION_TIME_OUT_BLOCK_NUMBER,
      )
      if (receipt == null) {
        // stoped polling
        return
      }
      console.log(receipt)

      await this.updateMessageStatus(MESSAGE_STATUS.DELIVERED)
      this.stopCheckMessageStatus = null
    } catch (err) {
      if ((err as Error).message.includes('Timeout')) {
        this.checkMessageStatus()
        return
      }

      storeLogger.error('message sending fail:', err)
      await this.updateMessageStatus(MESSAGE_STATUS.FAILED)
    }
  }

  private async updateMessageStatus(status: MESSAGE_STATUS) {
    await this.messagesDB.updateMessage(this.message, { status })

    this.message.meta.status = status
    runInAction(() => {
      this.messageStatus = status
    })
  }
}
