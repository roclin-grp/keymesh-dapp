import * as React from 'react'

import {
  Button,
  Icon,
} from 'antd'
import { ButtonProps } from 'antd/lib/button'

// style
import classnames from 'classnames'
import * as classes from './index.css'

function StatusButton({
  className,
  buttonClassName,
  disabled,
  onClick,
  children,
  buttonProps,
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
        {...buttonProps}
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

export enum STATUS_TYPE {
  LOADING = 'loading',
  INFO = 'info',
  SUCCESS = 'success',
  WARN = 'warn',
  ERROR = 'error',
}

const STATUS_ICON_TYPES = Object.freeze({
  [STATUS_TYPE.LOADING]: 'loading',
  [STATUS_TYPE.INFO]: 'info-circle',
  [STATUS_TYPE.SUCCESS]: 'check-circle',
  [STATUS_TYPE.WARN]: 'exclamation-circle',
  [STATUS_TYPE.ERROR]: 'close-circle',
})

const STATUS_ICON_MODIFIERS = Object.freeze({
  info: classes.info,
  success: classes.success,
  warn: classes.warn,
  error: classes.error,
})

interface IStatusProps {
  statusClassName?: string
  statusType?: STATUS_TYPE
  statusContent?: React.ReactNode
}

interface IProps extends IStatusProps {
  children?: React.ReactNode
  className?: string
  buttonClassName?: string
  disabled?: boolean
  onClick?: React.FormEventHandler<HTMLButtonElement>
  buttonProps?: ButtonProps
}

export default StatusButton
