// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import '@openzeppelin/contracts/interfaces/IERC4626.sol';

interface IStakedIP {
  function depositIP(address _reciever) external payable returns (uint);

  function burn(uint _shares) external;

  function injectRewards() external payable;
}
