export interface IGist {
  files: {
    [filename: string]: {
      raw_url: string,
    },
  }
  html_url: string
}

export class GithubResource {
  public static async getGists(username: string): Promise<IGist[]> {
    const fetchOptions: RequestInit = {
      method: 'GET',
      mode: 'cors',
    }

    const response = await fetch(`https://api.github.com/users/${username}/gists`, fetchOptions)
    return response.json()
  }

  public static async getGist(url: string): Promise<IGist | null> {
    const parts = /[0-9a-f]+$/.exec(url)
    if (parts === null) {
      return null
    }

    const id = parts[0]
    const fetchOptions: RequestInit = {
      method: 'GET',
      mode: 'cors',
    }

    const response = await fetch(`https://api.github.com/gists/${id}`, fetchOptions)
    return response.json()
  }

  public static async getGistFileContent(url: string, filename: string): Promise<string | null> {
    const gist = await this.getGist(url)

    if (gist === null) {
      return null
    }

    return this.getGistRawContent(gist.files[filename].raw_url)
  }

  public static async getGistRawContent(rawURL: string): Promise<string> {
    const fetchOptions: RequestInit = {
      method: 'GET',
      mode: 'cors',
    }

    const response = await fetch(rawURL, fetchOptions)
    return response.text()
  }
}
