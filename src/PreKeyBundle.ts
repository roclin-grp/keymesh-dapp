import { keys as proteusKeys } from 'wire-webapp-proteus'

class PreKeyBundle extends proteusKeys.PreKeyBundle {
  // Can't override `new`, signature not match
  public static create(
    publicIdentityKey: proteusKeys.IdentityKey,
    preKey: IPreKey,
  ) {
    const {
      id,
      publicKey,
    } = preKey
    const proteusPreKey = proteusKeys.PreKey.new(id)
    const bundle = this.new(publicIdentityKey, proteusPreKey)

    bundle.public_key = publicKey

    return bundle
  }
}

export interface IPreKey {
  id: number,
  publicKey: proteusKeys.PublicKey
}

export default PreKeyBundle
