// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Token } from './utils/Token.sol';

contract WIP is Token {
    constructor() Token("Test Wrapped IP", "wIP", 18) {}
}
