import * as CBOR from 'wire-webapp-cbor'
import {
  uint8ArrayFromHex,
  hexFromUint8Array,
} from './utils/hex'

export class PreKeysPackage {
  public static deserialize(buf: ArrayBuffer) {
    const d = new CBOR.Decoder(buf)
    return PreKeysPackage.decode(d)
  }

  public static decode(d: CBOR.Decoder) {
    const nprops = d.object()
    let interval: number = 0
    let lastPrekeysDate: number = 0
    const preKeyPublicKeys: IPreKeyPublicKeyFingerprints = {}
    for (let i = 0; i < nprops; i += 1) {
      switch (d.u8()) {
        case 0: {
          interval = d.u8()
          break
        }
        case 1: {
          lastPrekeysDate = d.u16()
          break
        }
        case 2: {
          let len = d.object()
          while (len > 0) {
            const npropsPreKey = d.object()
            for (let j = 0; j < npropsPreKey; j += 1) {
              const preKeyId = d.u16()
              if (preKeyId) {
                preKeyPublicKeys[preKeyId] = hexFromUint8Array(new Uint8Array(d.bytes()))
              } else {
                d.skip()
              }
            }
            len -= 1
          }
          break
        }
        default: {
          d.skip()
        }
      }
    }

    return new PreKeysPackage(preKeyPublicKeys, interval, lastPrekeysDate)
  }

  constructor(
    public preKeyPublicKeys: IPreKeyPublicKeyFingerprints,
    public interval: number,
    public lastPrekeyDate: number,
  ) {
    this.interval = interval
    this.lastPrekeyDate = lastPrekeyDate
    this.preKeyPublicKeys = preKeyPublicKeys
  }

  public serialise() {
    const e = new CBOR.Encoder()
    this.encode(e)
    return e.get_buffer()
  }

  public encode(e: CBOR.Encoder) {
    e.object(3)
    e.u8(0)
    e.u8(this.interval)
    e.u8(1)
    e.u16(this.lastPrekeyDate)
    e.u8(2)
    e.object(Object.keys(this.preKeyPublicKeys).length)
    Object.keys(this.preKeyPublicKeys).forEach((preKeyId) => {
      e.object(1)
      e.u16(Number(preKeyId))
      e.bytes(uint8ArrayFromHex(this.preKeyPublicKeys[preKeyId]))
    })
  }
}

export interface IPreKeyPublicKeyFingerprints {
  [preKeyId: string]: string
}
