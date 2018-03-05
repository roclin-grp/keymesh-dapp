import { runInAction, observable } from 'mobx'
import { keys as proteusKeys } from 'wire-webapp-proteus'
import { noop } from '../utils/'
import { UsersStore } from './UsersStore'
import { utf8ToHex, hexToUtf8, uint8ArrayFromHex } from '../utils/hex'
import { storeLogger } from '../utils/loggers'
import { ContractStore, ITransactionLifecycle } from './ContractStore'
import { getUserPublicKey } from './UsersStore'
import ENV from '../config'

export class BroadcastMessagesStore {
  @observable.ref public broadcastMessages: IBroadcastMessage[] = []
  private usersStore: UsersStore
  private contractStore: ContractStore

  private fetchTimeout!: number
  private isFetching: boolean = false
  private lastFetchBlock: number = 0
  private broadcastMessagesSignatures: string[] = []
  private cachedUserPublicKeys: {
    [userAddress: string]: proteusKeys.PublicKey,
  } = {}

  constructor({
    usersStore,
    contractStore,
  }: {
      usersStore: UsersStore
      contractStore: ContractStore,
    }) {
    this.usersStore = usersStore
    this.contractStore = contractStore
  }

  public async publishBroadcastMessage(
    message: string,
    {
      transactionWillCreate = noop,
      transactionDidCreate = noop,
      publishDidComplete = noop,
      publishDidFail = noop,
    }: IPublishBroadcastOptions = {},
  ) {
    const {
      hasUser,
      currentUserStore,
    } = this.usersStore
    if (!hasUser) {
      return
    }

    const signature = await currentUserStore!.cryptoBox.sign(message)
    const timestamp = Date.now()
    const signedMessage: ISignedBroadcastMessage = {
      message,
      signature,
      timestamp: Math.floor(timestamp / 1000),
    }
    const signedMessageHex = utf8ToHex(JSON.stringify(signedMessage))
    const contract = this.contractStore.broadcastMessagesContract
    const author = currentUserStore!.user.userAddress

    transactionWillCreate()
    contract.publish(author, signedMessageHex)
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
        if (confirmationNumber === ENV.REQUIRED_CONFIRMATION_NUMBER) {
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

    const userPublicKey = await getUserPublicKey(userAddress, this.contractStore)
    if (userPublicKey != null) {
      this.cachedUserPublicKeys[userAddress] = userPublicKey
    }
    return userPublicKey
  }
  private fetchNewBroadcastMessages = async () => {
    const {
      lastBlock,
      result: broadcastMessages,
    } = await this.contractStore.broadcastMessagesContract.getBroadcastMessages({
      fromBlock: this.lastFetchBlock > 0 ? this.lastFetchBlock : 0,
    })

    const messages = (await Promise.all(broadcastMessages.map(async (messagePackage: any) => {
      const userAddress = messagePackage.userAddress
      const blockTimestamp = messagePackage.timestamp
      const signedMessage: ISignedBroadcastMessage = JSON.parse(hexToUtf8(messagePackage.signedMessage))
      if (this.broadcastMessagesSignatures.includes(signedMessage.signature)) {
        return null
      }

      this.broadcastMessagesSignatures.push(signedMessage.signature)

      const userPublicKey = await this.getUserPublicKey(userAddress)
      if (userPublicKey == null) {
        return null
      }

      try {
        if (!userPublicKey.verify(uint8ArrayFromHex(signedMessage.signature), signedMessage.message)) {
          throw new Error('invalid signature')
        }
      } catch (e) {
        storeLogger.warn(e)
        return null
      }

      const isInvalidTimestamp = Math.abs(signedMessage.timestamp - blockTimestamp) >= 10 * 60

      const broadcastMessage: IBroadcastMessage = {
        message: signedMessage.message,
        timestamp: Number(signedMessage.timestamp) * 1000,
        author: userAddress,
        isInvalidTimestamp,
      }
      if (isInvalidTimestamp) {
        broadcastMessage.blockTimestamp = Number(blockTimestamp) * 1000
      }
      return broadcastMessage
    }))).filter((message) => message !== null) as IBroadcastMessage[]

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
  publishDidFail?: (err: Error) => void
}

const FETCH_BROADCAST_MESSAGES_INTERVAL = 10 * 1000
