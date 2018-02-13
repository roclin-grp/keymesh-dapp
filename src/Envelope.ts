import {
  keys,
  message,
} from 'wire-webapp-proteus'

import * as CBOR from 'wire-webapp-cbor'

import { Buffer } from 'buffer'
import {
  hexFromUint8Array,
  uint8ArrayFromHex,
} from './utils/hex'
import {
  cryptoBoxSeal,
  cryptoBoxSealOpen,
} from './utils/sodium'

export class Envelope {
  public static decode(d: CBOR.Decoder) {
    const header = {} as IEnvelopeHeader
    let cipherMessage: message.CipherMessage | undefined
    const nprops = d.object()
    for (let i = 0; i <= nprops - 1; i += 1) {
      switch (d.u8()) {
        case 0: {
          header.senderIdentity = keys.IdentityKey.decode(d)
          break
        }
        case 1: {
          const npropsMac = d.object()
          for (let j = 0; j <= npropsMac - 1; j += 1) {
            switch (d.u8()) {
              case 0:
                header.mac = new Uint8Array(d.bytes())
                break
              default:
                d.skip()
            }
          }
          break
        }
        case 2: {
          header.baseKey = keys.PublicKey.decode(d)
          break
        }
        case 3: {
          const npropsMac = d.object()
          for (let j = 0; j <= npropsMac - 1; j += 1) {
            switch (d.u8()) {
              case 0:
                header.sessionTag = hexFromUint8Array(new Uint8Array(d.bytes()))
                break
              default:
                d.skip()
            }
          }
          break
        }
        case 4: {
          header.isPreKeyMessage = d.bool()
          break
        }
        case 5: {
          const npropsMac = d.object()
          for (let j = 0; j <= npropsMac - 1; j += 1) {
            switch (d.u8()) {
              case 0:
                header.messageByteLength = new Uint16Array(new Uint8Array(d.bytes()).buffer)[0]
                break
              default:
                d.skip()
            }
          }
          break
        }
        case 6: {
          cipherMessage = message.CipherMessage.decode(d)
          break
        }
        default: {
          d.skip()
        }
      }
    }
    return new Envelope(header, cipherMessage!)
  }

  public static deserialize(buf: ArrayBuffer) {
    const d = new CBOR.Decoder(buf)
    return Envelope.decode(d)
  }

  public static decrypt(envelopeBuf: Uint8Array, preKey: keys.PreKey) {
    return Envelope.deserialize(cryptoBoxSealOpen(
      envelopeBuf,
      preKey.key_pair.public_key.pub_curve,
      preKey.key_pair.secret_key.sec_curve
    ).buffer as ArrayBuffer)
  }

  constructor(public header: IEnvelopeHeader, public cipherMessage: message.CipherMessage) {
  }

  public encrypt(preKeyID: number, preKeyPublicKey: keys.PublicKey) {
    const envelopeBuf = Buffer.from(cryptoBoxSeal(
      new Uint8Array(this.serialise()), // binary represent
      preKeyPublicKey.pub_curve
    ))
    // prepend the pre-key ID
    const preKeyIDBuf = Buffer.from(Uint16Array.from([preKeyID]).buffer as ArrayBuffer)
    const concatedBuf = Buffer.concat([preKeyIDBuf, envelopeBuf]) // Buffer
    return hexFromUint8Array(concatedBuf)
  }

  public serialise() {
    const e = new CBOR.Encoder()
    this.encode(e)
    return e.get_buffer()
  }

  public encode(e: CBOR.Encoder) {
    const {
      senderIdentity, // sender's public key, for envelope reassemble
      mac, // Message authentication code
      baseKey,
      sessionTag,
      isPreKeyMessage,
      messageByteLength,
    } = this.header

    e.object(7)
    e.u8(0)
    senderIdentity.encode(e)
    e.u8(1)
    e.object(1)
    e.u8(0)
    e.bytes(mac)
    e.u8(2)
    baseKey.encode(e)
    e.u8(3)
    e.object(1)
    e.u8(0)
    e.bytes(uint8ArrayFromHex(sessionTag))
    e.u8(4)
    e.bool(Number(isPreKeyMessage))
    e.u8(5)
    e.object(1)
    e.u8(0)
    e.bytes(new Uint8Array(Uint16Array.from([messageByteLength]).buffer))
    e.u8(6)
    this.cipherMessage.encode(e)
  }
}

export interface IEnvelopeHeader {
  senderIdentity: keys.IdentityKey
  mac: Uint8Array
  baseKey: keys.PublicKey
  sessionTag: string
  isPreKeyMessage: boolean
  messageByteLength: number
}
