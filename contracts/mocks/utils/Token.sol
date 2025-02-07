// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { ERC20 } from '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract Token is ERC20 {
    uint8 private immutable _decimals;

    constructor(string memory _name, string memory _symbol, uint8 decimals_) ERC20(_name, _symbol) {
        _decimals = decimals_;
    }

    function allocateTo(address _receiver, uint256 _amount) public {
        _mint(_receiver, _amount);
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }
}
