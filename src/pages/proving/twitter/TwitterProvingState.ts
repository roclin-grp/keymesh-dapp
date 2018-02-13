import {
  observable,
  runInAction,
} from 'mobx'

import ProvingState from '../ProvingState'

import { ITweet, TwitterResource } from '../../../resources/twitter'
import {
  ISignedTwitterClaim,
  SOCIALS,
  BINDING_SOCIAL_STATUS,
  ITwitterClaim,
} from '../../../stores/BoundSocialsStore'

export class TwitterProvingState extends ProvingState {
  @observable public claim: ISignedTwitterClaim
  public platform = SOCIALS.TWITTER
  protected checkingErrorContent = 'Please tweet the text exactly as it appears, then check again!'

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

  protected async getBindingSocial() {
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
      return
    }

    return {
      status: BINDING_SOCIAL_STATUS.CHECKED,
      signedClaim: claim,
      proofURL: `https://twitter.com/statuses/${claimTweet.id_str}`,
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

  private generateSignedClaim = (username: string, userAddress: string, publicKey: string): ISignedTwitterClaim => {
    const claim: ITwitterClaim = {
      userAddress,
      publicKey,
    }
    const signature = this.usersStore.currentUserStore!.sign(JSON.stringify(claim))
    return {
      claim: claim,
      signature,
    }
  }
}

export function getTwitterClaim(signedClaim: ISignedTwitterClaim) {
  return `Keymail
addr: ${signedClaim.claim.userAddress}
public key: ${signedClaim.claim.publicKey}
sig: ${signedClaim.signature}`
}
