const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const {
  deployStoryPoolFixture,
  DUMMY_VALIDATOR_SET,
} = require("./fixtures/deployContracts");

describe("StakedIP fullyOperational", function () {
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

  describe("fullyOperational() - Manage fullyOperational state", () => {
    it(`[FO01] fullyOperational() - StakedIP initialize as fullyOperational`, async () => {
      expect(await StakedIPContract.fullyOperational()).to.be.true;
    });

    it(`[FO02] toggleContractOperation() - Revert if caller is not the owner OwnableUnauthorizedAccount()`, async () => {
      await expect(
        StakedIPContract.connect(alice).toggleContractOperation()
      ).to.be.revertedWithCustomError(StakedIPContract, "OwnableUnauthorizedAccount");
    });

    it(`[FO03] toggleContractOperation() - Set StakedIP as not fullyOperational`, async () => {
      await StakedIPContract.connect(owner).toggleContractOperation();
      expect(await StakedIPContract.fullyOperational()).to.be.false;
    });

    it(`[FO04] toggleContractOperation() - Set back StakedIP as fullyOperational`, async () => {
      await StakedIPContract.connect(owner).toggleContractOperation();
      await StakedIPContract.connect(owner).toggleContractOperation();
      expect(await StakedIPContract.fullyOperational()).to.be.true;
    });
  });

  describe("NotFullyOperational() - Revert disallowed functions when not fully operational", () => {
    it(`[FO05] NotFullyOperational() - Revert deposit not operational`, async () => {
      const depositAmount = ethers.parseEther("1");

      await WIPContract.connect(alice).deposit({ value: depositAmount });
      await WIPContract.connect(alice).approve(StakedIPContract.target, depositAmount);

      await StakedIPContract.connect(owner).toggleContractOperation();

      await expect(
        StakedIPContract.connect(alice).deposit(depositAmount, alice.address)
      ).to.be.revertedWithCustomError(StakedIPContract, "NotFullyOperational");
    });

    it(`[FO06] NotFullyOperational() - Revert depositIP not operational`, async () => {
      await StakedIPContract.connect(owner).toggleContractOperation();

      await expect(
        StakedIPContract.connect(alice).depositIP(alice.address, { value: ethers.parseEther("1") })
      ).to.be.revertedWithCustomError(StakedIPContract, "NotFullyOperational");
    });

    it(`[FO07] NotFullyOperational() - Revert mint not operational`, async () => {
      const depositAmount = ethers.parseEther("1");

      await WIPContract.connect(alice).deposit({ value: depositAmount });
      await WIPContract.connect(alice).approve(StakedIPContract.target, depositAmount);

      await StakedIPContract.connect(owner).toggleContractOperation();

      await expect(
        StakedIPContract.connect(alice).mint(depositAmount, alice.address)
      ).to.be.revertedWithCustomError(StakedIPContract, "NotFullyOperational");
    });

    it(`[FO08] NotFullyOperational() - Revert mintIP not operational`, async () => {
      await StakedIPContract.connect(owner).toggleContractOperation();

      await expect(
        StakedIPContract.connect(alice).mintIP(ethers.parseEther("1"), alice.address, { value: ethers.parseEther("1") })
      ).to.be.revertedWithCustomError(StakedIPContract, "NotFullyOperational");
    })

    it(`[FO09] NotFullyOperational() - Revert withdraw not operational`, async () => {
      const amount = ethers.parseEther("1");
      await StakedIPContract.connect(alice).depositIP(alice.address, { value: amount });

      await StakedIPContract.connect(owner).toggleContractOperation();

      await expect(
        StakedIPContract.connect(alice).withdraw(amount, alice.address, alice.address)
      ).to.be.revertedWithCustomError(StakedIPContract, "NotFullyOperational");
    });

    it(`[FO10] NotFullyOperational() - Revert redeem not operational`, async () => {
      const amount = ethers.parseEther("1");
      await StakedIPContract.connect(alice).depositIP(alice.address, { value: amount });

      await StakedIPContract.connect(owner).toggleContractOperation();

      await expect(
        StakedIPContract.connect(alice).redeem(amount, alice.address, alice.address)
      ).to.be.revertedWithCustomError(StakedIPContract, "NotFullyOperational");
    });


    it(`[FO11] NotFullyOperational() - Revert stake not operational`, async () => {
      await StakedIPContract.connect(owner).toggleContractOperation();

      await expect(
        StakedIPContract.connect(operator).stake(DUMMY_VALIDATOR_SET[0].publicKey, 0, 0, '0x')
      ).to.be.revertedWithCustomError(StakedIPContract, "NotFullyOperational");
    });

    it(`[FO12] NotFullyOperational() - Revert unstake not operational`, async () => {
      await StakedIPContract.connect(owner).toggleContractOperation();

      await expect(
        StakedIPContract.connect(operator).unstake(DUMMY_VALIDATOR_SET[0].publicKey, 0, 0, '0x')
      ).to.be.revertedWithCustomError(StakedIPContract, "NotFullyOperational");
    });

    it(`[FO13] NotFullyOperational() - Revert redelegate not operational`, async () => {
      await StakedIPContract.connect(owner).toggleContractOperation();

      await expect(
        StakedIPContract.connect(operator).redelegate(DUMMY_VALIDATOR_SET[0].publicKey, DUMMY_VALIDATOR_SET[1].publicKey, 0, 0)
      ).to.be.revertedWithCustomError(StakedIPContract, "NotFullyOperational");
    });

    it(`[FO14] NotFullyOperational() - Revert injectRewards not operational`, async () => {
      await StakedIPContract.connect(owner).toggleContractOperation();

      await expect(
        StakedIPContract.connect(owner).injectRewards()
      ).to.be.revertedWithCustomError(StakedIPContract, "NotFullyOperational");
    });
  });
})
