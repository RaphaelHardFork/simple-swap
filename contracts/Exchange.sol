//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./LPToken.sol";

/** @title      Exchange liquidity pool ETH-TOKEN
 *  @dev        Only one token can be in the pull with ETH
 * */

contract Exchange {
    // types
    using Counters for Counters.Counter;
    using Address for address payable;
    // storages
    ERC20 private _tokenA;
    ERC20 private _LPToken;

    uint256 private _reserveA;
    uint256 private _reserveETH;

    Counters.Counter private _nonce;

    // events
    // constructor
    constructor(
        address tokenA_,
        address creator,
        uint256 tokenAAmount
    ) payable {
        require(tokenA_ != address(0), "Exchange: invalid token address");
        require(msg.value != 0, "Exchange: no ETH provided");
        require(tokenAAmount != 0, "Exchange: no token provided");
        _tokenA = ERC20(tokenA_);

        // update reserves
        _reserveA = tokenAAmount;
        _reserveETH = msg.value;

        // LP token parameter
        string memory symbol = string(abi.encodePacked(_tokenA.symbol(), "-ETH"));
        uint256 amount = msg.value + tokenAAmount;

        // mint LP token
        _LPToken = new LPToken("LiquidityProviderToken", symbol, creator, amount);
    }

    function addLiquidity(uint256 tokenAmount) public payable {
        _tokenA.transferFrom(msg.sender, address(this), tokenAmount);

        // update reserves
        _reserveA = _tokenA.balanceOf(address(this));
        _reserveETH = address(this).balance;
    }

    function swap(uint256 tokenAmount, uint256 minEth) public payable {
        require(tokenAmount > 0 || msg.value > 0, "Exchange: nothing to swap...");
        uint256 outputAmount;

        if (msg.value > 0) {
            // ETH => TOKEN
            outputAmount = getTokenAmount(msg.value);
            require(outputAmount >= tokenAmount, "Exchange: Slippage too high...");
            _reserveA -= outputAmount;
            _reserveETH += msg.value;
            _tokenA.transfer(msg.sender, outputAmount);
        } else {
            // TOKEN => ETH
            outputAmount = getEthAmount(tokenAmount);
            require(outputAmount >= minEth, "Exchange: Slippage too high...");
            _reserveETH -= outputAmount;
            _reserveA += tokenAmount;
            _tokenA.transferFrom(msg.sender, address(this), tokenAmount);
            payable(msg.sender).sendValue(outputAmount);
        }
    }

    function getTrueReserves() public view returns (uint256, uint256) {
        return (_tokenA.balanceOf(address(this)), address(this).balance);
    }

    function getReserves() public view returns (uint256, uint256) {
        return (_reserveA, _reserveETH);
    }

    function LPTokenAddress() public view returns (address) {
        return address(_tokenA);
    }

    function getPrice(uint256 asset1, uint256 asset2) public pure returns (uint256) {
        require(asset1 > 0 && asset2 > 0, "Exchange: invalid reserve");
        return (asset1 * 1000) / asset2;
    }

    function getTokenAmount(uint256 value) public view returns (uint256) {
        require(value > 0, "Exchange: ETH value too small...");
        (uint256 tokenReserve, uint256 ethReserve) = getReserves();
        return _getAmountOut(value, ethReserve, tokenReserve);
    }

    function getEthAmount(uint256 tokenAmount) public view returns (uint256) {
        require(tokenAmount > 0, "Exchange: ETH value too small...");
        (uint256 tokenReserve, uint256 ethReserve) = getReserves();
        return _getAmountOut(tokenAmount, tokenReserve, ethReserve);
    }

    function _getAmountOut(
        uint256 inputAsset1,
        uint256 asset1,
        uint256 asset2
    ) private pure returns (uint256) {
        require(asset1 > 0 && asset2 > 0, "Exchange: invalid reserve");
        return (inputAsset1 * asset2) / (inputAsset1 + asset1);
    }
}
