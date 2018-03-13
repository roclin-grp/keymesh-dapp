import {
  action,
} from 'mobx'

import ProvingData from '../ProvingData'

import { ITweet, TwitterResource } from '../../../resources/twitter'
import { PLATFORMS } from '../../../stores/SocialProofsStore'
import ENV from '../../../config'
import { STATUS_TYPE } from '../../../components/StatusButton'
import { storeLogger } from '../../../utils/loggers'
import { cachedUserInfo } from '../../../stores/UserCachesStore'

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
      const resp = await fetch(`${ENV.TWITTER_OAUTH_API}?networkID=${this.userStore.user.networkId}`)
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

    if (!isValid) {
      this.setProofStatusType(STATUS_TYPE.WARN, false)
      this.setProofStatusContent('Failed to verify the proof')
      return
    }

    const { userAddress } = this.userStore.user
    delete cachedUserInfo[userAddress]
    super.uploadingDidCompleteCallback()
  }

  private async verify(): Promise<boolean> {
    const { userAddress, networkId } = this.userStore.user
    const url = `${ENV.TWITTER_OAUTH_VERIFY}` +
      `?userAddress=${userAddress}&networkID=${networkId}&username=${this.username}&proofURL=${this.proof!.proofURL}`
    const fetchOptions: RequestInit = { method: 'GET', mode: 'cors' }
    try {
      const response = await fetch(url, fetchOptions)

      if (response.status !== 200) {
        return false
      }

      const text = await response.text()
      if (text !== 'verified') {
        return false
      }

      return true
    } catch (err) {
      storeLogger.error('Failed to verify proof:', err)
      return false
    }
  }

  private async fetchUserInfo() {
    const url = `${ENV.TWITTER_OAUTH_CALLBACK}${window.location.search}&networkID=${this.userStore.user.networkId}`
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
