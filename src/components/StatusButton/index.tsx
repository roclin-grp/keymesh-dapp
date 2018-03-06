import * as React from 'react'

import {
  Button,
  Icon,
} from 'antd'

// style
import classnames from 'classnames'
import * as classes from './index.css'

function StatusButton({
  className,
  buttonClassName,
  disabled,
  onClick,
  children,
  ...statusProps,
}: IProps) {
  return (
    <div className={classnames(classes.container, className)}>
      <Button
        className={classnames(classes.button, buttonClassName)}
        size="large"
        type="primary"
        disabled={disabled}
        onClick={onClick}
      >
        {children}
      </Button>
      {renderStatus(statusProps)}
    </div>
  )
}

function renderStatus({
  statusClassName,
  statusType,
  statusContent,
}: IStatusProps) {
  if (statusType == null && statusContent == null) {
    return null
  }

  return (
    <div className={statusClassName}>
      {renderStatusIcon(statusType)}
      {statusContent}
    </div>
  )
}

function renderStatusIcon(statusType: IProps['statusType']) {
  if (statusType == null) {
    return null
  }

  return (
    <Icon
      className={classnames(classes.statusIcon, STATUS_ICON_MODIFIERS[statusType])}
      type={STATUS_ICON_TYPES[statusType]}
    />
  )
}

const STATUS_ICON_TYPES = Object.freeze({
  loading: 'loading',
  info: 'info-circle',
  success: 'check-circle',
  warn: 'exclamation-circle',
  error: 'close-circle',
})

const STATUS_ICON_MODIFIERS = Object.freeze({
  info: classes.info,
  success: classes.success,
  warn: classes.warn,
  error: classes.error,
})

interface IStatusProps {
  statusClassName?: string
  statusType?: 'loading' | 'info' | 'success' | 'warn' | 'error'
  statusContent?: React.ReactNode
}

interface IProps extends IStatusProps {
  children?: React.ReactNode
  className?: string
  buttonClassName?: string
  disabled?: boolean
  onClick?: React.FormEventHandler<HTMLButtonElement>
}

export default StatusButton
