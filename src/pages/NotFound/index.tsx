import * as React from 'react'

import { RouteComponentProps, withRouter } from 'react-router'
import { Icon } from 'antd'

import * as classes from './index.css'
import composeClass from 'classnames'

function NotFound(props: IProps) {
  const { message } = props
  return (
    <div className={'page-container'}>
      <section className={composeClass('block', 'center-align-column-container')}>
        <Icon className={classes.notFoundIcon} type="frown-o" />
        <p className={classes.notFoundText}>{message != null ? message : 'Page Not Found'}</p>
        <a role="button" onClick={props.history.goBack}>Go Back</a>
      </section>
    </div>
  )
}

interface IProps extends RouteComponentProps<{}> {
  message?: React.ReactNode
}

export default withRouter(NotFound)
