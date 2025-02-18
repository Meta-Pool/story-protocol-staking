const { task } = require("hardhat/config");
const { Wallet, parseEther } = require("ethers");
const { STAKED_IP_ADDRESS } = require("../constants");

task("inject-rewards", "Injects rewards into the StakedIP contract")
    .addParam("rewards", "Amount of IP to inject as rewards (e.g., 1 for 1 IP)")
    .setAction(async (taskArgs, hre) => {
        const provider = hre.ethers.provider;
        const owner = new Wallet(process.env.OWNER_PRIVATE_KEY, provider);

        const rewardsAmount = parseEther(taskArgs.rewards);

        console.log("Sending transaction with", owner.address);
        console.log(`Injecting rewards: ${taskArgs.rewards} IP (${rewardsAmount.toString()} wei)`);

        const StakedIP = await hre.ethers.getContractFactory("StakedIP");
        const stakedIP = StakedIP.attach(STAKED_IP_ADDRESS).connect(owner);

        const tx = await stakedIP.injectRewards({ value: rewardsAmount });
        await tx.wait();

        console.log("Transaction confirmed at:", tx.hash);
    });

module.exports = {};
