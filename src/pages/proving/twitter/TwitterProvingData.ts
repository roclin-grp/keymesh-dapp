import {
  action,
} from 'mobx'

import ProvingData, { DEFAULT_CHECK_PROOF_BUTTON_CONTENT } from '../ProvingData'

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
      'Fetch user info',
      'Tweet',
      'Upload infomations',
      'Done',
    ]

    if (window.location.search === '') {
      this.authorize()
    } else {
      this.fetchUserInfo()
    }
  }

  protected async getProofURL(claimText: string): Promise<string | null> {
    const tweets = await this.twitterResource.getTweets(this.username)
    return getClaimTweetURL(tweets, claimText)
  }

  protected async uploadingDidCompleteCallback() {
    const isValid = await this.verify()

    if (isValid) {
      super.uploadingDidCompleteCallback()
      return
    }

    this.showCheckingError('Something went wrong, please retry.')
    this.setCheckProofButton(DEFAULT_CHECK_PROOF_BUTTON_CONTENT)
  }

  private async verify(): Promise<boolean> {
    const url = `${ENV.TWITTER_OAUTH_VERIFY}?userAddress=${this.usersStore.currentUserStore!.user.userAddress}`
    const resp = await fetch(url)
    if (resp.status !== 200) {
      // todo error handler
      alert('could not verify the proof')
      return false
    }

    const text = await resp.text()
    if (text !== 'verified') {
      // todo error handler
      alert('could not verify the proof')
      return false
    }

    return true
  }

  private async fetchUserInfo() {
    const url = ENV.TWITTER_OAUTH_CALLBACK + window.location.search
    history.pushState(null, '', window.location.href.split('?')[0])
    const resp = await fetch(url)
    if (resp.status !== 200) {
      // todo error handler
      alert('fetch twitter user info error')
      return
    }

    const body = await resp.json()
    this.updateUsername(body.screen_name)
    this.continueHandler()
  }

  private async authorize() {
    const resp = await fetch(ENV.TWITTER_OAUTH_API)
    if (resp.status !== 200) {
      // todo error handler
      alert('fetch twitter oauth api error')
      return
    }

    const url = await resp.text()
    window.location.href = url
  }
}

function getClaimTweetURL(tweets: ITweet[], claimText: string): string | null {
  for (let tweet of tweets) {
    tweet = TwitterResource.replaceShortURL(tweet)
    if (tweet.full_text === claimText) {
      return `https://twitter.com/statuses/${tweet.id_str}`
    }
  }
  return null
}
