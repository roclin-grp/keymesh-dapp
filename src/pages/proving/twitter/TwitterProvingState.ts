import {
  observable,
  runInAction,
  useStrict,
} from 'mobx'

import ProvingState from '../ProvingState'

import { Itweet, TwitterResource } from '../../../resources/twitter'
import {
  IsignedTwitterClaim,
  SOCIAL_MEDIA_PLATFORMS,
  VERIFY_SOCIAL_STATUS,
  IbindingSocial,
  BINDING_SOCIAL_STATUS,
  ItwitterClaim,
} from '../../../stores/BoundSocialsStore'

useStrict(true)

export class TwitterProvingState extends ProvingState {
  @observable public claim: IsignedTwitterClaim
  public platform = SOCIAL_MEDIA_PLATFORMS.TWITTER

  private readonly twitterResource = new TwitterResource(
      process.env.REACT_APP_TWITTER_CONSUMER_KEY!,
      process.env.REACT_APP_TWITTER_SECRET_KEY!
    )

  protected async _checkProof(): Promise<VERIFY_SOCIAL_STATUS> {
    const claim: IsignedTwitterClaim = this.claim
    const tweets = await this.twitterResource.getUserTimeline(this.username)

    const _claimText = getTwitterClaim(claim)
    let claimTweet: Itweet|undefined
    for (let tweet of tweets) {
      if (tweet.full_text === _claimText) {
        claimTweet = tweet
        break
      }
    }

    if (typeof claimTweet === 'undefined') {
      return VERIFY_SOCIAL_STATUS.NOT_FOUND
    }

    const bindingSocial: IbindingSocial = {
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
    const claim: ItwitterClaim = {
      userAddress,
      publicKey,
    }
    const signature = this.usersStore.currentUserStore!.sign(JSON.stringify(claim))
    return {
      claim: claim,
      signature,
    } as IsignedTwitterClaim
  }
}

export function getTwitterClaim(signedClaim: IsignedTwitterClaim) {
  return `Keymail
addr: ${signedClaim.claim.userAddress}
public key: ${signedClaim.claim.publicKey}
sig: ${signedClaim.signature}`
}