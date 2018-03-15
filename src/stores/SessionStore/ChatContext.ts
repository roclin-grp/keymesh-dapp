import { keys as proteusKeys} from 'wire-webapp-proteus'

import { SessionStore } from '.'

import { ContractStore } from '../ContractStore'
import { getUserPublicKey } from '../UsersStore'
import { UserStore } from '../UserStore'
import { QUESTS } from '../UserStore/GettingStartedQuests'
import { IChatMessage } from '../ChatMessageStore'

import { ISession } from '../../databases/SessionsDB'
import {
  createMessage,
  IMessageData,
  MESSAGE_STATUS,
  MESSAGE_TYPE,
  IMessageConfigurableMeta,
} from '../../databases/MessagesDB'

import {
  publicKeyToIdentityKey,
} from '../../utils/proteus'
import { transactionPromiEventToPromise } from '../../utils/transaction'

import PreKeyBundle, { IPreKey } from '../../PreKeyBundle'
import { getPreKeysPackage } from '../../PreKeysPackage'

export default class ChatContext {
  private readonly session: ISession
  private readonly receiverAddress: string

  constructor(
    private readonly userStore: UserStore,
    private readonly sessionStore: SessionStore,
    private readonly contractStore: ContractStore,
  ) {
    const session = sessionStore.session
    this.session = session
    this.receiverAddress = session.data.contact
  }

  public async send(messageData: IMessageData) {
    const chatMessage = this.createNewMessage(messageData)
    const receiverPublicKey = await this.getReceiverPublicKey()
    const preKeyBundle = await this.getPreKeyBundle(receiverPublicKey)
    const cipherText = await this.userStore.cryptoBox.encryptMessage(chatMessage, preKeyBundle)

    const promiEvent = this.contractStore.messagesContract.publish(cipherText)
    const transactionHash = await transactionPromiEventToPromise(promiEvent)
    chatMessage.message.meta.transactionHash = transactionHash

    const isClosingSession = messageData.messageType === MESSAGE_TYPE.CLOSE_SESSION
    if (isClosingSession) {
      // no need to save delete session message, return
      return
    }

    const { gettingStartedQuests } = this.userStore
    if (!gettingStartedQuests.questStatues[QUESTS.FIRST_MESSAGE]) {
      gettingStartedQuests.setQuest(QUESTS.FIRST_MESSAGE, true)
    }

    if (this.session.meta.isNewSession) {
      await this.sessionStore.saveSessionWithMessage(chatMessage.message)
      return
    }

    await this.sessionStore.saveMessage(chatMessage.message, { shouldAddUnread: false })
  }

  private createNewMessage(messageData: IMessageData): IChatMessage {
    const message = createMessage(this.session, messageData, undefined, NEW_MESSAGE_META)
    return {
      session: this.session,
      message,
    }
  }

  private async getReceiverPublicKey(): Promise<proteusKeys.PublicKey> {
    return getUserPublicKey(this.receiverAddress, this.contractStore)
  }

  private async getPreKeyBundle(publicKey: proteusKeys.PublicKey): Promise<PreKeyBundle> {
    const preKey = await getReceiverAvailablePrekey(this.userStore.user.networkId, publicKey)
    return PreKeyBundle.create(publicKeyToIdentityKey(publicKey), preKey)
  }
}

const NEW_MESSAGE_META: IMessageConfigurableMeta = {
  isFromYourself: true,
  status: MESSAGE_STATUS.DELIVERING,
}

async function getReceiverAvailablePrekey(
  networkID: number,
  publicKey: proteusKeys.PublicKey,
): Promise<IPreKey> {
  const preKeyPackage = await getPreKeysPackage(networkID, publicKey)

  if (Object.keys(preKeyPackage.preKeyPublicKeys).length === 0) {
    throw new Error('no pre-keys uploaded yet')
  }

  return preKeyPackage.getAvailablePreKey()
}
