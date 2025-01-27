const {
  RPC_URL,
  BLOCK_NUMBER,
  ALICE_PRIVATE_KEY,
  BOB_PRIVATE_KEY,
  CARL_PRIVATE_KEY,
  ADMIN_PRIVATE_KEY,
  OPERATOR_PRIVATE_KEY,
  TREASURY_PRIVATE_KEY,
  REWARDS_PRIVATE_KEY,
  FORKING_CHAIN_ID
} = require('./scripts/env')

require('@nomicfoundation/hardhat-toolbox')
require('@openzeppelin/hardhat-upgrades')

module.exports = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      chainId: FORKING_CHAIN_ID,
      accounts: [ALICE_PRIVATE_KEY, BOB_PRIVATE_KEY, CARL_PRIVATE_KEY].map(pk => ({ privateKey: pk, balance: '10000000000000000000000' })),
      forking: {
        url: RPC_URL,
        blockNumber: BLOCK_NUMBER,
        enabled: true,
      },
    },
    testnet: {
      url: RPC_URL,
      accounts: [ALICE_PRIVATE_KEY, BOB_PRIVATE_KEY, CARL_PRIVATE_KEY],
    },
    mainnet: {
      url: RPC_URL,
      accounts: [ADMIN_PRIVATE_KEY, OPERATOR_PRIVATE_KEY, TREASURY_PRIVATE_KEY, REWARDS_PRIVATE_KEY],
    },
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
  }
}