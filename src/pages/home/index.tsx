import * as React from 'react'

import { inject, observer } from 'mobx-react'

import {
  Istores,
} from '../../stores'

import {
  EthereumStore,
} from '../../stores/EthereumStore'

import {
  UsersStore,
} from '../../stores/UsersStore'

import {
  // SENDING_FAIL_CODE
} from '../../constants'

import CommonHeaderPage from '../../containers/CommonHeaderPage'
// import Session from '../../containers/session'

import {
  noop
} from '../../utils'

import './index.css'

interface IinjectedProps {
  ethereumStore: EthereumStore
  usersStore: UsersStore
}

interface Istate {
  isSending: boolean
  sendingProgress: string
  showCompose: boolean
}

@inject(({
  ethereumStore,
  usersStore
}: Istores) => ({
  ethereumStore,
  usersStore
}))
@observer
class Home extends React.Component<{}, Istate> {
  public readonly state = Object.freeze({
    isSending: false,
    sendingProgress: '',
    showCompose: false
  })

  private readonly injectedProps=  this.props as Readonly<IinjectedProps>

  // private unmounted = false
  private toInput: HTMLInputElement | null
  private subjectInput: HTMLInputElement | null
  private messageInput: HTMLTextAreaElement | null
  private removeEthereumConnectStatusChangeListener = noop
  public componentDidMount(isFirstMount: boolean = true) {
    const {
      ethereumStore: {
        // ethereumConnectStatus,
        // listenForEthereumConnectStatusChange
      },
      usersStore: {
        // currentUserStore
      },
      // loadSessions,
      // isFetchingMessage,
      // isFetchingBoundEvents,
      // startFetchMessages,
      // startFetchBoundEvents,
    } = this.injectedProps
    // if (currentUser) {
    //   loadSessions()
    // }
    // if (ethereumConnectStatus === SUCCESS && currentUser) {
    //   if (!isFetchingMessage) {
    //     startFetchMessages()
    //   }
    //   if (!isFetchingBoundEvents) {
    //     startFetchBoundEvents()
    //   }
    // }
    // if (isFirstMount) {
    //   this.removeEthereumConnectStatusChangeListener =
    //     listenForEthereumConnectStatusChange(this.connectStatusListener)
    // }
  }

  public componentWillUnmount() {
    const {
      // stopFetchMessages,
    } = this.injectedProps
    // this.unmounted = true
    // stopFetchMessages()
    this.removeEthereumConnectStatusChangeListener()
  }

  public render() {
    const {
      ethereumStore: {
        isActive,
      },
      usersStore: {
        // currentUserStore,
        hasUser
      }
      // currentUserSessions,
      // newMessageCount
    } = this.injectedProps
    const {
      showCompose
    } = this.state
    return (
      <CommonHeaderPage>
        {
          isActive && hasUser
            ? <div>
              <button
                style={{
                  margin: '0 auto 20px',
                  width: 200,
                  display: 'block',
                  padding: '10px 20px',
                  borderRadius: '4px',
                  textDecoration: 'none',
                  background: showCompose ? 'red' : 'aquamarine',
                  outline: 'none',
                  border: 0,
                  color: 'white',
                }}
                onClick={this.toggleCompose}
              >
                {showCompose ? 'Cancel' : 'Compose'}
              </button>
              {showCompose
                ? <div>
                    {/* FIXME: Dirty uncontrolled components */}
                    <div>
                      <label>To:</label><input ref={(input) => this.toInput = input}/>
                    </div>
                    <div>
                      <label>Subject:</label><input ref={(input) => this.subjectInput = input}/>
                    </div>
                    <div>
                      <label>Message:</label><textarea ref={(input) => this.messageInput = input}/>
                    </div>
                    <div>
                      <button
                        disabled={this.state.isSending}
                        onClick={this.handleSend}
                      >
                        Send
                      </button>
                    </div>
                  <pre>{this.state.sendingProgress}</pre>
                </div>
                : null}
            </div>
            : null
        }
        {/* {
          ethereumConnectStatus === SUCCESS
          && currentUser
          && newMessageCount > 0
          ? <div
            className="new-messages-prompt"
            onClick={this.refreshSessions}
          >
            Received {newMessageCount} new message(s)
          </div>
          : null
        } */}
        {/* {
          currentUser
            ? <ul className="session-list">{
                currentUserSessions
                  .map((session) => <Session
                    key={session.sessionTag}
                    session={session}
                  />)
              }</ul>
            : 'No account'
        } */}
      </CommonHeaderPage>
    )
  }
  // private refreshSessions = () => {
  //   const {
  //     loadSessions
  //   } = this.injectedProps.store
  //   if (this.unmounted) {
  //     return
  //   }
  //   loadSessions()
  // }

  // private connectStatusListener = (prev: ETHEREUM_CONNECT_STATUS, cur: ETHEREUM_CONNECT_STATUS) => {
  //   const {
  //     stopFetchMessages
  //   } = this.injectedProps.store
  //   if (this.unmounted) {
  //     return
  //   }
  //   if (prev !== SUCCESS) {
  //     this.componentDidMount(false)
  //   } else if (cur !== SUCCESS) {
  //     stopFetchMessages()
  //   }
  // }

  private toggleCompose = () => {
    this.setState({
      showCompose: !this.state.showCompose,
      sendingProgress: ''
    })
  }

  private handleSend = async () => {
    // if (
    //   (!this.toInput || !this.toInput.value)
    //   || (!this.messageInput || !this.messageInput.value)
    //   || !this.subjectInput
    //   || !this.injectedProps.store.currentUser
    // ) {
    //   return
    // }
    // this.setState({
    //   isSending: true
    // })
    // const {
    //   send
    // } = this.injectedProps.store

    // send(
    //   this.toInput.value,
    //   this.subjectInput.value,
    //   this.messageInput.value,
    //   {
    //     transactionWillCreate: this.transactionWillCreate,
    //     transactionDidCreate: this.txCreated,
    //     sendingDidFail: this.sendingDidFail
    //   }
    // ).catch(this.sendingDidFail)
  }

//   private transactionWillCreate = () => {
//     if (this.unmounted) {
//       return
//     }
//     this.setState({
//       sendingProgress: `Sending...
// (You may need to confirm the transaction.)`
//     })
//   }
//   private emptyForm = () => {
//     if (this.toInput) {
//       this.toInput.value = ''
//     }
//     if (this.subjectInput) {
//       this.subjectInput.value = ''
//     }
//     if (this.messageInput) {
//       this.messageInput.value = ''
//     }
//   }

//   private txCreated = () => {
//     this.emptyForm()
//     this.setState(
//       {
//         sendingProgress: 'Sent.',
//         isSending: false
//       },
//       () => {
//         window.setTimeout(
//           () => {
//             if (!this.state.isSending) {
//               this.setState({
//                 sendingProgress: ''
//               })
//             }
//           },
//           3000
//         )
//       }
//     )
//   }

//   private sendingDidFail =  (err: Error | null, code = SENDING_FAIL_CODE.UNKNOWN) => {
//     if (this.unmounted) {
//       return
//     }
//     this.setState({
//       sendingProgress: (() => {
//         switch (code) {
//           case SENDING_FAIL_CODE.UNKNOWN:
//             return `${(err as Error).message} \n ${(err as Error).stack}`
//           case SENDING_FAIL_CODE.INVALID_MESSAGE:
//             return `Invalid message.`
//           default:
//             return 'other'
//         }
//       })(),
//       isSending: false
//     })
//   }
}

export default Home
