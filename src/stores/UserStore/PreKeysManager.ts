import { keys as proteusKeys } from 'wire-webapp-proteus'

import { UserStore, IUser, USER_STATUS } from '.'

import { hexFromUint8Array } from '../../utils/hex'
import { getPublicKeyFingerPrint } from '../../utils/proteus'
import { unixToday } from '../../utils/time'
import { storeLogger } from '../../utils/loggers'

import IndexedDBStore from '../../IndexedDBStore'
import { PreKeysPackage, IPreKeyPublicKeyFingerprints } from '../../PreKeysPackage'

import ENV from '../../config'

export class PreKeysManager {
  private readonly user: IUser
  constructor(
    private readonly userStore: UserStore,
    private readonly indexedDBStore: IndexedDBStore,
  ) {
    this.user = userStore.user
  }

  public async uploadPreKeys(isRegister = false) {
    const interval = 1
    const preKeys = generatePreKeys(unixToday(), interval, 365)

    const preKeysPublicKeyFingerprints: IPreKeyPublicKeyFingerprints = {}
    for (const preKey of preKeys) {
      preKeysPublicKeyFingerprints[preKey.key_id] = getPublicKeyFingerPrint(preKey.key_pair.public_key)
    }

    // use last pre-key as lastResortPrekey (id: 65535/0xFFFF)
    const lastResortPrekey = proteusKeys.PreKey.last_resort()
    const lastPreKey = preKeys[preKeys.length - 1]
    lastResortPrekey.key_pair = lastPreKey.key_pair

    const preKeysPackage = new PreKeysPackage(preKeysPublicKeyFingerprints, interval, lastPreKey.key_id)
    const serializedPrekeys = hexFromUint8Array(new Uint8Array(preKeysPackage.serialise()))
    const preKeysSignature = await this.userStore.cryptoBox.sign(serializedPrekeys)

    const uploadPreKeysUrl = `${ENV.KVASS_ENDPOINT}${this.user.userAddress}`
    const response = await fetch(
      uploadPreKeysUrl,
      {
        method: 'PUT',
        mode: 'cors',
        body: `${serializedPrekeys} ${preKeysSignature}`,
      },
    )

    if (response.status !== 201) {
      storeLogger.error(response)
      throw new Error(response.toString())
    }

    const store = this.indexedDBStore

    if (!isRegister) {
      // replacing pre-keys
      await this.deletePreKeys()
    }

    await store.save_prekeys(preKeys.concat(lastResortPrekey))

    // reload pre-keys data
    this.userStore.cryptoBox.loadWireCryptoBox()

    if (isRegister) {
      await this.userStore.updateUser({
        status: USER_STATUS.OK,
      })
    }
  }

  public async deleteOutdatedPreKeys() {
    return this.deletePreKeys(unixToday())
  }

  public async deletePreKeys(
    beforeDay = Infinity, /* delete all pre-keys by default */
  ) {
    const indexedDBStore = this.indexedDBStore

    const preKeysFromStorage = await indexedDBStore.load_prekeys()
    const deletePreKeyPromises: Array<Promise<number>> = []
    for (const preKey of preKeysFromStorage) {
      const preKeyID = Number(preKey.key_id)
      if (preKeyID < beforeDay) {
        deletePreKeyPromises.push(indexedDBStore.deletePrekey(preKeyID))
      }
    }

    await Promise.all(deletePreKeyPromises)
  }
}

function generatePreKeys(
  start: number,
  interval: number,
  size: number,
): proteusKeys.PreKey[] {
  const preKeys: proteusKeys.PreKey[] = []
  for (let i = 0; i < size; i++) {
    const preKeyId = (start + i * interval) % proteusKeys.PreKey.MAX_PREKEY_ID
    const preKey = proteusKeys.PreKey.new(preKeyId)
    preKeys.push(preKey)
  }
  return preKeys
}
