export interface IPost {
  message: string
  created_time: string
  id: string
}

export class FacebookResource {
  public static async getPosts(userID: string, accessToken: string): Promise<IPost[]> {
    const fetchOptions: RequestInit = {
      method: 'GET',
      mode: 'cors',
    }
    const url = `https://graph.facebook.com/v2.11/${userID}/posts`
      + `?access_token=${accessToken}`

    const response = await fetch(url, fetchOptions)
    const body = await response.json()
    return body.data || []
  }

  public static async getPost(url: string): Promise<string> {
    const fetchOptions: RequestInit = {
      method: 'GET',
      mode: 'cors',
    }

    url = 'https://cors-anywhere.herokuapp.com/' + url

    const response = await fetch(url, fetchOptions)

    return response.text()
  }
}
