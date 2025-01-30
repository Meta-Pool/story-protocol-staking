// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import './interfaces/IRewardsManager.sol';
import './interfaces/IStakedIP.sol';
// import './interfaces/IStakedIPVaultOperations.sol';
import './interfaces/IWIP.sol';
import './interfaces/IWithdrawal.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol';
import '@openzeppelin/contracts/interfaces/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import { IIPTokenStakingFull as IIPTokenStaking } from './interfaces/story/IIPTokenStakingFull.sol';

/// @title Meta Pool stIP 🌒 vault contract.
/// @notice [FullyOperational] When is NOT fully operational, users cannot:
/// 1) mint, 2) deposit, 3) withdraw nor 4) redeem.
contract StakedIP is Initializable, ERC4626Upgradeable, OwnableUpgradeable, IStakedIP {
    using Address for address payable;
    using SafeERC20 for IERC20;

    /// @dev Absolute minimum deposit amount. Cannot be lower.
    uint256 constant private MIN_DEPOSIT_AMOUNT = 1 gwei;

    // IStakedIPVaultOperations public operations;
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
    error InvalidZeroAddress();
    error LessThanMinDeposit();
    // error NotEnoughIPSent(); // not used
    error OperatorUnauthorized();
    error InvalidIPFee();
    error NotFullyOperational();
    error ValidatorNotListed(bytes _validatorUncmpPubkey);
    error ValidatorAlreadyListed(bytes _invalidValidator);
    error ValidatorHasTargetPercent(Validator _validator);
    error InvalidLengthArray();
    error ShouldBeOneHundred(uint256 _sumOfPercentages);
    error SizeMismatch();
    error ValidatorNotFount(bytes _validator);
    error ValidatorsEmptyList();

    /// todo: auditors usually recommend to _disableInitializers().
    constructor() { _disableInitializers(); }

    function initialize(
        address _ipTokenStaking,
        IERC20 _asset,
        string memory _stIPName,
        string memory _stIPSymbol,
        uint _minDepositAmount,
        address _operator,
        address _owner,
        bytes[] calldata _validatorsPubkey,
        uint16[] calldata _validatorsStakePercent
    ) public initializer {
        __Ownable_init(_owner);
        __ERC4626_init(_asset);
        __ERC20_init(_stIPName, _stIPSymbol);

        updateOperator(_operator);
        updateMinDepositAmount(_minDepositAmount);
        // operations = _operations;

        ipTokenStaking = _ipTokenStaking;

        for (uint i = 0; i < _validatorsPubkey.length; ++i) {
            _insertValidator(_validatorsPubkey[i]);
        }
        _updateValidatorsTarget(_validatorsStakePercent);

        toggleContractOperation();
        /// TODO: Can we make the initializer payable to avoid this?
        /*
        withdrawal and rewards addresses aren't settled at deployment
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
        require(isFullyOperational(), NotFullyOperational());
        _;
    }

    modifier onlyOperator() {
        require(msg.sender == operator, OperatorUnauthorized());
        _;
    }

    modifier checkStakingOperationsFee() {
        require (msg.value == IIPTokenStaking(ipTokenStaking).fee(), InvalidIPFee());
        _;
    }

    modifier checkValidatorExists(bytes calldata _validatorUncmpPubkey) {
        require(isValidatorListed(_validatorUncmpPubkey), ValidatorNotListed(_validatorUncmpPubkey));
        _;
    }

    // ***************************
    // * Update Params Functions *
    // ***************************

    function updateWithdrawal(address _withdrawal) external payable onlyOwner checkStakingOperationsFee {
        require(_withdrawal != address(0), InvalidZeroAddress());
        withdrawal = _withdrawal;
        IIPTokenStaking(ipTokenStaking).setWithdrawalAddress{ value: msg.value }(_withdrawal);

        emit UpdateWithdrawal(msg.sender, _withdrawal);
    }

    function updateRewardsManager(address _rewardsManager) external payable onlyOwner checkStakingOperationsFee {
        require(_rewardsManager != address(0), InvalidZeroAddress());
        rewardsManager = _rewardsManager;
        IIPTokenStaking(ipTokenStaking).setRewardsAddress{ value: msg.value }(_rewardsManager);

        emit UpdateRewardsManager(msg.sender, _rewardsManager);
    }

    /// @notice Use in case of emergency 🦺.
    function toggleContractOperation() public onlyOwner {
        fullyOperational = !fullyOperational;

        emit UpdateContractOperation(msg.sender, fullyOperational);
    }

    function updateMinDepositAmount(uint _amount) public onlyOwner {
        require(_amount >= MIN_DEPOSIT_AMOUNT, LessThanMinDeposit());
        minDepositAmount = _amount;

        emit UpdateMinDepositAmount(msg.sender, _amount);
    }

    function updateOperator(address _newOperator) public onlyOwner {
        require(_newOperator != address(0), InvalidZeroAddress());
        operator = _newOperator;

        emit UpdateOperator(msg.sender, _newOperator);
    }

    // **********************
    // * Operator Functions *
    // **********************

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
        require(rewardsManager != address(0), "RewardsManager not set");
        (uint rewards, ) = IRewardsManager(rewardsManager).getManagerAccrued();
        return totalUnderlying + rewards;
    }

    function injectRewards() external payable {
        require(msg.value >= minDepositAmount, LessThanMinDeposit());
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
        require(_shares > 0, InvalidZeroAmount());
        require(_assets >= minDepositAmount, LessThanMinDeposit());

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
    ) external onlyFullyOperational onlyOperator checkValidatorExists(_validatorUncmpPubkey) returns (uint delegation_id) {
        IIPTokenStaking _ipTokenStaking = IIPTokenStaking(ipTokenStaking);

        delegation_id = _ipTokenStaking.stake{ value: _amount }(
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
        checkValidatorExists(_validatorUncmpPubkey)
    {
        IIPTokenStaking(ipTokenStaking).unstake{ value: msg.value }(
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
        checkValidatorExists(_newValidatorUncmpPubkey)
    {
        IIPTokenStaking(ipTokenStaking).redelegate{ value: msg.value }(
            _oldValidatorUncmpPubkey,
            _newValidatorUncmpPubkey,
            _delegation_id,
            _amount
        );
    }

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
    mapping(bytes32 => bool) public validatorExists;

    event InsertValidator(bytes _validator);
    event RemoveValidator(bytes _validator);
    event ReplaceValidator(bytes _oldValidatorUncmpPubkey, bytes _newValidatorUncmpPubkey);
    event UpdateValidatorTargets(address _sender);


    modifier checkDuplicatedValidator(bytes memory _validatorUncmpPubkey) {
        require(!isValidatorListed(_validatorUncmpPubkey), ValidatorAlreadyListed(_validatorUncmpPubkey));
        _;
    }

    function getValidators() external view returns (Validator[MAX_VALIDATORS] memory) {
        return validators;
    }

    // ***************************
    // * Update Params Functions *
    // ***************************

    /// Update all the validators target stakes percent
    function updateValidatorsTarget(uint16[] calldata _targetStakesPercent) external onlyOwner {
        _updateValidatorsTarget(_targetStakesPercent);
    }

    function _updateValidatorsTarget(uint16[] calldata _targetStakesPercent) private {
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
    function bulkInsertValidators(bytes[] memory _validatorsUncmpPubkey) external onlyOwner {
        for (uint i = 0; i < _validatorsUncmpPubkey.length; ++i) {
            _insertValidator(_validatorsUncmpPubkey[i]);
        }
    }

    /// @notice Replace one validator maintaining the target percent
    function replaceOneValidator(
        bytes memory _oldValidatorUncmpPubkey,
        bytes memory _newValidatorUncmpPubkey
    ) external onlyOwner checkDuplicatedValidator(_newValidatorUncmpPubkey) {
        uint256 _index = getValidatorIndex(_oldValidatorUncmpPubkey);
        validators[_index].uncmpPubkey = _newValidatorUncmpPubkey;

        validatorExists[keccak256(_oldValidatorUncmpPubkey)] = false;
        validatorExists[keccak256(_newValidatorUncmpPubkey)] = true;

        emit ReplaceValidator(_oldValidatorUncmpPubkey, _newValidatorUncmpPubkey);
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

            uint256 delegateAmount = ((_totalAmount * uint256(_validators[i].targetStakePercent)) /
                uint256(ONE_HUNDRED));

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

    function isValidatorListed(bytes memory _validatorUncmpPubkey) public view returns (bool) {
        return validatorExists[keccak256(_validatorUncmpPubkey)];
    }

    function _removeValidator(bytes memory _validatorUncmpPubkey) private {
        uint _validatorsLength = validatorsLength;

        // Final validators array cannot be empty
        if (_validatorsLength <= 1) {
            revert ValidatorsEmptyList();
        }

        uint256 _index = getValidatorIndex(_validatorUncmpPubkey);
        Validator memory _validator = validators[_index];

        require(_validator.targetStakePercent == 0, ValidatorHasTargetPercent(_validator));

        if (_index != _validatorsLength - 1) {
            // Replace the element at the index with the last element in the array
            validators[_index] = validators[_validatorsLength - 1];
        } else {
            // If the element is the last one, just remove it
            delete validators[_index];
        }

        validatorExists[keccak256(_validatorUncmpPubkey)] = false;
        validatorsLength--;

        emit RemoveValidator(_validatorUncmpPubkey);
    }

    function _insertValidator(
        bytes memory _validatorUncmpPubkey
    ) private checkDuplicatedValidator(_validatorUncmpPubkey) {
        uint _validatorsLength = validatorsLength;

        if (_validatorsLength >= MAX_VALIDATORS) {
            revert InvalidLengthArray();
        }

        /// updating storage.
        validatorExists[keccak256(_validatorUncmpPubkey)] = true;
        validators[_validatorsLength].uncmpPubkey = _validatorUncmpPubkey;
        validatorsLength++;

        emit InsertValidator(_validatorUncmpPubkey);
    }
}
