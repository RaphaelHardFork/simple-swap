//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract LPToken is ERC20 {
    constructor(
        string memory name_,
        string memory symbol_,
        address provider,
        uint256 supply
    ) ERC20(name_, symbol_) {
        _mint(provider, supply);
    }
}
