import {
  observable,
  runInAction,
} from 'mobx'

import ProvingState from '../ProvingState'
import { FacebookResource } from '../../../resources/facebook'
import { storeLogger } from '../../../utils/loggers'
import {
  ISignedFacebookClaim,
  SOCIALS,
  BINDING_SOCIAL_STATUS,
  IFacebookClaim,
} from '../../../stores/BoundSocialsStore'

export class FacebookProvingState extends ProvingState {
  @observable public claim: ISignedFacebookClaim
  public platform = SOCIALS.FACEBOOK

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

  protected init() {
    runInAction(() => {
      this.steps = [
        'Authroize',
        'Publish a public post',
        'Upload infomations',
        'Done',
      ]
    })
  }

  protected async getBindingSocial() {
    const text = getFacebookClaim(this.claim)
    const proofPost = await FacebookResource.getPosts(this.facebookUserID, this.facebookAccessToken)
      .then(posts => {
        for (const post of posts) {
          if (!post.hasOwnProperty('message')) {
            continue
          }
          if (text === post.message) {
            return post
          }
        }
        return
      })
    if (!proofPost) {
      return
    }

    const parts = proofPost.id.split('_')
    const postID = parts[1]
    return {
      status: BINDING_SOCIAL_STATUS.CHECKED,
      signedClaim: this.claim,
      proofURL: `https://www.facebook.com/${this.facebookUserID}/posts/${postID}`,
      username: this.username,
      platform: this.platform,
    }
  }

  protected setClaim(username: string, userAddress: string, publicKey: string): void {
    runInAction(() => {
      this.isProving = true
      this.claim = this.generateSignedClaim(username, userAddress, publicKey)
    })
  }

  private generateSignedClaim = (username: string, userAddress: string, publicKey: string) => {
    const claim: IFacebookClaim = {
      userAddress,
      publicKey,
    }
    const signature = this.usersStore.currentUserStore!.sign(JSON.stringify(claim))
    return {
      claim,
      signature,
    } as ISignedFacebookClaim
  }
}

export function getFacebookClaim(signedClaim: ISignedFacebookClaim) {
  return `Keymail
addr: ${signedClaim.claim.userAddress}
public key: ${signedClaim.claim.publicKey}
sig: ${signedClaim.signature}`
}
