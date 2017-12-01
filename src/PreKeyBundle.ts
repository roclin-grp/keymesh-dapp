import {
  keys
} from 'wire-webapp-proteus'

class PreKeyBundle extends keys.PreKeyBundle {
  // Can't override `new`, signature not match
  public static create(publicIdentityKey: keys.IdentityKey, preKeyPublicKey: keys.PublicKey, preKeyID: number) {
    const bundle = super.new(publicIdentityKey, keys.PreKey.new(preKeyID))

    bundle.public_key = preKeyPublicKey

    return bundle
  }
}

export default PreKeyBundle
