export enum ETHEREUM_NETWORKS {
  OLYMPIC = 0,
  MAINNET = 1,
  MORDEN = 2,
  ROPSTEN = 3,
  RINKEBY = 4,
  KOVAN = 42
}

export const ETHEREUM_NETWORK_NAMES = Object.freeze({
  [ETHEREUM_NETWORKS.OLYMPIC]: 'Olympic',
  [ETHEREUM_NETWORKS.MAINNET]: 'Mainnet',
  [ETHEREUM_NETWORKS.MORDEN]: 'Morden',
  [ETHEREUM_NETWORKS.ROPSTEN]: 'Ropsten',
  [ETHEREUM_NETWORKS.RINKEBY]: 'Rinkeby',
  [ETHEREUM_NETWORKS.KOVAN]: 'Kovan'
}) as {
  [networkID: number]: string
}
