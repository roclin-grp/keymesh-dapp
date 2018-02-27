import { Cryptobox } from 'wire-webapp-cryptobox'

import { IMessageData, IMessage } from '../../databases/MessagesDB'
import { IPreKey } from '../../PreKeyBundle'
import { ISession } from '../../databases/SessionsDB'

export interface IMessageSender {
  userAddress: string
  cryptoBox: Cryptobox
}

export interface IMessageReceiver {
  userAddress: string
  identityKeyFingerPrint: string
  preKey: IPreKey
}

export interface IRawUnpaddedMessage {
  messageData: IMessageData
  subject: ISession['data']['subject']
  senderAddress: string
}

export interface IReceivedMessage {
  session: ISession
  message: IMessage
}
