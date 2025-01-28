// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import '@openzeppelin/contracts/interfaces/IERC4626.sol';

interface IRewardsManager {
  function getManagerAccrued() external view returns (uint rewards, uint treasuryFee);
}
