
const BigNumber = require("bignumber.js");

const getBlockNumber = async () => ethers.provider.getBlockNumber()

const getNativeBalance = async (address) => new BigNumber(await ethers.provider.getBalance(address)).div(1e18)

const getPercentage = (amount, percentage) => amount * BigInt(percentage * 100) / 10000n

const contract = async (address, name) => {
    try {
        const artifact = await artifacts.readArtifact(name);
        return new ethers.Contract(address, artifact.abi, ethers.provider);
    } catch (error) {
        console.error(`Error creating contract for ${name}:`, error);
        throw error;
    }
}

module.exports = {
    getBlockNumber,
    getNativeBalance,
    contract,
    getPercentage
};