// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title Meta Pool stIP 🌒 vault contract.

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol';
import '@openzeppelin/contracts/interfaces/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import './interfaces/story/IIPTokenStaking.sol';
import './interfaces/IStakedIP.sol';
import './interfaces/IStakedIPVaultOperations.sol';
import './interfaces/IWIP.sol';
import './interfaces/IWithdrawal.sol';

/// @notice [FullyOperational] When is NOT fully operational, users cannot:
/// 1) mint, 2) deposit, 3) withdraw nor 4) redeem.

contract StakedIP is Initializable, ERC4626Upgradeable, OwnableUpgradeable, IStakedIP {
  using Address for address payable;
  using SafeERC20 for IERC20;

  IStakedIPVaultOperations public operations;
  bytes public delegatorUncmpPubkey;
  uint public minDepositAmount;
  uint public totalUnderlying;
  address public ipTokenStaking;
  address public operator;
  address public rewardsManager;
  address public withdrawal;
  bool public fullyOperational;

  event Stake(address _caller, bytes indexed _validator, uint _delegation_id, uint _amount, bytes _extraData);
  event Unstake(address _caller, bytes indexed _validator, uint _amount, uint _delegation_id, bytes _extraData);
  event UpdateMinDepositAmount(address _caller, uint _new);
  event UpdateOperator(address _caller, address _newOperator);
  event UpdateContractOperation(address _caller, bool _newValue);
  event UpdateWithdrawal(address _caller, address _newWithdrawal);
  event UpdateRewardsManager(address _caller, address _newRewardsManager);
  event CoverWithdrawals(address _caller, uint _amount);

  error InvalidZeroAmount();
  error LessThanMinDeposit();
  error NotEnoughIPSent();
  error Unauthorized();
  error InvalidOperationsFee();
  error NotFullyOperational();
  error ValidatorNotListed(bytes _validatorUncmpPubkey);

  function initialize(
    address _ipTokenStaking,
    IStakedIPVaultOperations _operations,
    IERC20 _asset,
    string memory _stIPName,
    string memory _stIPSymbol,
    uint _minDepositAmount,
    address _operator,
    bytes calldata _delegatorUncmpPubkey
  ) public initializer {
    __Ownable_init(msg.sender);
    __ERC4626_init(_asset);
    __ERC20_init(_stIPName, _stIPSymbol);

    updateOperator(_operator);
    updateMinDepositAmount(_minDepositAmount);
    operations = _operations;

    require(_uncmpPubkeyToAddress(_delegatorUncmpPubkey) == address(this), 'Invalid delegator uncmp public key');
    delegatorUncmpPubkey = _delegatorUncmpPubkey;

    ipTokenStaking = _ipTokenStaking;

    toggleContractOperation();
    /*
      withdrawal and rewards addresses aren't setted at deployment
      as story will ignore setting addresses without previous staking.
      After deployment must stake and update addresses
    */
  }

  receive() external payable {
    if (msg.sender != asset() && msg.sender != withdrawal) {
      depositIP(msg.sender);
    }
  }

  modifier onlyFullyOperational() {
    if (!isFullyOperational()) {
      revert NotFullyOperational();
    }
    _;
  }

  modifier onlyOperator() {
    if (msg.sender != operator) revert Unauthorized();
    _;
  }

  modifier onlyVaultOperations() {
    if (msg.sender != address(operations)) revert Unauthorized();
    _;
  }

  modifier checkStakingOperationsFee() {
    uint _fee = IIPTokenStaking(ipTokenStaking).fee();
    if (msg.value != _fee) {
      revert InvalidOperationsFee();
    }
    _;
  }

  modifier validatorExists(bytes calldata _validatorUncmpPubkey) {
    if (!operations.isValidatorListed(_validatorUncmpPubkey)) {
      revert ValidatorNotListed(_validatorUncmpPubkey);
    }
    _;
  }

  // ***************************
  // * Update Params Functions *
  // ***************************

  function updateWihdrawal(address _withdrawal) external payable onlyOwner checkStakingOperationsFee {
    withdrawal = _withdrawal;
    IIPTokenStaking(ipTokenStaking).setWithdrawalAddress{ value: msg.value }(delegatorUncmpPubkey, _withdrawal);

    emit UpdateWithdrawal(msg.sender, _withdrawal);
  }

  function updateRewardsManager(address _rewardsManager) external payable onlyOwner checkStakingOperationsFee {
    rewardsManager = _rewardsManager;
    IIPTokenStaking(ipTokenStaking).setRewardsAddress{ value: msg.value }(delegatorUncmpPubkey, _rewardsManager);

    emit UpdateRewardsManager(msg.sender, _rewardsManager);
  }

  /// @notice Use in case of emergency 🦺.
  function toggleContractOperation() public onlyOwner {
    fullyOperational = !fullyOperational;

    emit UpdateContractOperation(msg.sender, fullyOperational);
  }

  function updateMinDepositAmount(uint _amount) public onlyOwner {
    minDepositAmount = _amount;

    emit UpdateMinDepositAmount(msg.sender, _amount);
  }

  function updateOperator(address _newOperator) public onlyOwner {
    operator = _newOperator;

    emit UpdateOperator(msg.sender, _newOperator);
  }

  // **********************
  // * Operator Functions *
  // **********************

  /// @notice Converts the given public key to an EVM address.
  /// @dev Assume all calls to this function passes in the uncompressed public key.
  /// @param uncmpPubkey 65 bytes uncompressed secp256k1 public key, with prefix 04.
  /// @return address The EVM address derived from the public key.
  function _uncmpPubkeyToAddress(bytes calldata uncmpPubkey) internal pure returns (address) {
    return address(uint160(uint(keccak256(uncmpPubkey[1:]))));
  }

  // *********************
  // * ERC4626 functions *
  // *********************

  function isFullyOperational() public view returns (bool) {
    return fullyOperational;
  }

  function getStIPPrice() public view returns (uint) {
    return convertToAssets(1 ether);
  }

  /// @dev Assets increases as rewards are received by rewardsManager and later re-staked burning his shares
  function totalAssets() public view override returns (uint) {
    return totalUnderlying + rewardsManager.balance;
  }

  function injectRewards() external payable {
    if (msg.value == 0) {
      revert InvalidZeroAmount();
    }
    if (msg.value < minDepositAmount) {
      revert LessThanMinDeposit();
    }
    totalUnderlying += msg.value;
  }

  /// @notice Used to deposit IP tokens (native asset).
  function depositIP(address _receiver) public payable returns (uint) {
    uint shares = previewDeposit(msg.value);

    _deposit(address(this), _receiver, msg.value, shares);

    return shares;
  }

  function _transferAndUnwrap(address _from, uint _amount) internal {
    address asset = asset();
    IERC20(asset).safeTransferFrom(_from, address(this), _amount);
    IWIP(asset).withdraw(_amount);
  }

  function deposit(uint _assets, address _receiver) public override returns (uint) {
    _transferAndUnwrap(msg.sender, _assets);

    uint shares = previewDeposit(_assets);
    _deposit(msg.sender, _receiver, _assets, shares);

    return shares;
  }

  /// @param _shares are minted, but user have to pay in Q tokens.
  function mintIP(uint _shares, address _receiver) external payable returns (uint) {
    uint assets = previewMint(_shares);
    _deposit(address(this), _receiver, assets, _shares);

    // Return change to the caller.
    uint change = msg.value - assets;
    if (change > 0) {
      payable(msg.sender).transfer(change);
    }

    return assets;
  }

  function mint(uint _assets, address _receiver) public override returns (uint) {
    _transferAndUnwrap(msg.sender, _assets);

    uint shares = previewMint(_assets);
    _deposit(msg.sender, _receiver, _assets, shares);

    return shares;
  }

  function burn(uint _shares) public override onlyFullyOperational {
    _burn(msg.sender, _shares);
  }

  // **********************
  // * Internal functions *
  // **********************

  /// @dev For safety _deposit makes all the assets and shares checks
  function _deposit(
    address _caller,
    address _receiver,
    uint _assets,
    uint _shares
  ) internal override onlyFullyOperational {
    if (_assets == 0 || _shares == 0) {
      revert InvalidZeroAmount();
    }
    if (_assets < minDepositAmount) {
      revert LessThanMinDeposit();
    }

    _mint(_receiver, _shares);
    totalUnderlying += _assets;

    emit Deposit(_caller, _receiver, _assets, _shares);
  }

  /// @dev If there are pending withdrawals, new deposits will be used to cover them to avoid unstaking
  function coverWithdrawals(uint _assets) external onlyOperator {
    payable(withdrawal).sendValue(_assets);
    emit CoverWithdrawals(msg.sender, _assets);
  }

  function _withdraw(
    address _caller,
    address _receiver,
    address _owner,
    uint _assets,
    uint _shares
  ) internal override onlyFullyOperational {
    if (_shares == 0) revert InvalidZeroAmount();
    if (_caller != _owner) _spendAllowance(_owner, _caller, _shares);

    _burn(_owner, _shares);
    totalUnderlying -= _assets;

    IWithdrawal(withdrawal).requestWithdraw(_assets, _caller, _receiver);

    emit Withdraw(msg.sender, _receiver, _owner, _shares, _assets);
  }

  /// @notice Operator function to stake IP into the validator
  /// @param _validatorUncmpPubkey Validator uncompressed public key
  /// @param _amount Amount of IP to stake
  /// @param _period Enum staking period (flexible, short, medium, long)
  /// @param _extraData Additional data for the staking contract
  /// @return delegation_id The delegation id of the staked IP. Always 0 for flexible staking. Unique id for fixed staking
  function stake(
    bytes calldata _validatorUncmpPubkey,
    uint _amount,
    IIPTokenStaking.StakingPeriod _period,
    bytes calldata _extraData
  ) external onlyFullyOperational onlyOperator validatorExists(_validatorUncmpPubkey) returns (uint delegation_id) {
    IIPTokenStaking _ipTokenStaking = IIPTokenStaking(ipTokenStaking);

    delegation_id = _ipTokenStaking.stake{ value: _amount }(
      delegatorUncmpPubkey,
      _validatorUncmpPubkey,
      _period,
      _extraData
    );

    emit Stake(msg.sender, _validatorUncmpPubkey, delegation_id, _amount, _extraData);
  }

  /// @notice Operator function to unstake IP from the validator
  /// @param _validatorUncmpPubkey Validator uncompressed public key
  /// @param _amount Amount of IP to unstake
  /// @param _delegation_id The delegation id of the staked IP. Always 0 for flexible staking
  /// @param _extraData Additional data for the staking contract
  function unstake(
    bytes calldata _validatorUncmpPubkey,
    uint _amount,
    uint _delegation_id,
    bytes calldata _extraData
  )
    external
    payable
    onlyFullyOperational
    onlyOperator
    checkStakingOperationsFee
    validatorExists(_validatorUncmpPubkey)
  {
    IIPTokenStaking(ipTokenStaking).unstake{ value: msg.value }(
      delegatorUncmpPubkey,
      _validatorUncmpPubkey,
      _delegation_id,
      _amount,
      _extraData
    );

    emit Unstake(msg.sender, _validatorUncmpPubkey, _amount, _delegation_id, _extraData);
  }

  /// @notice Operator function to redelegate IP from one validator to another
  /// @param _oldValidatorUncmpPubkey Old validator uncompressed public key
  /// @param _newValidatorUncmpPubkey New validator uncompressed public key
  /// @param _amount Amount of IP to redelegate
  /// @param _delegation_id The delegation id of the staked IP. Always 0 for flexible staking
  function redelegate(
    bytes calldata _oldValidatorUncmpPubkey,
    bytes calldata _newValidatorUncmpPubkey,
    uint _amount,
    uint _delegation_id
  )
    external
    payable
    onlyFullyOperational
    onlyOperator
    checkStakingOperationsFee
    validatorExists(_newValidatorUncmpPubkey)
  {
    IIPTokenStaking(ipTokenStaking).redelegate{ value: msg.value }(
      delegatorUncmpPubkey,
      _oldValidatorUncmpPubkey,
      _newValidatorUncmpPubkey,
      _delegation_id,
      _amount
    );
  }
}
