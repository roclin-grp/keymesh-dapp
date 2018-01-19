export enum TRUSTBASE_CONNECT_STATUS {
  PENDING = 0,
  OFFLINE = 100,
  NO_ACCOUNT = 101,
  SUCCESS = 200,
  CONTRACT_ADDRESS_ERROR = 400,
  ERROR = 401
}

export const CONNECT_STATUS_INDICATOR_MODIFIER = Object.freeze({
  [TRUSTBASE_CONNECT_STATUS.PENDING]: 'pending',
  [TRUSTBASE_CONNECT_STATUS.OFFLINE]: 'offline',
  [TRUSTBASE_CONNECT_STATUS.NO_ACCOUNT]: 'no-account',
  [TRUSTBASE_CONNECT_STATUS.SUCCESS]: 'success',
  [TRUSTBASE_CONNECT_STATUS.CONTRACT_ADDRESS_ERROR]: 'contract-address-error',
  [TRUSTBASE_CONNECT_STATUS.ERROR]: 'error'
}) as {
  [connectStatus: number]: string
}

export const CONNECT_STATUS_INDICATOR_TEXTS = Object.freeze({
  [TRUSTBASE_CONNECT_STATUS.OFFLINE]: 'Offline',
  [TRUSTBASE_CONNECT_STATUS.NO_ACCOUNT]: 'No Ethereum account (You may need to unlock MetaMask)',
  [TRUSTBASE_CONNECT_STATUS.SUCCESS]: 'Active',
  [TRUSTBASE_CONNECT_STATUS.CONTRACT_ADDRESS_ERROR]: 'Contract addresses error, some function may not work',
  [TRUSTBASE_CONNECT_STATUS.ERROR]: 'Network error, refresh to retry'
}) as {
  [connectStatus: number]: string
}

export enum REGISTER_FAIL_CODE {
  UNKNOWN = 0,
  OCCUPIED = 400,
  TIMEOUT = 500,
}

export enum SENDING_FAIL_CODE {
  UNKNOWN = 0,
  NOT_CONNECTED = 400,
  INVALID_USER_ADDRESS = 401,
  INVALID_MESSAGE = 402,
  SEND_TO_YOURSELF = 403,
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
}) as {
  [messageStatus: number]: string
}

export const NETWORK_NAMES = Object.freeze({
  [NETWORKS.OLYMPIC]: 'Olympic',
  [NETWORKS.MAINNET]: 'Mainnet',
  [NETWORKS.MORDEN]: 'Morden',
  [NETWORKS.ROPSTEN]: 'Ropsten',
  [NETWORKS.RINKEBY]: 'Rinkeby',
  [NETWORKS.KOVAN]: 'Kovan'
}) as {
  [network: number]: string
}

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
  [TABLES.USERS]: '[networkId+userAddress], networkId, [networkId+status]',
  [TABLES.SESSIONS]: '[sessionTag+userAddress], [networkId+userAddress], lastUpdate, contact.userAddress',
  [TABLES.MESSAGES]:
    '[messageId+userAddress], [sessionTag+userAddress], sessionTag, [networkId+userAddress], timestamp',
})

export enum MESSAGE_TYPE {
  HELLO = 0,
  NORMAL = 1,
  CLOSE_SESSION = 2
}

export const GLOBAL_SETTINGS_PRIMARY_KEY = 'global'

export const LOCAL_STORAGE_KEYS = Object.freeze({
  LAST_USED_NETWORK_ID: 'keymail@last-used-network',
  NETWORK_LAST_USED_USER_ADDRESS: Object.freeze(['keymail@', /* networdId */ '@last-used-user']),
  LAST_USED_USER: 'keymail@last-used-user',
  USED_NETWORKS: 'keymail@used-networks'
})

export const FETCH_MESSAGES_INTERVAL = 10000
export const FETCH_BROADCAST_MESSAGES_INTERVAL = 10000
export const FETCH_BOUND_EVENTS_INTERVAL = 500

export const PRE_KEY_ID_BYTES_LENGTH = 2

export const SUMMARY_LENGTH = 32

export const SUBJECT_LENGTH = 32

export enum SOCIAL_MEDIA_PLATFORMS {
  GITHUB = 'github',
  TWITTER = 'twitter',
  FACEBOOK = 'facebook',
}

export const SOCIAL_MEDIAS = [
  {
    'platform': SOCIAL_MEDIA_PLATFORMS.GITHUB,
    'label': 'GitHub',
  },
  {
    'platform': SOCIAL_MEDIA_PLATFORMS.TWITTER,
    'label': 'Twitter',
  },
  {
    'platform': SOCIAL_MEDIA_PLATFORMS.FACEBOOK,
    'label': 'Facebook',
  },
]

export enum BINDING_SOCIAL_STATUS {
  CHECKED = 100,
  TRANSACTION_CREATED = 200,
  CONFIRMED = 300,
}

export enum VERIFY_SOCIAL_STATUS {
  NOT_FOUND = 0,
  INVALID = 100,
  VALID = 200,
}

export const GITHUB_GIST_FILENAME = 'keymail.md'
