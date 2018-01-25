import {
  observable
} from 'mobx'

import {
  Imessage
} from '../../typings/interface.d'

export class SessionStore {
  @observable.ref public messages: Imessage[] = []
}
