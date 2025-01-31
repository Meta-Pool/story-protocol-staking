// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.23;

import { IIPTokenStaking } from './IIPTokenStaking.sol';

interface IIPTokenStakingFull is IIPTokenStaking {
    function fee() external view returns (uint256);

    function minStakeAmount() external view returns (uint256);
}
