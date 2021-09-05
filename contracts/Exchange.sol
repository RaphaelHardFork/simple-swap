//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./LPToken.sol";

/** @title      Exchange liquidity pool ETH-TOKEN
 *  @dev        Only one token can be in the pool with ETH
 * */

contract Exchange {
    // types
    using Counters for Counters.Counter;
    using Address for address payable;
    // storages
    ERC20 private _tokenA;
    LPToken private _LPToken;

    uint256 private _reserveA;
    uint256 private _reserveETH;

    uint256 private _tokenVault;
    uint256 private _ethVault;

    Counters.Counter private _nonce; // not used yet

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
        uint256 amount = msg.value; // LP token amount based on the amount of ETH deposited

        // mint LP token
        _LPToken = new LPToken("LiquidityProviderToken", symbol, creator, amount);
    }

    function addLiquidity(uint256 tokenAmount_) public payable {
        require(msg.value > 0, "Exchange: no ETH provided");

        if (_reserveA == 0 && _reserveETH == 0) {
            _tokenA.transferFrom(msg.sender, address(this), tokenAmount_);
        } else {
            uint256 tokenAmount = (msg.value * _reserveA) / _reserveETH;
            require(tokenAmount_ >= tokenAmount, "Exchange: insufficient token amount");
            _tokenA.transferFrom(msg.sender, address(this), tokenAmount);
        }

        // mint LP token
        _LPToken.mint(msg.sender, msg.value - _ethVault);

        // update reserves
        _reserveA = _tokenA.balanceOf(address(this)) - _tokenVault;
        _reserveETH = address(this).balance - _ethVault; // WARNING  fees
    }

    function removeLiquidity(uint256 lpAmount_) public returns (uint256, uint256) {
        require(lpAmount_ > 0, "Exchange: invalid amount");
        uint256 lpTotalSupply = _LPToken.totalSupply();

        uint256 ethReserveOut = (_reserveETH * lpAmount_) / lpTotalSupply;
        uint256 tokenReserveOut = (_reserveA * lpAmount_) / lpTotalSupply;

        uint256 ethVaultOut = (_ethVault * lpAmount_) / lpTotalSupply;
        uint256 tokenVaultOut = (_tokenVault * lpAmount_) / lpTotalSupply;

        _LPToken.burn(msg.sender, lpAmount_);
        _reserveETH -= ethReserveOut;
        _reserveA -= tokenReserveOut;
        _ethVault -= ethVaultOut;
        _tokenVault -= tokenVaultOut;

        payable(msg.sender).sendValue(ethReserveOut + ethVaultOut);
        _tokenA.transfer(msg.sender, tokenReserveOut + tokenVaultOut);

        return (ethReserveOut + ethVaultOut, tokenReserveOut + tokenVaultOut);
    }

    function swap(uint256 tokenAmount, uint256 minEth) public payable {
        require(tokenAmount > 0 || msg.value > 0, "Exchange: nothing to swap...");
        uint256 outputAmount;

        if (msg.value > 0) {
            // ETH => TOKEN
            (uint256 fees, uint256 amount) = feeCalculation(msg.value);
            outputAmount = getTokenAmount(amount);
            require(outputAmount >= tokenAmount, "Exchange: Slippage too high...");
            _reserveA -= outputAmount;
            _reserveETH += amount;
            _ethVault += fees;
            _tokenA.transfer(msg.sender, outputAmount);
        } else {
            // TOKEN => ETH
            (uint256 fees, uint256 amount) = feeCalculation(tokenAmount);
            outputAmount = getEthAmount(amount);
            require(outputAmount >= minEth, "Exchange: Slippage too high...");
            _reserveETH -= outputAmount;
            _reserveA += amount;
            _tokenVault += fees;
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

    function getVaults() public view returns (uint256, uint256) {
        return (_tokenVault, _ethVault);
    }

    function shareOfPool(address account) public view returns (uint256) {
        return _LPToken.balanceOf(account) / _LPToken.totalSupply();
    }

    function LPTokenAddress() public view returns (address) {
        return address(_LPToken);
    }

    function getPrice(uint256 asset1, uint256 asset2) public pure returns (uint256) {
        require(asset1 > 0 && asset2 > 0, "Exchange: invalid reserve");
        return (asset1 * 1_000_000) / asset2;
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
        uint256 inputAsset1WithFee,
        uint256 asset1Reserve,
        uint256 asset2Reserve
    ) private pure returns (uint256) {
        require(asset1Reserve > 0 && asset2Reserve > 0, "Exchange: invalid reserve");

        /*
        uint256 inputAmountWithFee = inputAsset1 * 995;
        uint256 numerator = inputAmountWithFee * asset2;
        uint256 denominator = (asset1 * 1000) + inputAmountWithFee;

        return numerator / denominator;
        */

        return (inputAsset1WithFee * asset2Reserve) / (inputAsset1WithFee + asset1Reserve);
    }

    function feeCalculation(uint256 amount) public pure returns (uint256, uint256) {
        uint256 fees = amount * 5;
        uint256 remainingAmount = amount * 995;

        return (fees / 1000, remainingAmount / 1000);
    }
}
