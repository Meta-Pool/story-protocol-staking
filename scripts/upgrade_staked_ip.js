const { ethers, upgrades } = require("hardhat");

async function main() {
    const [owner] = await ethers.getSigners();

    const PROXY_ADDRESS = "0xd07Faed671decf3C5A6cc038dAD97c8EFDb507c0";

    const NewStakedIP = await ethers.getContractFactory("StakedIP", owner);

    console.log("Deploying new implementation and upgrading proxy for StakedIP");

    const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, NewStakedIP, { signer: owner });

    //console.log(`Proxy upgraded successfully. New implementation at: ${await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS)}`);
    console.log("Upgraded to:", upgraded.address);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
