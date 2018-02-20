# Keymesh

Trusted communication web [DApp](https://ethereum.stackexchange.com/questions/383/what-is-a-dapp).

## Running The Project

Install project dependencies:

```
yarn install
```

This project uses the [Parcel](https://github.com/parcel-bundler/parcel) bundler for hot-reload development server, as well as project building. Install `parcel` globally first:

```
yarn global add parcel fsevents
```

Then start the dev server:

```
yarn start
```

Then open http://localhost:1234/ in browser. The development version runs on the Rinkeby test network. You should install the [MetaMask Chrome extension](https://metamask.io/), and swtich the network to Rinkeby.

For testing & developing this app, get free test tokens from https://faucet.rinkeby.io/.

## Tasks

<details>
  <summary><em>Under development</em></summary>

  ### Basic features
  - [ ] Chat
    - [ ] Delete session(s)
    - [ ] Delete (selected) message(s).
    - [ ] Search user by proving
  - [ ] Pre-keys
    - [ ] Auto-upload pre-keys when not sufficient
    - [ ] Force replace pre-keys

  ### Enhancements/features
  - [x] Ethereum network/account detect.
  - [x] Identicon
  - [x] Message sending from same browser
</details>
