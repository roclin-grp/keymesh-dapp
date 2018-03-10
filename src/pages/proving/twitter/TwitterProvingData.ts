import {
  action,
} from 'mobx'

import ProvingData, { DEFAULT_CHECK_PROOF_BUTTON_CONTENT } from '../ProvingData'

import { ITweet, TwitterResource } from '../../../resources/twitter'
import { PLATFORMS } from '../../../stores/SocialProofsStore'
import ENV from '../../../config'
import { STATUS_TYPE } from '../../../components/StatusButton'

export class TwitterProvingData extends ProvingData {
  public platform = PLATFORMS.TWITTER
  protected findProofHelpText = 'Please tweet the text exactly as it appears'

  private readonly twitterResource = new TwitterResource(
    ENV.TWITTER_CONSUMER_KEY,
    ENV.TWITTER_SECRET_KEY,
  )

  public async authorize() {
    this.setProofStatusType(STATUS_TYPE.LOADING)
    this.setProofStatusContent(`Connecting...`)

    try {
      const resp = await fetch(ENV.TWITTER_OAUTH_API)
      if (resp.status !== 200) {
        this.setProofStatusType(STATUS_TYPE.WARN, false)
        this.setProofStatusContent(`Failed to connect, please retry`)
        return
      }
      const url = await resp.text()
      window.location.href = url
    } catch (err) {
      this.setProofStatusType(STATUS_TYPE.WARN, false)
      this.setProofStatusContent(`Failed to connect, please retry`)
      return
    }
  }

  @action
  protected init() {
    this.steps = [
      'Connect To Twitter',
      'Tweet Proof',
      'Record Proof',
      'Done',
    ]

    if (window.location.search !== '') {
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

    this.setProofStatusType(STATUS_TYPE.LOADING)
    this.setProofStatusContent(`Connecting...`)

    const resp = await fetch(url)
    if (resp.status !== 200) {
      this.setProofStatusType(STATUS_TYPE.WARN, false)
      this.setProofStatusContent(`Failed to connect, please retry`)
      return
    }

    const body = await resp.json()
    this.clearProofStatusButton()
    this.updateUsername(body.screen_name)
    this.continueHandler()
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
