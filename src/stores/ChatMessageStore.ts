
import {
  observable,
  runInAction,
} from 'mobx'

import {
  MetaMaskStore,
  TRANSACTION_STATUS,
} from './MetaMaskStore'
import {
  IUserIdentityKeys,
} from './UserStore'

import {
  getDatabases,
} from '../databases/index'
import {
  MessagesDB,
} from '../databases/MessagesDB'

import {
  storeLogger,
} from '../utils/loggers'

import {
  noop,
} from '../utils'
import ENV from '../config'

export class ChatMessageStore {
  @observable public messageStatus: MESSAGE_STATUS
  private metaMaskStore: MetaMaskStore
  private messagesDB: MessagesDB

  constructor(private message: IMessage, {
    metaMaskStore,
  }: {
      metaMaskStore: MetaMaskStore,
    }) {
    this.messageStatus = message.status
    this.metaMaskStore = metaMaskStore
    this.messagesDB = getDatabases().messagesDB
  }

  public checkMessageStatus = async (
    {
      messageDidSend = noop,
      sendingDidFail = noop,
      checkingDidFail = noop,
    }: ICheckChatMessageStatusLifecycle = {},
  ) => {
    const transactionHash = this.message.transactionHash!

    const waitForTransactionReceipt = async (blockCounter = 0, confirmationCounter = 0) => {
      try {
        const receipt = await this.metaMaskStore.getTransactionReceipt(transactionHash)
        if (receipt !== null) {
          if (confirmationCounter >= ENV.REQUIRED_CONFIRMATION_NUMBER) {
            const hasStatus = receipt.status != null
            const hasTransactionError = hasStatus
              ? Number(receipt.status) === TRANSACTION_STATUS.FAIL
              : receipt.gasUsed === receipt.cumulativeGasUsed
            if (hasTransactionError) {
              await this.updateMessageStatus(MESSAGE_STATUS.FAILED)
              return sendingDidFail(SENDING_FAIL_CODE.TRANSACTION_ERROR)
            }

            await this.updateMessageStatus(MESSAGE_STATUS.DELIVERED)
            messageDidSend()
          } else {
            window.setTimeout(
              waitForTransactionReceipt, ENV.ESTIMATE_AVERAGE_BLOCK_TIME, blockCounter + 1, confirmationCounter + 1,
            )
          }
          return
        }

        window.setTimeout(waitForTransactionReceipt, ENV.ESTIMATE_AVERAGE_BLOCK_TIME, blockCounter + 1)
      } catch (err) {
        storeLogger.error(err)
        checkingDidFail(err)
      }
    }

    return waitForTransactionReceipt()
  }

  public updateMessageStatus = async (status: MESSAGE_STATUS) => {
    await this.messagesDB.updateMessage(this.message, { status })

    this.message.status = status
    runInAction(() => {
      this.messageStatus = status
    })
  }
}

export enum MESSAGE_TYPE {
  HELLO,
  NORMAL,
  CLOSE_SESSION,
}

export enum MESSAGE_STATUS {
  DELIVERING,
  DELIVERED,
  FAILED,
}

export enum SENDING_FAIL_CODE {
  UNKNOWN,
  TRANSACTION_ERROR,
}

interface ICheckChatMessageStatusLifecycle {
  messageDidSend?: () => void
  checkingDidFail?: (err: Error) => void
  sendingDidFail?: (code: SENDING_FAIL_CODE) => void
}

export interface IMessage extends IUserIdentityKeys {
  messageId: string
  sessionTag: string
  messageType: MESSAGE_TYPE
  timestamp: number
  isFromYourself: boolean
  plainText?: string
  transactionHash?: string
  status: MESSAGE_STATUS
}
