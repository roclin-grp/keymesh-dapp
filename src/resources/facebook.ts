import { IsignedFacebookClaim } from '../../typings/proof.interface'

interface Ipost {
  message: string
  created_time: string
  id: string
}

export class FacebookResource {
  static getPosts(userID: string, accessToken: string): Promise<Ipost[]> {
    const init = {
      method: 'GET',
      mode: 'cors',
    } as RequestInit
    const url = `https://graph.facebook.com/v2.11/${userID}/posts`
      + `?access_token=${accessToken}`

    return fetch(url, init)
      .then((resp) => resp.json())
      .then(respBody => {
        return respBody.data ? respBody.data : []
      })
  }

  static async getClaimByPostURL(url: string): Promise<IsignedFacebookClaim|null> {
    const init = {
      method: 'GET',
      mode: 'cors',
    } as RequestInit

    url = 'https://cors-anywhere.herokuapp.com/' + url

    const body = await fetch(url, init)
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
      signature: parts[3]
    } as IsignedFacebookClaim
  }
}
