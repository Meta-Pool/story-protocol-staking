// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title Meta Pool stIP 🌒 vault operations contract.

import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import './interfaces/story/IIPTokenStaking.sol';
import './interfaces/IStakedIPVaultOperations.sol';

contract StakedIPVaultOperations is Initializable, OwnableUpgradeable, IStakedIPVaultOperations {
  struct Validator {
    bytes uncmpPubkey;
    uint16 targetStakePercent;
  }

  /// @dev The total sum (100%) of the validators percent as Basis Points.
  uint16 private constant ONE_HUNDRED = 10_000;
  uint16 private constant MAX_VALIDATORS = 10;

  /// @notice Target 🎯 values always sum ONE_HUNDRED, percentage on each validator.
  /// By definition, the following two arrays must be the same size ALL the time.
  /// The size must be greater than 0 and less than, or equal, to MAX_VALIDATORS.
  /// `validators` aka Starting Rotation 🏟️
  Validator[MAX_VALIDATORS] private validators;
  uint public validatorsLength;
  mapping(bytes32 => bool) public validatorExist;

  event InsertValidator(bytes _validator);
  event RemoveValidator(bytes _validator);
  event ReplaceValidator(bytes _oldValidatorUncmpPubkey, bytes _newValidatorUcmpPubkey);
  event UpdateValidatorTargets(address _sender);

  error ValidatorAlreadyListed(bytes _invalidValidator);
  error ValidatorHasTargetPercent(Validator _validator);
  error InvalidLengthArray();
  error ShouldBeOneHundred(uint256 _sumOfPercentages);
  error SizeMismatch();
  error ValidatorNotFount(bytes _validator);
  error ValidatorsEmptyList();

  function initialize(
    bytes[] calldata _validatorsPubkey,
    uint16[] calldata _validatorsStakePercent
  ) public initializer {
    __Ownable_init(msg.sender);
    bulkInsertValidators(_validatorsPubkey);
    updateValidatorsTarget(_validatorsStakePercent);
  }

  modifier checkDuplicatedValidator(bytes memory _validatorUncmpPubkey) {
    bytes32 _validatorPubkeyHash = keccak256(_validatorUncmpPubkey);
    if (validatorExist[_validatorPubkeyHash]) {
      revert ValidatorAlreadyListed(_validatorUncmpPubkey);
    }
    _;
  }

  // ***************************
  // * Update Params Functions *
  // ***************************

  /// Update all the validators target stakes percent
  function updateValidatorsTarget(uint16[] calldata _targetStakesPercent) public onlyOwner {
    uint _validatorsLength = validatorsLength;
    if (_targetStakesPercent.length != _validatorsLength) {
      revert SizeMismatch();
    }

    Validator[MAX_VALIDATORS] memory _validators = validators;

    uint16 stakeSum;
    for (uint i = 0; i < _validatorsLength; ++i) {
      _validators[i].targetStakePercent = _targetStakesPercent[i];
      stakeSum += _targetStakesPercent[i];
    }

    if (stakeSum != ONE_HUNDRED) {
      revert ShouldBeOneHundred(stakeSum);
    }

    validators = _validators;

    emit UpdateValidatorTargets(msg.sender);
  }

  /// @notice Delete validators in bulk
  /// @dev The validators must have zero target percent. Call updateValidatorsTarget() before
  function bulkRemoveValidators(bytes[] memory _validatorsUncmpPubkey) external onlyOwner {
    for (uint i = 0; i < _validatorsUncmpPubkey.length; ++i) {
      _removeValidator(_validatorsUncmpPubkey[i]);
    }
  }

  /// @notice Insert validators in bul with zero target percent
  function bulkInsertValidators(bytes[] memory _validatorsUncmpPubkey) public onlyOwner {
    for (uint i = 0; i < _validatorsUncmpPubkey.length; ++i) {
      _insertValidator(_validatorsUncmpPubkey[i]);
    }
  }

  /// @notice Replace one validator mantaining the target percent
  function replaceOneValidator(
    bytes memory _oldValidatorUncmpPubkey,
    bytes memory _newValidatorUcmpPubkey
  ) external onlyOwner checkDuplicatedValidator(_newValidatorUcmpPubkey) {
    uint256 _index = getValidatorIndex(_oldValidatorUncmpPubkey);
    validators[_index].uncmpPubkey = _newValidatorUcmpPubkey;

    validatorExist[keccak256(_oldValidatorUncmpPubkey)] = false;
    validatorExist[keccak256(_newValidatorUcmpPubkey)] = true;

    emit ReplaceValidator(_oldValidatorUncmpPubkey, _newValidatorUcmpPubkey);
  }

  // *****************
  // * stIP Functions *
  // *****************

  /// @notice Redistribute the total amount of IP into the target percent
  function redistribute(uint256 _totalAmount) external view returns (uint256[] memory) {
    Validator[MAX_VALIDATORS] memory _validators = validators;
    uint256[] memory stakes = new uint256[](validatorsLength);

    /// @dev In case of rounding errors, do not add the leftovers to a 0 percent validator
    uint256 _indexOfNotZeroPercentValidator;
    uint256 totalDistributed = 0; // Should equal _totalQ.
    for (uint i = 0; i < validatorsLength; ++i) {
      if (_validators[i].targetStakePercent == 0) continue;
      _indexOfNotZeroPercentValidator = i;

      uint256 delegateAmount = ((_totalAmount * uint256(_validators[i].targetStakePercent)) / uint256(ONE_HUNDRED));

      stakes[i] = delegateAmount;
      totalDistributed += delegateAmount;
    }

    // Handle rounding errors by adding leftovers to the last distribution
    if (totalDistributed < _totalAmount) {
      stakes[_indexOfNotZeroPercentValidator] += _totalAmount - totalDistributed;
    }

    return stakes;
  }

  function getValidatorIndex(bytes memory _validatorUncmpPubkey) public view returns (uint256) {
    Validator[MAX_VALIDATORS] memory _validators = validators;

    bytes32 _validatorPubkeyHash = keccak256(_validatorUncmpPubkey);
    for (uint256 i = 0; i < _validators.length; ++i) {
      if (keccak256(_validators[i].uncmpPubkey) == _validatorPubkeyHash) {
        return i;
      }
    }

    revert ValidatorNotFount(_validatorUncmpPubkey);
  }

  function _removeValidator(bytes memory _validatorUncmpPubkey) private {
    uint _validatorsLength = validatorsLength;

    // Final validators array cannot be empty
    if (_validatorsLength <= 1) {
      revert ValidatorsEmptyList();
    }

    uint256 _index = getValidatorIndex(_validatorUncmpPubkey);
    Validator memory _validator = validators[_index];

    if (_validator.targetStakePercent > 0) {
      revert ValidatorHasTargetPercent(_validator);
    }

    if (_index != _validatorsLength - 1) {
      // Replace the element at the index with the last element in the array
      validators[_index] = validators[_validatorsLength - 1];
    } else {
      // If the element is the last one, just remove it
      delete validators[_index];
    }

    validatorExist[keccak256(_validatorUncmpPubkey)] = false;
    validatorsLength--;

    emit RemoveValidator(_validatorUncmpPubkey);
  }

  function _insertValidator(
    bytes memory _validatorUncmpPubkey
  ) private checkDuplicatedValidator(_validatorUncmpPubkey) {
    Validator[MAX_VALIDATORS] memory _validators = validators;
    uint _validatorsLength = validatorsLength;

    if (_validatorsLength >= MAX_VALIDATORS) {
      revert InvalidLengthArray();
    }

    validatorExist[keccak256(_validatorUncmpPubkey)] = true;
    _validators[_validatorsLength].uncmpPubkey = _validatorUncmpPubkey;
    validatorsLength++;

    emit InsertValidator(_validatorUncmpPubkey);
  }
}
