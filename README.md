# Keymail 

*Under development.*

Trusted communication web [DApp](https://ethereum.stackexchange.com/questions/383/what-is-a-dapp).

<details>
  <summary>Development progress</summary>

  ## Basic features
  - [x] Account registration
  - [x] Send messages.
  - [x] Receive messages.
  - [x] Multi-account.
  - [x] Session summary, show a slice of latest message.
  - [x] Unify username (length) to reduce spoofing. (*Allow same username*)
  - [x] Continue registration from record. (Allow user left the registration page when record saved)
    - [x] Show account registration records in register page
  - [x] Message sending
  - [x] Delete session(s).
  - [ ] Upload pre-keys
    - [x] Upload new pre-keys
    - [ ] Config interval and number
    - [ ] Replace old pre-keys
  - [ ] Prompt for upload new pre-keys when pre-keys not enough.
  - [ ] Import/export account
  - [ ] Setting pages.

  ## Edge case handling
  - [x] Truncate username when over length.
  - [ ] Interrupt registration process when user switch Ethereum Account.
  - [ ] Including current enviroment (Cryptobox/IndexedDBStore) for messages decryptions. (But what if user change network?)

  ## Enhancements/features
  - [x] Ethereum network/account detect.
  - [x] Identicon
  - [x] Message sending from same browser
  - [ ] Use [Antd](https://ant.design) (UI framework)
  - [ ] Delete account
  - [ ] Delete (selected) message(s).
  - [ ] Cache loaded session messages. (Be careful for memory usage.) (*IndexedDB seems fast enough.*)
</details>
