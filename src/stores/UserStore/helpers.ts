import { IRawPaddedMessage, IRawUnpaddedMessage } from './typings'

import { stringFromUint8Array, uint8ArrayFromString } from '../../utils/sodium'

export function padTo512Bytes(
  rawMessage: IRawUnpaddedMessage,
): IRawPaddedMessage {
  const typeArrayText = uint8ArrayFromString(JSON.stringify(rawMessage))
  const messageByteLength = typeArrayText.byteLength
  if (messageByteLength >= 512) {
    throw new RangeError('Message too large')
  }
  const message = new Uint8Array(512).fill(0xff)
  message.set(typeArrayText)

  return {
    message,
    messageByteLength,
  }
}

export function unpad512BytesMessage(
  rawMessage: IRawPaddedMessage,
): IRawUnpaddedMessage {
  const messageStr = stringFromUint8Array(
    rawMessage.message.subarray(0, rawMessage.messageByteLength),
  )
  return JSON.parse(messageStr)
}
