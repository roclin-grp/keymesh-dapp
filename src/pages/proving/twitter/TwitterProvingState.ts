import {
  observable,
  runInAction,
  useStrict,
} from 'mobx'

import ProvingState from '../ProvingState'

import { ITweet, TwitterResource } from '../../../resources/twitter'
import {
  ISignedTwitterClaim,
  SOCIAL_MEDIA_PLATFORMS,
  VERIFY_SOCIAL_STATUS,
  IBindingSocial,
  BINDING_SOCIAL_STATUS,
  ITwitterClaim,
} from '../../../stores/BoundSocialsStore'

useStrict(true)

export class TwitterProvingState extends ProvingState {
  @observable public claim: ISignedTwitterClaim
  public platform = SOCIAL_MEDIA_PLATFORMS.TWITTER

  private readonly twitterResource = new TwitterResource(
      process.env.REACT_APP_TWITTER_CONSUMER_KEY!,
      process.env.REACT_APP_TWITTER_SECRET_KEY!
    )

  protected init() {
    runInAction(() => {
      this.steps = [
        'Enter username',
        'Tweet',
        'Upload infomations',
        'Done',
      ]
    })
  }

  protected async _checkProof(): Promise<VERIFY_SOCIAL_STATUS> {
    const claim: ISignedTwitterClaim = this.claim
    const tweets = await this.twitterResource.getUserTimeline(this.username)

    const _claimText = getTwitterClaim(claim)
    let claimTweet: ITweet | undefined
    for (const tweet of tweets) {
      if (tweet.full_text === _claimText) {
        claimTweet = tweet
        break
      }
    }

    if (typeof claimTweet === 'undefined') {
      return VERIFY_SOCIAL_STATUS.NOT_FOUND
    }

    const bindingSocial: IBindingSocial = {
      status: BINDING_SOCIAL_STATUS.CHECKED,
      signedClaim: claim,
      proofURL: `https://twitter.com/statuses/${claimTweet.id_str}`,
      username: this.username,
    }
    this.usersStore.currentUserStore!.boundSocialsStore.addTwitterBindingSocial(bindingSocial)

    return VERIFY_SOCIAL_STATUS.VALID
  }

  protected setClaim(username: string, userAddress: string, publicKey: string): void {
    runInAction(() => {
      this.isProving = true
      this.claim = this.generateSignedClaim(username, userAddress, publicKey)
    })
  }

  private generateSignedClaim = (username: string, userAddress: string, publicKey: string) => {
    const claim: ITwitterClaim = {
      userAddress,
      publicKey,
    }
    const signature = this.usersStore.currentUserStore!.sign(JSON.stringify(claim))
    return {
      claim: claim,
      signature,
    } as ISignedTwitterClaim
  }
}

export function getTwitterClaim(signedClaim: ISignedTwitterClaim) {
  return `Keymail
addr: ${signedClaim.claim.userAddress}
public key: ${signedClaim.claim.publicKey}
sig: ${signedClaim.signature}`
}
