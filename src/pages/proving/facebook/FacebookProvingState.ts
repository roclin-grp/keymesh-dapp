import {
  observable,
  runInAction,
  useStrict,
} from 'mobx'

import ProvingState from '../ProvingState'
import { FacebookResource } from '../../../resources/facebook'
import { storeLogger } from '../../../utils/loggers'
import {
  IsignedFacebookClaim,
  SOCIAL_MEDIA_PLATFORMS,
  VERIFY_SOCIAL_STATUS,
  IbindingSocial,
  BINDING_SOCIAL_STATUS,
  IfacebookClaim,
} from '../../../stores/BoundSocialsStore'

useStrict(true)

export class FacebookProvingState extends ProvingState {
  @observable public claim: IsignedFacebookClaim
  public platform = SOCIAL_MEDIA_PLATFORMS.FACEBOOK

  private facebookAccessToken: string
  private facebookUserID: string

  public loginCallback = (response: any) => {
    this.facebookAccessToken = response.accessToken
    this.facebookUserID = response.userID
    this.updateUsername(response.name)

    storeLogger.info('Facebook AccessToken:' + this.facebookAccessToken)
    storeLogger.info('Facebook UserID:' + this.facebookUserID)

    this.continueHandler()
  }

  protected async _checkProof(): Promise<VERIFY_SOCIAL_STATUS> {
    const text = getFacebookClaim(this.claim)
    const proofPost = await FacebookResource.getPosts(this.facebookUserID, this.facebookAccessToken)
      .then(posts => {
        for (let post of posts) {
          if (!post.hasOwnProperty('message')) {
            continue
          }
          if (text === post.message) {
            return post
          }
        }
        return null
      })
    if (proofPost === null) {
      return VERIFY_SOCIAL_STATUS.NOT_FOUND
    }

    const parts = proofPost.id.split('_')
    const postID = parts[1]
    const bindingSocial: IbindingSocial = {
      status: BINDING_SOCIAL_STATUS.CHECKED,
      signedClaim: this.claim,
      proofURL: `https://www.facebook.com/${this.facebookUserID}/posts/${postID}`,
      username: this.username,
    }

    this.usersStore.currentUserStore!.boundSocialsStore.addFacebookBindingSocial(bindingSocial)
    return VERIFY_SOCIAL_STATUS.VALID
  }

  protected setClaim(username: string, userAddress: string, publicKey: string): void {
    runInAction(() => {
      this.isProving = true
      this.claim = this.generateSignedClaim(username, userAddress, publicKey)
    })
  }

  private generateSignedClaim = (username: string, userAddress: string, publicKey: string) => {
    const claim: IfacebookClaim = {
      userAddress,
      publicKey,
    }
    const signature = this.usersStore.currentUserStore!.sign(JSON.stringify(claim))
    return {
      claim,
      signature,
    } as IsignedFacebookClaim
  }
}

export function getFacebookClaim(signedClaim: IsignedFacebookClaim) {
  return `Keymail
addr: ${signedClaim.claim.userAddress}
public key: ${signedClaim.claim.publicKey}
sig: ${signedClaim.signature}`
}
