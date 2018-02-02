import * as React from 'react'

// component
import {
  Icon,
} from 'antd'

// style
import './index.css'

// helper
import {
  getBEMClassNamesMaker,
} from '../../utils/classNames'

const getBEMClassNames = getBEMClassNamesMaker('error-page')

function ErrorPage({
  message,
  errorStack,
}: IProps) {
  return (
    <>
      <Icon type="close-circle-o" className={getBEMClassNames('icon-error')} />
      <h1>{message}</h1>
      <a target="_blank" href="https://github.com/ceoimon/keymail-webapp/issues/new">Report bugs</a>
      <details>
        <summary>You can provide those error messages to us</summary>
        <pre>{errorStack}</pre>
      </details>
    </>
  )
}

interface IProps {
  message: string
  errorStack: string | undefined
}

export default ErrorPage
