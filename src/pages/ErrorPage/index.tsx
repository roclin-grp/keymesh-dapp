import * as React from 'react'

// component
import {
  Icon,
} from 'antd'

// style
import * as styles from './index.css'

function ErrorPage({
  message,
  errorStack,
}: IProps) {
  return (
    <>
      <Icon type="close-circle-o" className={styles.iconError} />
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
