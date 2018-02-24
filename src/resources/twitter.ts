import ENV from '../config'

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
  ) {}

  public async getTweets(username: string): Promise<ITweet[]> {
    const uri = `/1.1/statuses/user_timeline.json?screen_name=${username}&exclude_replies=true&tweet_mode=extended`

    return this.fetch<ITweet[]>(uri)
  }

  public async getTweet(url: string): Promise<string | null> {
    const parts = /[0-9]+$/.exec(url)
    if (parts === null) {
      return null
    }

    const id = parts[0]
    const uri = `/1.1/statuses/show.json?id=${id}&exclude_replies=true&tweet_mode=extended`

    return this.fetch<ITweet>(uri)
      .then((tweet) => tweet.full_text)
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

  private async fetch<T>(uri: string): Promise<T> {
    if (this.accessToken === '') {
      await this.authorize()
    }

    const timelineURL = this.apiPrefix + uri

    return fetch(timelineURL, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + this.accessToken,
      },
    }).then((resp) => resp.json())
  }
}

export const twitterResource = new TwitterResource(
  ENV.TWITTER_CONSUMER_KEY,
  ENV.TWITTER_SECRET_KEY,
)
