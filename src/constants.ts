export enum TRUSTBASE_CONNECT_STATUS {
  PENDING = 0,
  OFFLINE = 100,
  NO_ACCOUNT = 101,
  SUCCESS = 200,
  CONTRACT_ADDRESS_ERROR = 400,
  ERROR = 401
}

export const CONNECT_STATUS_INDICATOR_COLORS = Object.freeze({
  [TRUSTBASE_CONNECT_STATUS.PENDING]: 'transparent',
  [TRUSTBASE_CONNECT_STATUS.OFFLINE]: 'grey',
  [TRUSTBASE_CONNECT_STATUS.NO_ACCOUNT]: 'orange',
  [TRUSTBASE_CONNECT_STATUS.SUCCESS]: 'chartreuse',
  [TRUSTBASE_CONNECT_STATUS.CONTRACT_ADDRESS_ERROR]: 'orange',
  [TRUSTBASE_CONNECT_STATUS.ERROR]: 'red'
})

export const CONNECT_STATUS_INDICATOR_TEXTS = Object.freeze({
  [TRUSTBASE_CONNECT_STATUS.OFFLINE]: 'Offline',
  [TRUSTBASE_CONNECT_STATUS.NO_ACCOUNT]: 'No Ethereum account (You may need to unlock MetaMask)',
  [TRUSTBASE_CONNECT_STATUS.SUCCESS]: 'Active',
  [TRUSTBASE_CONNECT_STATUS.CONTRACT_ADDRESS_ERROR]: 'Contract addresses error, some function may not work',
  [TRUSTBASE_CONNECT_STATUS.ERROR]: 'Network error, refresh to retry'
})

export enum REGISTER_FAIL_CODE {
  UNKNOWN = 0,
  FOUND_ON_LOCAL = 302,
  NOT_CONNECTED = 400,
  INVALID_USERNAME = 401,
  OCCUPIED = 402,
  TIMEOUT = 501,
}

export enum SENDING_FAIL_CODE {
  UNKNOWN = 0,
  NOT_CONNECTED = 400,
  INVALID_USERNAME = 401,
  INVALID_MESSAGE = 402
}

export enum NETWORKS {
  OLYMPIC = 0,
  MAINNET = 1,
  MORDEN = 2,
  ROPSTEN = 3,
  RINKEBY = 4,
  KOVAN = 42
}

export enum USER_STATUS {
  PENDING = 0,
  IDENTITY_UPLOADED = 1,
  OK = 2
}

export enum MESSAGE_STATUS {
  DELIVERING = 0,
  DELIVERED = 1,
  FAILED = 2
}

export const MESSAGE_STATUS_STR = Object.freeze({
  [MESSAGE_STATUS.DELIVERING]: 'Delivering',
  [MESSAGE_STATUS.FAILED]: 'Failed',
  [MESSAGE_STATUS.DELIVERED]: 'Delivered',
})

export const NETWORK_NAMES = Object.freeze({
  [NETWORKS.OLYMPIC]: 'Olympic',
  [NETWORKS.MAINNET]: 'Mainnet',
  [NETWORKS.MORDEN]: 'Morden',
  [NETWORKS.ROPSTEN]: 'Ropsten',
  [NETWORKS.RINKEBY]: 'Rinkeby',
  [NETWORKS.KOVAN]: 'Kovan'
})

export enum TABLES {
  GLOBAL_SETTINGS = 'global-settings',
  NETWORK_SETTINGS = 'network-settings',
  USERS = 'users',
  SESSIONS = 'sessions',
  MESSAGES = 'messages'
}

export const SCHEMA_V1 = Object.freeze({
  [TABLES.GLOBAL_SETTINGS]: '',
  [TABLES.NETWORK_SETTINGS]: 'networkId',
  [TABLES.USERS]: '[networkId+usernameHash], networkId, [networkId+status]',
  [TABLES.SESSIONS]: '[sessionTag+usernameHash], [networkId+usernameHash], lastUpdate, contact.usernameHash',
  [TABLES.MESSAGES]: '[sessionTag+timestamp], sessionTag, [networkId+usernameHash], timestamp',
})

export enum MESSAGE_TYPE {
  HELLO = 0,
  NORMAL = 1,
  CLOSE_SESSION = 2
}

export const GLOBAL_SETTINGS_PRIMARY_KEY = 'global'

export const LOCAL_STORAGE_KEYS = Object.freeze({
  LAST_USED_NETWORK_ID: 'keymail@last-used-network',
  NETWORK_LAST_USED_USERNAME_HASH: Object.freeze(['keymail@', /* networdId */ '@last-used-user']),
  LAST_USED_USER: 'keymail@last-used-user',
  USED_NETWORKS: 'keymail@used-networks'
})

export const FETCH_MESSAGES_INTERVAL = 10000

export const PRE_KEY_ID_BYTES_LENGTH = 2

export const SUMMARY_LENGTH = 32

export const SUBJECT_LENGTH = 32
