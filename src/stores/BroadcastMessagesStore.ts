import { runInAction, observable } from 'mobx'
import { noop } from '../utils/'
import { UsersStore } from './UsersStore'
import { utf8ToHex, hexToUtf8, sodiumFromHex } from '../utils/hex'
import { keys } from 'wire-webapp-proteus'
import { storeLogger } from '../utils/loggers'
import { ContractStore, ITransactionLifecycle } from './ContractStore'

export class BroadcastMessagesStore {
  @observable.ref public broadcastMessages: IBroadcastMessage[] = []

  constructor({
    usersStore,
    contractStore,
  }: {
    usersStore: UsersStore
    contractStore: ContractStore
  }) {
    this.usersStore = usersStore
    this.contractStore = contractStore
  }

  private usersStore: UsersStore
  private contractStore: ContractStore

  private fetchTimeout: number
  private isFetching: boolean
  private lastFetchBlock: number
  private broadcastMessagesSignatures: string[] = []
  private cachedUserPublicKeys: {
    [userAddress: string]: keys.PublicKey
  } = {}

  public publishBroadcastMessage = (
    message: string,
    {
      transactionWillCreate = noop,
      transactionDidCreate = noop,
      publishDidComplete = noop,
      publishDidFail = noop,
    }: IPublishBroadcastOptions = {},
  ) => {
    const {
      hasUser,
      currentUserStore,
    } = this.usersStore
    if (!hasUser) {
      return
    }

    const signature = currentUserStore!.sign(message)
    const timestamp = Date.now()
    const signedMessage: ISignedBroadcastMessage = {
        message,
        signature,
        timestamp: Math.floor(timestamp / 1000),
    }
    const signedMessageHex = utf8ToHex(JSON.stringify(signedMessage))
    const contract = this.contractStore.broadcastMessagesContract
    const author = currentUserStore!.user.userAddress

    contract.publish(signedMessageHex, author)
      .on('transactionHash', async (hash) => {
        transactionDidCreate(hash)
        runInAction(() => {
          this.broadcastMessages = [
            {
              author,
              timestamp,
              message,
              status: MESSAGE_STATUS.DELIVERING,
            } as IBroadcastMessage].concat(this.broadcastMessages)
        })
        this.broadcastMessagesSignatures.push(signature)
      })
      .on('confirmation', async (confirmationNumber, receipt) => {
        if (confirmationNumber === Number(process.env.REACT_APP_CONFIRMATION_NUMBER)) {
          const isCurrentMessage = (_message: IBroadcastMessage) => {
            return _message.author === author &&
              _message.timestamp === timestamp &&
              _message.message === message
          }
          if (!receipt.events) {
            const _messages = this.broadcastMessages.map((_message) => {
              if (isCurrentMessage(_message)) {
                _message.status = MESSAGE_STATUS.FAILED
              }
              return _message
            })
            runInAction(() => {
              this.broadcastMessages = _messages
            })
            publishDidFail(new Error('Unknown error'))
            return
          }
          const messages = this.broadcastMessages.map((_message) => {
            if (isCurrentMessage(_message)) {
              _message.status = MESSAGE_STATUS.DELIVERED
            }
            return _message
          })
          runInAction(() => {
            this.broadcastMessages = messages
          })
          publishDidComplete()
        }
      })
      .on('error', async (error: Error) => {
        publishDidFail(error)
      })
  }

  public stopFetchBroadcastMessages = () => {
    runInAction(() => {
      this.isFetching = false
      window.clearTimeout(this.fetchTimeout)
    })
  }

  public startFetchBroadcastMessages = async () => {
    if (this.isFetching) {
      return
    }
    const fetNewBroadcastMessagesLoop = async () => {
      try {
        await this.fetchNewBroadcastMessages()
      } finally {
        runInAction(() => {
          this.fetchTimeout = window.setTimeout(
            fetNewBroadcastMessagesLoop,
            FETCH_BROADCAST_MESSAGES_INTERVAL)
        })
      }
    }

    runInAction(() => {
      this.isFetching = true
      this.fetchTimeout = window.setTimeout(fetNewBroadcastMessagesLoop, 0)
    })
  }

  private async getUserPublicKey(userAddress: string) {
    const publicKey = this.cachedUserPublicKeys[userAddress]
    if (publicKey) {
      return publicKey
    }

    const userPublicKey = await this.usersStore.getUserPublicKey(userAddress)
    if (typeof userPublicKey !== 'undefined') {
      this.cachedUserPublicKeys[userAddress] = userPublicKey
    }
    return userPublicKey
  }
  private fetchNewBroadcastMessages = async () => {
    const {
      lastBlock,
      broadcastMessages,
    } = await this.contractStore.broadcastMessagesContract.getBroadcastMessages({
      fromBlock: this.lastFetchBlock > 0 ? this.lastFetchBlock : 0,
    })

    const messages = (await Promise.all(broadcastMessages.map(async (message: any) => {
      const userAddress = message.userAddress
      const blockTimestamp = message.timestamp
      const signedMessage = JSON.parse(hexToUtf8(message.signedMessage.slice(2))) as ISignedBroadcastMessage
      if (this.broadcastMessagesSignatures.includes(signedMessage.signature)) {
        return null
      }

      this.broadcastMessagesSignatures.push(signedMessage.signature)

      const userPublicKey = await this.getUserPublicKey(userAddress)
      if (typeof userPublicKey === 'undefined') {
        return null
      }

      try {
        if (!userPublicKey.verify(sodiumFromHex(signedMessage.signature.slice(2)), signedMessage.message)) {
          throw new Error('invalid signature')
        }
      } catch (e) {
        storeLogger.warn(e)
        return null
      }

      const isInvalidTimestamp = Math.abs(signedMessage.timestamp - blockTimestamp) >= 10 * 60

      const m = {
        message: signedMessage.message,
        timestamp: Number(signedMessage.timestamp) * 1000,
        author: userAddress,
        isInvalidTimestamp,
      } as IBroadcastMessage
      if (isInvalidTimestamp) {
        m.blockTimestamp = Number(blockTimestamp) * 1000
      }
      return m
    }))).filter((m) => m !== null) as IBroadcastMessage[]

    if (messages.length > 0) {
      runInAction(() => {
        this.broadcastMessages = messages.reverse().concat(this.broadcastMessages)
      })
    }

    this.lastFetchBlock = lastBlock
  }
}

export enum MESSAGE_STATUS {
  DELIVERING,
  DELIVERED,
  FAILED,
}

export interface IBroadcastMessage {
  author?: string
  isInvalidTimestamp?: boolean
  blockTimestamp?: number // if isInvalidTimestamp is true, it will be filled
  message: string
  timestamp: number
  status?: MESSAGE_STATUS
}

export interface ISignedBroadcastMessage extends IBroadcastMessage {
  signature: string
}

export interface IPublishBroadcastOptions extends ITransactionLifecycle {
  publishDidComplete?: () => void
  publishDidFail?: (err: Error | null) => void
}

const FETCH_BROADCAST_MESSAGES_INTERVAL = 10 * 1000
