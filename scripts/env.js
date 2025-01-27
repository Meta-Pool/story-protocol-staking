const { getSupportedNetworks } = require('./utils')
require('dotenv').config()

const NETWORK = process.env.NETWORK

if (!getSupportedNetworks().includes(NETWORK)) throw new Error(`Unsupported network: ${NETWORK}`)

module.exports = {
  NETWORK,
  FORKING_CHAIN_ID: Number(process.env.FORKING_CHAIN_ID),
  RPC_URL: process.env.RPC_URL,
  BLOCK_NUMBER: Number(process.env.BLOCK_NUMBER),
  ALICE_PRIVATE_KEY: process.env.ALICE_PRIVATE_KEY,
  BOB_PRIVATE_KEY: process.env.BOB_PRIVATE_KEY,
  CARL_PRIVATE_KEY: process.env.CARL_PRIVATE_KEY,
  ADMIN_PRIVATE_KEY: process.env.ADMIN_PRIVATE_KEY,
  OPERATOR_PRIVATE_KEY: process.env.OPERATOR_PRIVATE_KEY,
  TREASURY_PRIVATE_KEY: process.env.TREASURY_PRIVATE_KEY,
  REWARDS_PRIVATE_KEY: process.env.REWARDS_PRIVATE_KEY,
}
