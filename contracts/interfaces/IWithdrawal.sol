// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import '@openzeppelin/contracts/interfaces/IERC4626.sol';

interface IWithdrawal {
    function requestWithdraw(uint256 _amountOut, address _user, address _receiver) external;

    function totalPendingWithdrawals() external view returns (uint256);
}
