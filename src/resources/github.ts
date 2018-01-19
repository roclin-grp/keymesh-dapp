interface Igist {
  files: {
    [filename: string]: {
      raw_url: string
    }
  }
  html_url: string
}

export class GithubResource {
  static getGists(username: string): Promise<Igist[]> {
    const init = {
      method: 'GET',
      mode: 'cors',
    } as RequestInit

    return fetch(`https://api.github.com/users/${username}/gists`, init)
      .then((resp) => resp.json())
  }

  static getGist(id: string): Promise<Igist> {
    const init = {
      method: 'GET',
      mode: 'cors',
    } as RequestInit

    return fetch(`https://api.github.com/gists/${id}`, init)
      .then((resp) => resp.json())
  }

  static getRawContent(rawURL: string): Promise<any> {
    const init = {
      method: 'GET',
      mode: 'cors',
    } as RequestInit

    return fetch(rawURL, init)
  }
}