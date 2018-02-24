import * as React from 'react'

// component
import {
  Icon,
} from 'antd'

// style
import * as styles from './index.css'
import classnames from 'classnames'

function ErrorPage({
  message,
  errorStack,
}: IProps) {
  return (
    <div className={classnames(styles.container, 'page-content')}>
      <Icon type="close-circle-o" className={styles.iconError} />
      <h1>{message}</h1>
      <a target="_blank" href="https://github.com/ceoimon/keymail-webapp/issues/new">Report bugs</a>
      {errorStack
        ? (
          <details>
            <summary>You can provide those error messages to us</summary>
            <pre>{errorStack}</pre>
          </details>
        )
        : null
      }
    </div>
  )
}

interface IProps {
  message: string
  errorStack?: string
}

export default ErrorPage
