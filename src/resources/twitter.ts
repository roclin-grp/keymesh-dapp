import { ISignedTwitterClaim } from '../stores/BoundSocialsStore'

export interface ITweet {
  full_text: string
  id_str: string
}

export class TwitterResource {
  private accessToken: string = ''

  constructor(
    private consumerKey: string,
    private consumerSecret: string,
    private apiPrefix: string = 'https://cors-anywhere.herokuapp.com/https://api.twitter.com',
  ) {
    this.consumerKey = consumerKey
    this.consumerSecret = consumerSecret
    this.apiPrefix = apiPrefix
  }

  public getTweet = async (id: string): Promise<ITweet> => {
    const uri = `/1.1/statuses/show.json?id=${id}&exclude_replies=true&tweet_mode=extended`

    return await this.fetch(uri)
  }

  public async getSignedTwitterClaimByProofURL(url: string): Promise<ISignedTwitterClaim | null> {
    const tweet = await this.getTweetByProofURL(url)
    if (tweet === null) {
      return null
    }

    const parts = /addr: (\w+)\s+public key: (\w+)\s+sig: (\w+)/.exec(tweet.full_text)
    if (parts === null) {
      return null
    }

    return {
      claim: {
        userAddress: parts[1],
        publicKey: parts[2],
      },
      signature: parts[3],
    }
  }

  public getTweetByProofURL = async (url: string): Promise<ITweet | null> => {
    const parts = /[0-9]+$/.exec(url)
    if (parts === null) {
      return null
    }

    const id = parts[0]
    return await this.getTweet(id)
  }

  public getUserTimeline = async (
    username: string,
  ): Promise<ITweet[]> => {
    const uri = `/1.1/statuses/user_timeline.json?screen_name=${username}&exclude_replies=true&tweet_mode=extended`

    return await this.fetch(uri)
  }

  private authorize() {
    const bearerTokenCredentials = encodeURIComponent(this.consumerKey) + ':' + encodeURIComponent(this.consumerSecret)
    const base64EncodedCredentials = '::' + btoa(bearerTokenCredentials)

    const fetchOptions: RequestInit = {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Authorization': 'Basic ' + base64EncodedCredentials,
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: 'grant_type=client_credentials',
    }

    return fetch(`${this.apiPrefix}/oauth2/token`, fetchOptions)
      .then((resp) => {
        const json = resp.json()
        return json
      })
      .then((oauth2) => {
        this.accessToken = oauth2.access_token
      })
  }

  private async fetch(uri: string): Promise<any> {
    if (this.accessToken === '') {
      await this.authorize()
    }

    const timelineURL = this.apiPrefix + uri

    return await fetch(timelineURL, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + this.accessToken,
      },
    }).then((resp) => resp.json())
  }
}
