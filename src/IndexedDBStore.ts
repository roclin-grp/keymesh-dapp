import { store } from 'wire-webapp-cryptobox/dist/typings/wire-webapp-cryptobox.d'
const IndexedDB: typeof store.IndexedDB = require('wire-webapp-cryptobox/dist/commonjs/store/IndexedDB').default

class IndexedDBStore extends IndexedDB {
  public async delete_prekey() { return -42 }
  public deletePrekey(preKeyID: number) {
    return super.delete_prekey(preKeyID)
  }
}

export default IndexedDBStore
