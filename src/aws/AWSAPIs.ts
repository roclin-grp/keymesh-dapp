import { ETHEREUM_NETWORKS } from '../stores/MetaMaskStore'
import ENV from '../config'

class AWSAPIs {
  constructor(
    private apiPrefix: string,
    private networkID: ETHEREUM_NETWORKS,
  ) { }

  public async uploadAccountInfo(accountInfo: IAccountInfo) {
    return await this.fetch('/account-info', undefined, {
      cache: 'no-cache',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(accountInfo),
      method: 'PUT',
      mode: 'cors',
    })
  }

  private fetch(path: string, queryStr?: string, init?: RequestInit) {
    if (queryStr && queryStr.startsWith('?')) {
      queryStr = '&' + queryStr.substr(1)
    }
    if (queryStr && !queryStr.startsWith('&')) {
      queryStr = '&' + queryStr
    }

    if (!queryStr) {
      queryStr = ''
    }

    return fetch(`${this.apiPrefix}${path}?networkID=${this.networkID}${queryStr}`, init)
  }
}

let awsAPIsInstance: AWSAPIs | undefined

export function getAWSAPIs(networkID: ETHEREUM_NETWORKS): AWSAPIs {
  if (!awsAPIsInstance) {
    awsAPIsInstance = new AWSAPIs(ENV.AWS_API_PREFIX, networkID)
  }

  return awsAPIsInstance
}

export interface IAccountInfo {
  userAddress: string
  name: string
  email: string
  msg: string
  sig: string
  ref?: string
}
