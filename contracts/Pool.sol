//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Pool {
    address private _token;

    constructor(address token_) {
        require(token_ != address(0), "Pool: Invalid token address");

        _token = token_;
    }

    function addLiquidity(uint256 amount) public payable {
        IERC20 token = IERC20(_token);
        token.transferFrom(msg.sender, address(this), amount);
    }

    function getPrice(uint256 inputReserve, uint256 outputReserve) public pure returns (uint256) {
        require(inputReserve > 0 && outputReserve > 0, "Pool: invalid reserves");

        return (inputReserve * 1000) / outputReserve;
    }

    function getTokenAmount(uint256 ethSold) public view returns (uint256) {
        require(ethSold > 0, "Pool: eth sold is too small");

        uint256 tokenReserve = getReserve();

        return _getAmount(ethSold, tokenReserve, address(this).balance);
    }

    function getETHAmount(uint256 tokenSold) public view returns (uint256) {
        require(tokenSold > 0, "Pool: token sold is too small");

        uint256 tokenReserve = getReserve();

        return _getAmount(tokenSold, tokenReserve, address(this).balance);
    }

    function getReserve() public view returns (uint256) {
        return IERC20(_token).balanceOf(address(this));
    }

    function _getAmount(
        uint256 inputAmount,
        uint256 inputReserve,
        uint256 outputReserve
    ) private pure returns (uint256) {
        require(inputReserve > 0 && outputReserve > 0, "Pool: Invalid reserves");

        return (inputAmount * outputReserve) / (inputReserve + inputAmount);
    }
}
