import * as CBOR from 'wire-webapp-cbor'
import { keys as proteusKeys } from 'wire-webapp-proteus'

import { uint8ArrayFromHex, hexFromUint8Array, base64ToHex } from './utils/hex'
import { unixToday } from './utils/time'
import { publicKeyFromHexStr } from './utils/proteus'

import { IPreKey } from './PreKeyBundle'

import ENV from './config'
import { IPutPrekeys } from './stores/UserStore/PreKeysManager'

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
                preKeyPublicKeys[preKeyId] = hexFromUint8Array(
                  new Uint8Array(d.bytes()),
                )
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
  ) {}

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

  public getAvailablePreKey(): IPreKey {
    const { lastPrekeyDate, preKeyPublicKeys } = this

    let preKeyID = unixToday()
    let preKeyPublicKeyFingerprint: string | undefined

    if (preKeyID < lastPrekeyDate) {
      const limitDay = preKeyID - this.interval
      while (preKeyID > limitDay) {
        preKeyPublicKeyFingerprint = preKeyPublicKeys[preKeyID]
        if (preKeyPublicKeyFingerprint != null) {
          break
        }
        preKeyID -= 1
      }
    }

    // If not found, use last-resort pre-key
    if (preKeyPublicKeyFingerprint == null) {
      preKeyID = lastPrekeyDate
      preKeyPublicKeyFingerprint = preKeyPublicKeys[lastPrekeyDate]
    }

    const publicKey = publicKeyFromHexStr(preKeyPublicKeyFingerprint)
    return {
      id: preKeyID,
      publicKey,
    }
  }
}

export async function getPreKeysPackage(
  networkID: number,
  publicKey: proteusKeys.PublicKey,
): Promise<PreKeysPackage> {
  const publicKeyHex = publicKey.fingerprint()
  const uploadPreKeysUrl = `${ENV.GET_PREKEYS_HOST}/${networkID}/${publicKeyHex}`
  const fetchOptions: RequestInit = { method: 'GET', mode: 'cors' }

  const resp = await fetch(uploadPreKeysUrl, fetchOptions)
  if (resp.status === 200) {
    const prekeys = await resp.json() as IPutPrekeys
    if (prekeys.prekeys === '' || prekeys.signature === '') {
      throw new Error('the data is broken')
    }

    if (
      !publicKey.verify(
        uint8ArrayFromHex(base64ToHex(prekeys.signature)),
        prekeys.prekeys,
      )
    ) {
      throw new Error('pre-keys package\'s signature is invalid.')
    }

    return PreKeysPackage.deserialize(uint8ArrayFromHex(base64ToHex(
      prekeys.prekeys,
    )).buffer as ArrayBuffer)
  }
  throw new Error('status is not 200')
}

export interface IPreKeyPublicKeyFingerprints {
  [preKeyId: string]: string
}
