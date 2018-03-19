import * as React from 'react'

import ReactGA from 'react-ga'
import { RouteComponentProps } from 'react-router'

ReactGA.initialize('UA-115457961-1')

class Analytics extends React.Component<RouteComponentProps<{}>> {
  public componentDidMount() {
    const { pathname, search } = this.props.location
    this.sendPageChange(pathname, search)
  }

  public componentDidUpdate(prevProps: RouteComponentProps<{}>) {
    const { pathname: prevPathname, search: prevSearch } = prevProps.location
    const { pathname: currentPathname, search: currentSearch } = this.props.location

    if (currentPathname !== prevPathname || currentSearch !== prevSearch) {
      this.sendPageChange(currentPathname, currentSearch)
    }
  }

  public render() {
    return null
  }

  private sendPageChange(pathname: string, search: string = '') {
    const page = pathname + search
    ReactGA.set({ page })
    ReactGA.pageview(page)
  }
}

export default Analytics
