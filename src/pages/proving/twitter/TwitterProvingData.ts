import {
  action,
} from 'mobx'

import ProvingData from '../ProvingData'

import { ITweet, TwitterResource } from '../../../resources/twitter'
import { PLATFORMS } from '../../../stores/SocialProofsStore'
import ENV from '../../../config'

export class TwitterProvingData extends ProvingData {
  public platform = PLATFORMS.TWITTER
  protected defaultCheckingErrorContent = 'Please tweet the text exactly as it appears, then check again!'

  private readonly twitterResource = new TwitterResource(
    ENV.TWITTER_CONSUMER_KEY,
    ENV.TWITTER_SECRET_KEY,
  )

  @action
  protected init() {
    this.steps = [
      'Enter username',
      'Tweet',
      'Upload infomations',
      'Done',
    ]
  }

  protected async getProofURL(claimText: string): Promise<string | null> {
    const tweets = await this.twitterResource.getTweets(this.username)
    return getClaimTweetURL(tweets, claimText)
  }
}

function getClaimTweetURL(tweets: ITweet[], claimText: string): string | null {
  for (const tweet of tweets) {
    if (tweet.full_text === claimText) {
      return `https://twitter.com/statuses/${tweet.id_str}`
    }
  }
  return null
}
