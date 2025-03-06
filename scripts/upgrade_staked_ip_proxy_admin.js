const { ethers } = require("hardhat");

async function main() {
  const PROXY_ADDRESS = "0xd07Faed671decf3C5A6cc038dAD97c8EFDb507c0";
  const PROXY_ADMIN_ADDRESS = "0x86af03287A23868d8bB805Dd8931ABB296553A48";
  const [owner] = await ethers.getSigners();

  console.log(`Using owner: ${owner.address}`);

  const ProxyAdmin = await ethers.getContractAt("ProxyAdmin", PROXY_ADMIN_ADDRESS, owner);

  const NewStakedIP = await ethers.getContractFactory("StakedIP", owner);
  const newImpl = await NewStakedIP.deploy();
  await newImpl.deployed();
  console.log("New implementation deployed at:", newImpl.address);

  console.log("Upgrading proxy using ProxyAdmin...");
  const tx = await ProxyAdmin.upgrade(PROXY_ADDRESS, newImpl.address);
  await tx.wait();

  console.log("Proxy successfully upgraded!");
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
