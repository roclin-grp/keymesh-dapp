import { store } from 'wire-webapp-cryptobox'

class IndexedDBStore extends store.IndexedDB {
  public async delete_prekey() { return -42 }
  public deletePrekey(preKeyID: number) {
    return super.delete_prekey(preKeyID)
  }
}

export default IndexedDBStore
