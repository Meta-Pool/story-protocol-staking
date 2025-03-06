const {
  RPC_URL,
  BLOCK_NUMBER,
  MNEMONIC,
  FORKING_CHAIN_ID,
  FORK_CHAIN
} = require('./scripts/env')

require('@nomicfoundation/hardhat-toolbox')
require('@openzeppelin/hardhat-upgrades')
require("hardhat-contract-sizer");

const os = require('os')
const fs = require('fs')
const path = require('path')
function resolveHome(filepath) {
  if (filepath[0] === '~') {
    return path.join(os.homedir(), filepath.slice(1));
  }
  return path.resolve(filepath);
}

const forking = {
  url: RPC_URL,
  enabled: FORK_CHAIN,
}

if (BLOCK_NUMBER) {
  forking.blockNumber = BLOCK_NUMBER
}

let privateKey = process.env.OWNER_PRIVATE_KEY
if (!privateKey && process.env.PRIVATE_KEY_FILE) {
  privateKey = fs.readFileSync(resolveHome(process.env.PRIVATE_KEY_FILE), 'utf8').toString().trim()
}

module.exports = {
  defaultNetwork: 'hardhat',
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    hardhat: {
      chainId: FORKING_CHAIN_ID,
      accounts: { mnemonic: MNEMONIC },
      forking,
    },
    story_mainnet: {
      url: RPC_URL,
      accounts: [privateKey]
    },
  },
  etherscan: {
    apiKey: {
      story_mainnet: process.env.STORYSCAN_API_KEY
    },
    customChains: [
      {
        network: "story_mainnet",
        chainId: 1514,
        urls: {
          apiURL: "https://www.storyscan.xyz/api",
          browserURL: "https://www.storyscan.xyz/"
        }
      }
    ]
  },
  solidity: {
    version: '0.8.28',
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: false, // allow tests to run anyway
  },
}