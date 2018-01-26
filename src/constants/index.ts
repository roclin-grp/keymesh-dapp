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

export enum MESSAGE_TYPE {
  HELLO = 0,
  NORMAL = 1,
  CLOSE_SESSION = 2
}

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

export * from './ethereum'
