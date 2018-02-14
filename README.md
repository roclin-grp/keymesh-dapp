# Keymesh

Trusted communication web [DApp](https://ethereum.stackexchange.com/questions/383/what-is-a-dapp).

<details>
  <summary><em>Under development</em></summary>

  ### Basic features
  - [x] Accounts
    - [x] Multi-account
    - [x] Continue registration from record (Allow user left the registration page after transaction created)
    - [x] Show account registration records in account management page
    - [x] Import/export account
    - [x] Delete account
  - [ ] Chat
    - [x] Send messages
    - [x] Receive messages
    - [x] Session summary (show a slice of latest message)
    - [ ] Delete session(s)
    - [ ] Delete (selected) message(s).
    - [ ] Search user by proving
  - [x] Proving
    - [x] Basic social media proving
  - [x] Broadcast
    - [x] Send broadcast
    - [x] Receive broadcast
  - [ ] Pre-keys
    - [x] Delete outdated pre-keys
    - [ ] Auto-upload pre-keys when not sufficient
    - [ ] Force replace pre-keys

  ### Enhancements/features
  - [x] Ethereum network/account detect.
  - [x] Identicon
  - [x] Message sending from same browser
</details>

## Running The Project

Install dependencies:

```
yarn install
```

Run dev server:

```
yarn start
```

Then open http://localhost:3000/ in browser. The development version runs on the Rinkeby test network. You should install the [MetaMask Chrome extension](https://metamask.io/), and swtich the network to Rinkeby.

For testing & developing this app, get free test tokens from https://faucet.rinkeby.io/.
