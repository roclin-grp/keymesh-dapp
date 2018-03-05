import ENV from '../config'

export interface ITweetURL {
    display_url: string
    expanded_url: string
    indicies: number[]
    url: string
}

export interface ITweetEntities {
    urls: ITweetURL[]
}

export interface ITweet {
  full_text: string
  id_str: string
  entities: ITweetEntities
}

export class TwitterResource {
  public static replaceShortURL(tweet: ITweet): ITweet {
    let text = tweet.full_text
    for (const urlEntity of tweet.entities.urls) {
      text = text.replace(urlEntity.url, urlEntity.expanded_url)
    }
    tweet.full_text = text

    return tweet
  }

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

    let tweet = await this.fetch<ITweet>(uri)
    tweet = TwitterResource.replaceShortURL(tweet)
    return tweet.full_text
  }

  private async authorize() {
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

    const response = await fetch(`${this.apiPrefix}/oauth2/token`, fetchOptions)
    const oAuth2Data = await response.json()
    this.accessToken = oAuth2Data.access_token
  }

  private async fetch<T>(uri: string): Promise<T> {
    if (this.accessToken === '') {
      await this.authorize()
    }

    const timelineURL = this.apiPrefix + uri

    const response = await fetch(timelineURL, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + this.accessToken,
      },
    })
    return response.json()
  }
}

export const twitterResource = new TwitterResource(
  ENV.TWITTER_CONSUMER_KEY,
  ENV.TWITTER_SECRET_KEY,
)
