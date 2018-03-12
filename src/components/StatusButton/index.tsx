import * as React from 'react'

import {
  Button,
  Icon,
  Tooltip,
} from 'antd'
import { ButtonProps } from 'antd/lib/button'
import { RenderFunction } from 'antd/lib/tooltip'

// style
import classnames from 'classnames'
import * as classes from './index.css'

function StatusButton(props: IProps) {
  const {
    className,
    buttonClassName,
    disabled,
    onClick,
    children,
    buttonProps,
    renderButton,
    ...statusProps,
  } = props

  const buttonClass = classnames(classes.button, buttonClassName)

  return (
    <div className={classnames(classes.container, className)}>
      {
        renderButton
          ? renderButton({...props, className: buttonClass })
          : (
            <Button
              className={buttonClass}
              size="large"
              type="primary"
              disabled={disabled}
              onClick={onClick}
              {...buttonProps}
            >
              {children}
            </Button>
          )
      }
      {renderStatus(statusProps)}
    </div>
  )
}

function renderStatus({
  statusClassName,
  statusType,
  statusContent,
  helpContent,
}: IStatusProps) {
  if (statusType == null && statusContent == null) {
    return null
  }

  return (
    <div className={statusClassName}>
      {renderStatusIcon(statusType)}
      {statusContent}
      {renderHelp(helpContent)}
    </div>
  )
}

function renderStatusIcon(statusType: IProps['statusType']) {
  if (statusType == null) {
    return null
  }

  return (
    <Icon
      key="StatusButtonIcon"
      className={classnames(classes.statusIcon, STATUS_ICON_MODIFIERS[statusType])}
      type={STATUS_ICON_TYPES[statusType]}
    />
  )
}

function renderHelp(helpText: IProps['helpContent']) {
  if (helpText == null) {
    return null
  }

  return (
    <Tooltip title={helpText}>
      <Icon className={classes.helpIcon} type="question-circle-o" />
    </Tooltip>
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
  helpContent?: React.ReactNode | RenderFunction
}

interface IProps extends IStatusProps {
  renderButton?: (props: IProps) => React.ReactNode
  children?: React.ReactNode
  className?: string
  buttonClassName?: string
  disabled?: boolean
  onClick?: React.FormEventHandler<HTMLButtonElement>
  buttonProps?: ButtonProps
}

export default StatusButton
