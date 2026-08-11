# Kohaku Wallet

<picture>
<source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/ethereum/kohaku/refs/heads/master/docs/public/kohaku_logo.svg">
<img alt="Kohaku logo" src="https://raw.githubusercontent.com/ethereum/kohaku/refs/heads/master/docs/public/kohaku_logo.svg" width="auto" height="60">
</picture>

The Kohaku Wallet is a reference implementation browser wallet that consumes the [Kohaku SDK](https://github.com/ethereum/kohaku). The goal is to embed onchain privacy directly into ethereum wallets.

Kohaku Wallet is a fork of [Ambire Wallet](https://github.com/AmbireTech/extension)

It's a work in progress and currently under active development. The only network it supports is Sepolia Testnet.

## Demo

Demo a pre-built version (March 2026) of the Kohaku Wallet on sepolia testnet.

1. Download the zip file here: https://ipfs.io/ipfs/bafybeicf45pmqwoyoa7fdwpeg2tzfugchosbelwvkkg7dp6am6lguwzod4 and then unzip it (folder will be called `webkit-dev`)

2. Open Chrome browser and navigate to: `chrome://extensions/`

3. Select `Developer mode` in the upper right corner then click `Load unpacked` and select the `webkit-dev` folder to load the Kohaku Wallet Demo


## Develop

Here are the steps to build and run the kohaku extension yourself:

1. **Clone this repository**: Run `git clone <repo-url>`. Then enter the repo's root directory.

2. **Initialize submodules**: Run `git submodule update --init --recursive`. This pulls in [kohaku-commons](https://github.com/ethereum/kohaku-commons) (the Kohaku fork of `ambire-common`), which holds the business logic.

3. **Create and fill in .env file**: Run `cp .env-sample .env`. Then fill in vars on `.env` file. See below for description of REQUIRED vars to fill in:

   | Variable                         | Description                                                                                             |
   |----------------------------------|---------------------------------------------------------------------------------------------------------|
   | **SEPOLIA_RPC_URL**              | Must be able to handle heavy requests load and read `eth_getLogs` requests with up to a 10 block range. |
   | **ALCHEMY_API_KEY**              | An [alchemy](https://alchemy.com) api key that supports sepolia testnet (regardless of SEPOLIA_RPC_URL above - an alchemy url or not - you need to fill in this ALCHEMY_API_KEY var separately) |
   | **HYPERSYNC_API_KEY**            | You can generate your API Key [here](https://envio.dev/app/api-tokens).                                 |
   | **BROWSER_EXTENSION_PUBLIC_KEY** | For development, generate `key.pem` as explained [here](https://stackoverflow.com/a/46739698/1333836).  |
   | **REACT_APP_PIMLICO_API_KEY**    | You can generate your API Key [here](https://dashboard.pimlico.io).           |

4. **Install dependencies**: Run `yarn setup` (never `yarn install` directly — `setup` also runs `allow-scripts` and `patch-package`). This requires Node >= 24.13.0 and yarn >= 1.22.22, as pinned in `.nvmrc` and `package.json` engines.

   Do **not** run `npm install` inside `src/ambire-common`. The extension bundles the submodule's sources and resolves their dependencies from the root `node_modules`, so a nested install is unnecessary — and it breaks the production build, because LavaMoat cannot attribute files under `src/ambire-common/node_modules` to a package. Install there only when running ambire-common's own test suite, and remove it again before building. If a submodule dependency is missing at build time, add it to the root `package.json` instead.

5. **Build the extension**: Execute `yarn web:webkit` to build the kohaku-extension. Once you see the two “web compiled successfully” logs, you can stop the process (or keep it running if you prefer). Just open a new terminal tab for the next step.

6. **Load the unpacked extension**: Load the unpacked extension in Chrome (from inside the `build/webkit-dev` folder), and you’re good to go!

## Troubleshooting

Make sure your `SEPOLIA_RPC_URL` is a strong RPC that can handle heavy load. If using a free tier RPC, we recommend **Infura**.

`RPC_PROVIDER` defaults to `colibri`. If you're having any issues related to the rpc syncing chain data consider setting it to `rpc` (no lightclient)
