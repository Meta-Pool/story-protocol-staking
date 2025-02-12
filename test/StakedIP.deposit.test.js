const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const {
  deployStoryPoolFixture,
  DUMMY_VALIDATOR_SET,
} = require("./fixtures/deployContracts");
const { getPercentage } = require("./utils");

describe("StakedIP deposits", function () {
  const fixture = deployStoryPoolFixture;

  let IPTokenStakingContract,
    RewardsManagerContract,
    StakedIPContract,
    WIPContract,
    WithdrawalContract,
    FEE,
    owner,
    operator,
    treasury,
    alice,
    bob,
    carl

  beforeEach(async () => {
    ({
      IPTokenStakingContract,
      RewardsManagerContract,
      StakedIPContract,
      WIPContract,
      WithdrawalContract,
      FEE,
      owner,
      operator,
      treasury,
      alice,
      bob,
      carl
    } = await loadFixture(fixture));
  })

  describe("depositIP() - Deposit native IP", () => {
    it(`[D01] InvalidZeroAmount() - Revert depositIP zero amount`, async () => {
      await expect(
        StakedIPContract.connect(alice).depositIP(alice.address, { value: 0 })
      ).to.be.revertedWithCustomError(StakedIPContract, "InvalidZeroAmount");
    });

    it(`[D02] LessThanMinDeposit() - Revert depositIP less than min`, async () => {
      await expect(
        StakedIPContract.connect(alice).depositIP(alice.address, { value: (await StakedIPContract.minDepositAmount()) - 1n })
      ).to.be.revertedWithCustomError(StakedIPContract, "LessThanMinDeposit");
    });

    it("[D03] depositIP() - Deposit native IP with price 1:1", async () => {
      const totalSupply = await StakedIPContract.totalSupply(),
        totalUnderlying = await StakedIPContract.totalUnderlying(),
        depositAmount = ethers.parseEther("5");

      await StakedIPContract.connect(alice).depositIP(alice.address, { value: depositAmount });

      expect(await StakedIPContract.totalSupply()).to.be.equal(totalSupply + depositAmount);
      expect(await StakedIPContract.totalUnderlying()).to.be.equal(totalUnderlying + depositAmount);
      expect(await StakedIPContract.balanceOf(alice.address)).to.be.equal(depositAmount);
    });

    it("[D04] depositIP() - Deposit native IP with price 1:2", async () => {
      const totalSupply = await StakedIPContract.totalSupply(),
        totalUnderlyingBefore = await StakedIPContract.totalUnderlying(),
        depositAmount = ethers.parseEther("5");

      await StakedIPContract.connect(operator).injectRewards({ value: totalUnderlyingBefore });

      const totalUnderlying = await StakedIPContract.totalUnderlying()

      await StakedIPContract.connect(alice).depositIP(alice.address, { value: depositAmount });

      expect(await StakedIPContract.totalSupply()).to.be.equal(totalSupply + (depositAmount / 2n));
      expect(await StakedIPContract.totalUnderlying()).to.be.equal(totalUnderlying + depositAmount);
      expect(await StakedIPContract.balanceOf(alice.address)).to.be.equal(depositAmount / 2n);
    });

    it("[D05] depositIP() - Deposit native IP with price 1:0.95", async () => {
      const totalSupply = await StakedIPContract.totalSupply(),
        totalUnderlyingBefore = await StakedIPContract.totalUnderlying(),
        depositAmount = ethers.parseEther("5");

      await StakedIPContract.connect(owner).updateMaxSlashPercent(500);
      await StakedIPContract.connect(operator).reportSlash(getPercentage(totalUnderlyingBefore, 0.05), DUMMY_VALIDATOR_SET[0].publicKey);

      const totalUnderlying = await StakedIPContract.totalUnderlying()

      const stIPPrice = await StakedIPContract.getStIPPrice()

      await StakedIPContract.connect(alice).depositIP(alice.address, { value: depositAmount });

      const expectedIncrement = depositAmount * BigInt(1e18) / stIPPrice;

      expect(await StakedIPContract.totalSupply()).to.be.equal(totalSupply + expectedIncrement);
      expect(await StakedIPContract.totalUnderlying()).to.be.equal(totalUnderlying + depositAmount);
      expect(await StakedIPContract.balanceOf(alice.address)).to.be.equal(expectedIncrement);
    });
  });

  describe("deposit() - Deposit wrapped IP", () => {
    it(`[D06] InvalidZeroAmount() - Revert deposit zero amount`, async () => {
      await expect(
        StakedIPContract.connect(alice).deposit(0, alice.address)
      ).to.be.revertedWithCustomError(StakedIPContract, "InvalidZeroAmount");
    });

    it(`[D07] LessThanMinDeposit() - Revert deposit less than min`, async () => {
      const depositAmount = await StakedIPContract.minDepositAmount() - 1n;

      await WIPContract.connect(alice).deposit({ value: depositAmount });
      await WIPContract.connect(alice).approve(StakedIPContract.target, depositAmount);

      await expect(
        StakedIPContract.connect(alice).deposit(depositAmount, alice.address)
      ).to.be.revertedWithCustomError(StakedIPContract, "LessThanMinDeposit");
    });

    it("[D08] deposit() - Deposit Wrapped IP with price 1:1", async () => {
      const totalSupply = await StakedIPContract.totalSupply(),
        totalUnderlying = await StakedIPContract.totalUnderlying(),
        depositAmount = ethers.parseEther("5");

      await WIPContract.connect(alice).deposit({ value: depositAmount });

      await WIPContract.connect(alice).approve(StakedIPContract.target, depositAmount);
      await StakedIPContract.connect(alice).deposit(depositAmount, alice.address);

      expect(await StakedIPContract.totalSupply()).to.be.equal(totalSupply + depositAmount);
      expect(await StakedIPContract.totalUnderlying()).to.be.equal(totalUnderlying + depositAmount);
      expect(await StakedIPContract.balanceOf(alice.address)).to.be.equal(depositAmount);
    });

    it("[D09] deposit() - Deposit Wrapped IP with price 1:2", async () => {
      const totalSupply = await StakedIPContract.totalSupply(),
        totalUnderlyingBefore = await StakedIPContract.totalUnderlying(),
        depositAmount = ethers.parseEther("5");

      await StakedIPContract.connect(operator).injectRewards({ value: totalUnderlyingBefore });

      const totalUnderlying = await StakedIPContract.totalUnderlying()

      await WIPContract.connect(alice).deposit({ value: depositAmount });

      await WIPContract.connect(alice).approve(StakedIPContract.target, depositAmount);
      await StakedIPContract.connect(alice).deposit(depositAmount, alice.address);

      expect(await StakedIPContract.totalSupply()).to.be.equal(totalSupply + (depositAmount / 2n));
      expect(await StakedIPContract.totalUnderlying()).to.be.equal(totalUnderlying + depositAmount);
      expect(await StakedIPContract.balanceOf(alice.address)).to.be.equal(depositAmount / 2n);
    });

    it("[D10] deposit() - Deposit Wrapped IP with price 1:0.95", async () => {
      const totalSupply = await StakedIPContract.totalSupply(),
        totalUnderlyingBefore = await StakedIPContract.totalUnderlying(),
        depositAmount = ethers.parseEther("5");

      await StakedIPContract.connect(owner).updateMaxSlashPercent(500);
      await StakedIPContract.connect(operator).reportSlash(getPercentage(totalUnderlyingBefore, 0.05), DUMMY_VALIDATOR_SET[0].publicKey);

      const totalUnderlying = await StakedIPContract.totalUnderlying()

      await WIPContract.connect(alice).deposit({ value: depositAmount });

      await WIPContract.connect(alice).approve(StakedIPContract.target, depositAmount);
      await StakedIPContract.connect(alice).deposit(depositAmount, alice.address);

      const stIPPrice = await StakedIPContract.getStIPPrice()

      const expectedIncrement = depositAmount * BigInt(1e18) / stIPPrice;

      expect(await StakedIPContract.totalSupply()).to.be.equal(totalSupply + expectedIncrement);
      expect(await StakedIPContract.totalUnderlying()).to.be.equal(totalUnderlying + depositAmount);
      expect(await StakedIPContract.balanceOf(alice.address)).to.be.equal(expectedIncrement);
    });
  });

  describe("mintIP() - Mint stIP from native IP", () => {
    it("[D11] InvalidZeroAmount() - Revert mintIP zero amount", async () => {
      await expect(
        StakedIPContract.connect(alice).mintIP(0, alice.address)
      ).to.be.revertedWithCustomError(StakedIPContract, "InvalidZeroAmount");
    });

    it("[D12] LessThanMinDeposit() - Revert mintIP less than min", async () => {
      const depositAmount = await StakedIPContract.minDepositAmount() - 1n;

      await expect(
        StakedIPContract.connect(alice).mintIP(depositAmount, alice.address, { value: depositAmount })
      ).to.be.revertedWithCustomError(StakedIPContract, "LessThanMinDeposit");
    });

    it("[D13] mintIP() - Mint stIP from native IP with price 1:1", async () => {
      const totalSupply = await StakedIPContract.totalSupply(),
        totalUnderlying = await StakedIPContract.totalUnderlying(),
        depositAmount = ethers.parseEther("5");

      await StakedIPContract.connect(alice).mintIP(depositAmount, alice.address, { value: depositAmount });

      expect(await StakedIPContract.totalSupply()).to.be.equal(totalSupply + depositAmount);
      expect(await StakedIPContract.totalUnderlying()).to.be.equal(totalUnderlying + depositAmount);
      expect(await StakedIPContract.balanceOf(alice.address)).to.be.equal(depositAmount);
    });

    it("[D14] mintIP() - Mint stIP from native IP with price 1:2", async () => {
      const totalSupply = await StakedIPContract.totalSupply(),
        totalUnderlyingBefore = await StakedIPContract.totalUnderlying()

      await StakedIPContract.connect(operator).injectRewards({ value: totalUnderlyingBefore });

      const totalUnderlying = await StakedIPContract.totalUnderlying()

      const expectedShares = ethers.parseEther("5"),
        requiredDeposit = expectedShares * 2n;

      await StakedIPContract.connect(alice).mintIP(expectedShares, alice.address, { value: requiredDeposit });

      expect(await StakedIPContract.totalSupply()).to.be.equal(totalSupply + expectedShares);
      expect(await StakedIPContract.totalUnderlying()).to.be.equal(totalUnderlying + requiredDeposit);
      expect(await StakedIPContract.balanceOf(alice.address)).to.be.equal(expectedShares);
    });

    it("[D15] mintIP() - Mint stIP from native IP with price 1:0.95", async () => {
      const totalSupply = await StakedIPContract.totalSupply(),
        totalUnderlyingBefore = await StakedIPContract.totalUnderlying()

      await StakedIPContract.connect(owner).updateMaxSlashPercent(500);
      await StakedIPContract.connect(operator).reportSlash(getPercentage(totalUnderlyingBefore, 0.05), DUMMY_VALIDATOR_SET[0].publicKey);

      const totalUnderlying = await StakedIPContract.totalUnderlying()

      const expectedShares = ethers.parseEther("5"),
        requiredDeposit = getPercentage(expectedShares, 0.95) + 1n;

      await StakedIPContract.connect(alice).mintIP(expectedShares, alice.address, { value: requiredDeposit });

      expect(await StakedIPContract.totalSupply()).to.be.equal(totalSupply + expectedShares);
      expect(await StakedIPContract.totalUnderlying()).to.be.equal(totalUnderlying + requiredDeposit);
      expect(await StakedIPContract.balanceOf(alice.address)).to.be.equal(expectedShares);
    });
  });

  describe("mint() - Mint stIP from wrapped IP", () => {
    it("[D16] InvalidZeroAmount() - Revert mint zero amount", async () => {
      await expect(
        StakedIPContract.connect(alice).mint(0, alice.address)
      ).to.be.revertedWithCustomError(StakedIPContract, "InvalidZeroAmount");
    });

    it("[D17] LessThanMinDeposit() - Revert mint less than min", async () => {
      const depositAmount = await StakedIPContract.minDepositAmount() - 1n;

      await WIPContract.connect(alice).deposit({ value: depositAmount });
      await WIPContract.connect(alice).approve(StakedIPContract.target, depositAmount);

      await expect(
        StakedIPContract.connect(alice).mint(depositAmount, alice.address)
      ).to.be.revertedWithCustomError(StakedIPContract, "LessThanMinDeposit");
    });

    it("[D18] mint() - Mint stIP from wrapped IP with price 1:1", async () => {
      const totalSupply = await StakedIPContract.totalSupply(),
        totalUnderlying = await StakedIPContract.totalUnderlying(),
        depositAmount = ethers.parseEther("5");

      await WIPContract.connect(alice).deposit({ value: depositAmount });

      await WIPContract.connect(alice).approve(StakedIPContract.target, depositAmount);
      await StakedIPContract.connect(alice).mint(depositAmount, alice.address);

      expect(await StakedIPContract.totalSupply()).to.be.equal(totalSupply + depositAmount);
      expect(await StakedIPContract.totalUnderlying()).to.be.equal(totalUnderlying + depositAmount);
      expect(await StakedIPContract.balanceOf(alice.address)).to.be.equal(depositAmount);
    });

    it("[D19] mint() - Mint stIP from wrapped IP with price 1:2", async () => {
      const totalSupply = await StakedIPContract.totalSupply(),
        totalUnderlyingBefore = await StakedIPContract.totalUnderlying()

      await StakedIPContract.connect(operator).injectRewards({ value: totalUnderlyingBefore });

      const totalUnderlying = await StakedIPContract.totalUnderlying()

      const expectedShares = ethers.parseEther("5"),
        requiredDeposit = expectedShares * 2n;

      await WIPContract.connect(alice).deposit({ value: requiredDeposit });

      await WIPContract.connect(alice).approve(StakedIPContract.target, requiredDeposit);
      await StakedIPContract.connect(alice).mint(expectedShares, alice.address);

      expect(await StakedIPContract.totalSupply()).to.be.equal(totalSupply + expectedShares);
      expect(await StakedIPContract.totalUnderlying()).to.be.equal(totalUnderlying + requiredDeposit);
      expect(await StakedIPContract.balanceOf(alice.address)).to.be.equal(expectedShares);
    });

    it("[D20] mint() - Mint stIP from wrapped IP with price 1:0.95", async () => {
      const totalSupply = await StakedIPContract.totalSupply(),
        totalUnderlyingBefore = await StakedIPContract.totalUnderlying()

      await StakedIPContract.connect(owner).updateMaxSlashPercent(500);
      await StakedIPContract.connect(operator).reportSlash(getPercentage(totalUnderlyingBefore, 0.05), DUMMY_VALIDATOR_SET[0].publicKey);

      const totalUnderlying = await StakedIPContract.totalUnderlying()

      const expectedShares = ethers.parseEther("5"),
        requiredDeposit = getPercentage(expectedShares, 0.95) + 1n;

      await WIPContract.connect(alice).deposit({ value: requiredDeposit });
      await WIPContract.connect(alice).approve(StakedIPContract.target, requiredDeposit);

      await StakedIPContract.connect(alice).mint(expectedShares, alice.address);

      expect(await StakedIPContract.totalSupply()).to.be.equal(totalSupply + expectedShares);
      expect(await StakedIPContract.totalUnderlying()).to.be.equal(totalUnderlying + requiredDeposit);
      expect(await StakedIPContract.balanceOf(alice.address)).to.be.equal(expectedShares);
    });
  });
})