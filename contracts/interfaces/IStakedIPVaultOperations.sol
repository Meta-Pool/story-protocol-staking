// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IStakedIPVaultOperations {
  function getValidatorIndex(bytes memory _validatorUncmpPubkey) external view returns (uint256);

  function isValidatorListed(bytes memory _validatorUncmpPubkey) external view returns (bool);
}
