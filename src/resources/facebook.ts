export interface IPost {
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

  public static async getPost(url: string): Promise<string> {
    const fetchOptions: RequestInit = {
      method: 'GET',
      mode: 'cors',
    }

    url = 'https://cors-anywhere.herokuapp.com/' + url

    const body = await fetch(url, fetchOptions)
      .then((resp) => resp.text())

    return body
  }
}
