const { NETWORK } = require("../scripts/env");

module.exports = require(`./networks/${NETWORK}`)
