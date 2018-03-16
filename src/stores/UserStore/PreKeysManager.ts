import { keys as proteusKeys } from 'wire-webapp-proteus'
import { Cryptobox as WireCryptoBox } from 'wire-webapp-cryptobox'

import { UserStore, IUser, getCryptoBoxIndexedDBName } from '.'

import { getPublicKeyFingerPrint } from '../../utils/proteus'
import { unixToday } from '../../utils/time'
import { storeLogger } from '../../utils/loggers'
import { uint8ArrayToBase64, hexToBase64, hexFromUint8Array } from '../../utils/hex'

import IndexedDBStore from '../../IndexedDBStore'
import { PreKeysPackage, IPreKeyPublicKeyFingerprints } from '../../PreKeysPackage'
import { ETHEREUM_NETWORKS } from '../MetaMaskStore'

import ENV from '../../config'

export class PreKeysManager {
  private readonly user: IUser
  private readonly indexedDBStore: IndexedDBStore
  constructor(private readonly userStore: UserStore) {
    const { user } = userStore
    this.user = user
    const dbName = getCryptoBoxIndexedDBName(user)
    this.indexedDBStore = new IndexedDBStore(dbName)
  }

  public async replacePreKeys() {
    await uploadPreKeys(this.user.networkId, this.indexedDBStore, true)

    // reload pre-keys data
    await this.userStore.cryptoBox.loadWireCryptoBox()
  }

  public async deleteOutdatedPreKeys() {
    await deletePreKeys(this.indexedDBStore, unixToday())
  }
}

export async function uploadPreKeys(
  networkID: ETHEREUM_NETWORKS,
  indexedDBStore: IndexedDBStore,
  replace = false,
) {
  const cryptoBox = new WireCryptoBox(indexedDBStore as any, 0)
  await cryptoBox.load()

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
  const serializedPrekeys = uint8ArrayToBase64(new Uint8Array(preKeysPackage.serialise()))
  const identityKeyPair = cryptoBox.identity
  const rawSignature = await identityKeyPair.secret_key.sign(serializedPrekeys)
  const signature = hexToBase64(hexFromUint8Array(rawSignature))

  const publicKey = identityKeyPair.public_key.fingerprint()
  const uploadPreKeysUrl = `${ENV.PREKEYS_API}?networkID=${networkID}&publicKey=${publicKey}`
  const response = await fetch(
    uploadPreKeysUrl,
    {
      method: 'PUT',
      mode: 'cors',
      body: JSON.stringify({
        signature,
        prekeys: serializedPrekeys,
      } as IPutPrekeys),
    },
  )

  if (response.status !== 201) {
    storeLogger.error(response)
    throw new Error(response.toString())
  }

  if (replace) {
    await deletePreKeys(indexedDBStore)
  }

  await indexedDBStore.save_prekeys(preKeys.concat(lastResortPrekey))
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

export async function deletePreKeys(
  indexedDBStore: IndexedDBStore,
  beforeDay = Infinity, /* delete all pre-keys by default */
) {
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

export interface IPutPrekeys {
  signature: string
  prekeys: string
}
