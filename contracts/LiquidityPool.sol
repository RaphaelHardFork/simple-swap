//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract LiquidityPool {
    // type
    using Address for address payable;
    using Counters for Counters.Counter;

    struct Contribution {
        uint256 id;
        address contributor;
        uint256 token1Balance;
        uint256 token2Balance;
    }

    // storage
    Counters.Counter private _contributionID;
    IERC20 private _token1;
    IERC20 private _token2;
    mapping(address => uint256) private _contribution;
    uint256 private _k;

    constructor(
        address token1address_,
        uint256 amountT1,
        address token2address_,
        uint256 amountT2
    ) {
        _token1 = IERC20(token1address_);
        _token2 = IERC20(token2address_);
        _k = amountT2 / amountT1;

        // first deposit
        _token1.transferFrom(msg.sender, address(this), amountT1);
        _token2.transferFrom(msg.sender, address(this), amountT2);

        // first contribution =0
    }

    function deposit(uint256 amountToken1) public returns (bool) {
        _contributionID.increment();

        // amount token 2
        uint256 amount = amountToken1 / _k;

        // transfer
        _token1.transferFrom(msg.sender, address(this), amountToken1);
        _token2.transferFrom(msg.sender, address(this), amount);

        return true;
    }
}
