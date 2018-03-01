import { keys as proteusKeys} from 'wire-webapp-proteus'

import { SessionStore } from '.'

import { ContractStore } from '../ContractStore'
import { getUserPublicKey } from '../UsersStore'
import { UserStore } from '../UserStore'
import { IChatMessage } from '../ChatMessageStore'

import { ISession } from '../../databases/SessionsDB'
import {
  createMessage,
  IMessageData,
  MESSAGE_STATUS,
  MESSAGE_TYPE,
  IMessageConfigurableMeta,
} from '../../databases/MessagesDB'

import { sleep } from '../../utils'
import {
  publicKeyToIdentityKey,
} from '../../utils/proteus'

import PreKeyBundle, { IPreKey } from '../../PreKeyBundle'
import { getPreKeysPackage } from '../../PreKeysPackage'

export default class ChatContext {
  private readonly session: ISession
  private readonly receiverAddress: string
  /**
   * don't access this directly, use `await this.getWireCryptoBox()`
   */
  private receiverPublicKey: proteusKeys.PublicKey | undefined

  constructor(
    private readonly userStore: UserStore,
    private readonly sessionStore: SessionStore,
    private readonly contractStore: ContractStore,
  ) {
    const session = sessionStore.session
    this.session = session
    this.receiverAddress = session.data.contact

    this.loadReceiverPublicKey()
  }

  public async send(messageData: IMessageData) {
    const chatMessage = this.createNewMessage(messageData)
    const receiverPublicKey = await this.getReceiverPublicKey()
    const preKeyBundle = await this.getPreKeyBundle(receiverPublicKey)
    const cipherText = await this.userStore.cryptoBox.encryptMessage(chatMessage, preKeyBundle)

    const { transactionHash } = await this.contractStore.messagesContract.publish(cipherText)
    chatMessage.message.meta.transactionHash = transactionHash

    const isClosingSession = messageData.messageType === MESSAGE_TYPE.CLOSE_SESSION
    if (isClosingSession) {
      // no need to save delete session message, return
      return
    }

    await this.sessionStore.saveMessage(chatMessage.message)

    const isNewSession = messageData.messageType === MESSAGE_TYPE.HELLO
    if (isNewSession) {
      this.userStore.sessionsStore.selectSession(this.sessionStore.session)
    }
  }

  private createNewMessage(messageData: IMessageData): IChatMessage {
    const message = createMessage(this.session, messageData, undefined, NEW_MESSAGE_META)
    return {
      session: this.session,
      message,
    }
  }

  private async getReceiverPublicKey(): Promise<proteusKeys.PublicKey> {
    if (this.receiverPublicKey == null) {
      return await this.waitForReceiverPublicKey()
    }

    return this.receiverPublicKey
  }

  private async loadReceiverPublicKey() {
    // TODO: cache public keys store or use exist one in `CachedUserDataStore`
    this.receiverPublicKey = await getUserPublicKey(this.receiverAddress, this.contractStore)
  }

  private async waitForReceiverPublicKey(interval = 300): Promise<proteusKeys.PublicKey> {
    while (this.receiverPublicKey == null) {
      sleep(interval)
    }

    return this.receiverPublicKey
  }

  private async getPreKeyBundle(publicKey: proteusKeys.PublicKey): Promise<PreKeyBundle> {
    const preKey = await getReceiverAvailablePrekey(this.sessionStore.session.data.contact, publicKey)
    return PreKeyBundle.create(publicKeyToIdentityKey(publicKey), preKey)
  }
}

const NEW_MESSAGE_META: IMessageConfigurableMeta = {
  isFromYourself: true,
  status: MESSAGE_STATUS.DELIVERING,
}

async function getReceiverAvailablePrekey(
  address: string,
  publicKey: proteusKeys.PublicKey,
): Promise<IPreKey> {
  const preKeyPackage = await getPreKeysPackage(address, publicKey)

  if (Object.keys(preKeyPackage.preKeyPublicKeys).length === 0) {
    throw new Error('no pre-keys uploaded yet')
  }

  return preKeyPackage.getAvailablePreKey()
}
