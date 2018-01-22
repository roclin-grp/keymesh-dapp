export interface Itweet {
  full_text: string
  id_str: string
}

export class TwitterResource {
  constructor(
    consumerKey: string,
    consumerSecret: string,
    apiPrefix: string = 'https://cors-anywhere.herokuapp.com/https://api.twitter.com',
  ) {
    this.consumerKey = consumerKey
    this.consumerSecret = consumerSecret
    this.apiPrefix = apiPrefix
  }

  private apiPrefix: string
  private accessToken: string = ''
  private consumerKey: string
  private consumerSecret: string

  public getTweet = async (id: string): Promise<Itweet> => {
    const uri = `/1.1/statuses/show.json?id=${id}&exclude_replies=true&tweet_mode=extended`

    return await this.fetch(uri)
  }

  public getTweetByProofURL = async (url: string): Promise<Itweet | null> => {
    const parts = /[0-9]+$/.exec(url)
    if (parts === null) {
      return null
    }

    const id = parts[0]
    return await this.getTweet(id)
  }

  public getUserTimeline = async (
    username: string
  ): Promise<Itweet[]> => {
    const uri = `/1.1/statuses/user_timeline.json?screen_name=${username}&exclude_replies=true&tweet_mode=extended`

    return await this.fetch(uri)
  }

  private authorize() {
    const bearerTokenCredentials = encodeURIComponent(this.consumerKey) + ':' + encodeURIComponent(this.consumerSecret)
    const base64EncodedCredentials = '::' + btoa(bearerTokenCredentials)

    const init = {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Authorization': 'Basic ' + base64EncodedCredentials,
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: 'grant_type=client_credentials',
    } as RequestInit

    return fetch(`${this.apiPrefix}/oauth2/token`, init)
      .then((resp) => {
        const json = resp.json()
        return json
      })
      .then(oauth2 => {
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
        'Authorization': 'Bearer ' + this.accessToken,
      }
    }).then((resp) => resp.json())
  }
}
