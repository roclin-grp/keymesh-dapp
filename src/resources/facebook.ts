import { ISignedFacebookClaim } from '../stores/BoundSocialsStore'

interface IPost {
  message: string
  created_time: string
  id: string
}

export class FacebookResource {
  public static getPosts(userID: string, accessToken: string): Promise<IPost[]> {
    const fetchOptions: RequestInit = {
      method: 'GET',
      mode: 'cors',
    }
    const url = `https://graph.facebook.com/v2.11/${userID}/posts`
      + `?access_token=${accessToken}`

    return fetch(url, fetchOptions)
      .then((resp) => resp.json())
      .then((respBody) => {
        return respBody.data ? respBody.data : []
      })
  }

  public static async getClaimByPostURL(url: string): Promise<ISignedFacebookClaim | null> {
    const fetchOptions: RequestInit = {
      method: 'GET',
      mode: 'cors',
    }

    url = 'https://cors-anywhere.herokuapp.com/' + url

    const body = await fetch(url, fetchOptions)
      .then((resp) => resp.text())

    if (body === '') {
      return null
    }

    const matches = /\buserContent\b.*?<p>(.*?)<\/p>/.exec(body)
    if (matches === null) {
      return null
    }
    const parts = /addr: (.*?)<br \/> public key: (.*?)<br \/> sig: (.*?)$/.exec(matches[1])
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
}
