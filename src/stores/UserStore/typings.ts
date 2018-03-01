import { IMessageData } from '../../databases/MessagesDB'
import { ISession } from '../../databases/SessionsDB'

export interface IRawUnpaddedMessage {
  messageData: IMessageData
  subject: ISession['data']['subject']
  senderAddress: string
}

export interface IRawPaddedMessage {
  message: Uint8Array
  messageByteLength: number
}
