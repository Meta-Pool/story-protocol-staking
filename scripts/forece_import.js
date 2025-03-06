const { ethers, upgrades } = require("hardhat");

async function importProxy() {
    const PROXY_ADDRESS = "0xd07Faed671decf3C5A6cc038dAD97c8EFDb507c0";
    const StakedIP = await ethers.getContractFactory("StakedIP"); // Original contract
    const [owner] = await ethers.getSigners();

    // Import the proxy
    await upgrades.forceImport(PROXY_ADDRESS, StakedIP, { signer: owner });
    console.log("Proxy imported successfully");
}

importProxy().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});