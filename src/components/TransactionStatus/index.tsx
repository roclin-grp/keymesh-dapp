import * as React from 'react'

import { Tooltip, Icon } from 'antd'

import * as classes from './index.css'

import { ETHEREUM_NETWORK_TX_URL_PREFIX, ETHEREUM_NETWORKS } from '../../stores/MetaMaskStore'

import ENV from '../../config'

function TransactionStatus(props: IProps) {
  const { status, shouldHideHelp } = props

  const content = getSummaryText(status, props)
  const helpMessages = getHelpMessage(status, props)
  const helpIcon = shouldHideHelp || helpMessages == null ? null : (
    <Tooltip title={getHelpMessage(status, props)}>
      <Icon key="helpIcon" className={classes.helpIcon} type="question-circle-o" />
    </Tooltip>
  )

  return (
    <>
      {renderTransactionLink(content, props)}
      {helpIcon}
    </>
  )
}

function getSummaryText(status: TRANSACTION_STATUS, props: IProps): React.ReactNode {
  const { summaries } = props
  if (summaries == null || summaries[status] == null) {
    return DEFAULT_TRNASACTION_STATUS_SUMMARY_TEXT[status]
  }

  return summaries[status]
}

function getHelpMessage(status: TRANSACTION_STATUS, props: IProps): React.ReactNode {
  const { helpMessages } = props
  if (helpMessages == null || helpMessages[status] == null) {
    return DEFAULT_TRNASACTION_STATUS_HELP_MESSAGES[status]
  }

  return helpMessages[status]
}

function renderTransactionLink(
  content: React.ReactNode,
  props: IProps,
) {
  const { transactionHash } = props
  if (transactionHash == null) {
    return content
  }

  const { confirmationNumber } = props
  let confirmationCount: React.ReactNode = null
  if (
    confirmationNumber != null &&
    confirmationNumber < ENV.REQUIRED_CONFIRMATION_NUMBER
  ) {
    confirmationCount = ` (${confirmationNumber}/${ENV.REQUIRED_CONFIRMATION_NUMBER})`
  }

  const { networkId } = props
  const explorerUrl = ETHEREUM_NETWORK_TX_URL_PREFIX[networkId]
  if (explorerUrl == null) {
    return (
      <>
        {content}
        {confirmationCount}
      </>
    )
  }

  return (
    <a
      className={classes.transactionLink}
      target="_blank"
      href={`${explorerUrl}${transactionHash}`}
    >
      {content}
      {confirmationCount}
    </a>
  )
}

export enum TRANSACTION_STATUS {
  PENDING = 'pending',
  REJECTED = 'rejected',
  TRANSACTING = 'transacting',
  TIMEOUT = 'timeout',
  TRANSACTION_ERROR = 'transactionError',
  UNEXCEPTED_ERROR = 'unexceptedError',
}

export const DEFAULT_TRNASACTION_STATUS_SUMMARY_TEXT = Object.freeze({
  [TRANSACTION_STATUS.PENDING]: 'Pending authorization',
  [TRANSACTION_STATUS.REJECTED]: 'Transaction rejected',
  [TRANSACTION_STATUS.TRANSACTING]: 'Transacting...',
  [TRANSACTION_STATUS.TIMEOUT]: 'Transaction taking too long',
  [TRANSACTION_STATUS.TRANSACTION_ERROR]: 'Transaction failed',
  [TRANSACTION_STATUS.UNEXCEPTED_ERROR]: 'Unexpected error',
})

export const DEFAULT_TRNASACTION_STATUS_HELP_MESSAGES = Object.freeze({
  [TRANSACTION_STATUS.PENDING]:
    'Please confirm the transaction on MetaMask. (Click the extension icon if you closed the pop-up window.)',
  [TRANSACTION_STATUS.TRANSACTING]: 'Transaction confirms in about 1 minute',
  [TRANSACTION_STATUS.TIMEOUT]: `Transaction was not mined within ${ENV.TRANSACTION_TIME_OUT_BLOCK_NUMBER} blocks`,
  [TRANSACTION_STATUS.TRANSACTION_ERROR]: 'Please make sure you have enough fund',
  [TRANSACTION_STATUS.UNEXCEPTED_ERROR]: 'Sorry! Please try again later',
})

interface IProps {
  status: TRANSACTION_STATUS
  networkId: ETHEREUM_NETWORKS
  confirmationNumber?: number
  transactionHash?: string
  shouldHideHelp?: boolean
  summaries?: { [transactionStatus in TRANSACTION_STATUS]?: React.ReactNode }
  helpMessages?: { [transactionStatus in TRANSACTION_STATUS]?: React.ReactNode }
}

export default TransactionStatus
