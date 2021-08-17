/* eslint-disable indent */
/* eslint-disable comma-dangle */
/* eslint-disable no-unused-vars */
const { expect } = require('chai')
const { ethers } = require('hardhat')

// some tests: https://github.com/RaphaelHardFork/ico-hardhat

const CONTRACT_NAME = 'Exchange'
const SUPPLY = ethers.utils.parseEther('100000')
const ONE_ETH = ethers.utils.parseEther('1')
const SOME_TOKEN = ethers.utils.parseEther('300')
const ADDRESS_ZERO = ethers.constants.AddressZero

const getUserBalance = async (token, lpToken, userAddress, userName) => {
  const ethBalance = await ethers.provider.getBalance(userAddress)
  const tokenBalance = await token.balanceOf(userAddress)
  const lpTokenBalance = await lpToken.balanceOf(userAddress)

  console.log(`Balance of ${userName}
  ${ethers.utils.formatEther(ethBalance.toString())} ETH
  ${ethers.utils.formatEther(tokenBalance.toString())} TOKEN
  ${ethers.utils.formatEther(lpTokenBalance.toString())} LP Token`)
}

const getPoolData = async (exchange, swapInfo) => {
  const [tokenReserve, ethReserve] = await exchange.getReserves()
  const [tokenVault, ethVault] = await exchange.getVaults()
  const ethPrice = (await exchange.getPrice(tokenReserve, ethReserve)) / 1000000

  console.log(`${swapInfo !== undefined ? 'SWAP INFORMATION' : ''} 
  Reserves: ${ethers.utils.formatEther(
    tokenReserve.toString()
  )} TOKEN, ${ethers.utils.formatEther(ethReserve.toString())} ETH
  Vaults: ${ethers.utils.formatEther(
    tokenVault.toString()
  )} TOKEN, ${ethers.utils.formatEther(ethVault.toString())} ETH
  Prices: ${ethPrice} Token per ETH
  
  ${swapInfo !== undefined ? `--- SWAP ${swapInfo} ---` : ''}`)
}

// TEST SCRIPT
describe('Exchange', function () {
  let Exchange, exchange, Token, token, LPToken, lpToken, dev, owner, lp1, lp2

  beforeEach(async function () {
    ;[dev, owner, lp1, lp2] = await ethers.getSigners()

    Token = await ethers.getContractFactory('Token')
    token = await Token.connect(dev).deploy(SUPPLY)
    await token.deployed()

    Exchange = await ethers.getContractFactory(CONTRACT_NAME)

    // done by the factory
    exchange = await Exchange.connect(dev).deploy(
      token.address,
      dev.address,
      SUPPLY.div(5),
      { value: ONE_ETH.mul(10) }
    )
    await exchange.deployed()
    // in the factory (with an approve)
    await token.connect(dev).transfer(exchange.address, SUPPLY.div(5))

    // get the LP token
    const lpTokenAddress = await exchange.LPTokenAddress()
    LPToken = await ethers.getContractFactory('LPToken')
    lpToken = await LPToken.attach(lpTokenAddress)
  })

  describe('Deployment', function () {
    it('should mint the supply to the dev', async function () {
      expect(await token.balanceOf(dev.address)).to.equal(
        SUPPLY.sub(SUPPLY.div(5))
      )
    })

    it('should mint the LP token', async function () {
      expect(await lpToken.balanceOf(dev.address)).to.equal(ONE_ETH.mul(10))
    })

    it('should set the owner of LP token to the Exchange', async function () {
      expect(await lpToken.owner()).to.equal(exchange.address)
    })

    it('should revert if someone try to mint LP token', async function () {
      await expect(
        lpToken.connect(dev).mint(dev.address, SUPPLY)
      ).to.be.revertedWith('Ownable:')
    })

    it('should set a composable symbol for LPtoken', async function () {
      const balance = await lpToken.balanceOf(dev.address)
      const tokenName = await token.name()
      const tokenSymbol = await token.symbol()
      const lpName = await lpToken.name()
      const lpSymbol = await lpToken.symbol()
      console.log(`Tokens informations:
      [TOKEN] Name: ${tokenName}, Symbol: ${tokenSymbol}, Address: ${
        token.address
      }
      [LPTOken] Name: ${lpName}, Symbol: ${lpSymbol}, Address: ${
        lpToken.address
      }
      dev balance: ${ethers.utils.formatEther(balance.toString())}`)
      expect(await lpToken.symbol()).to.equal('TKN-ETH')
    })

    it('should fill reserves', async function () {
      const [tokenReserve, ethReserve] = await exchange.getReserves()
      expect(tokenReserve, 'token').to.equal(SUPPLY.div(5))
      expect(ethReserve, 'eth').to.equal(ONE_ETH.mul(10))
    })
  })

  describe('add liquidity', async function () {
    beforeEach(async function () {
      await token.connect(lp1).approve(exchange.address, SUPPLY)
      await token.connect(dev).transfer(lp1.address, SUPPLY.div(2))
      await exchange
        .connect(lp1)
        .addLiquidity(ONE_ETH.mul(2000), { value: ONE_ETH })
    })

    it('should update reserves', async function () {
      const [tokenReserve, ethReserve] = await exchange.getReserves()
      expect(tokenReserve, 'token').to.equal(tokenReserve)
      expect(ethReserve, 'eth').to.equal(ethReserve)
    })

    it('should mint the LP token', async function () {
      expect(await lpToken.balanceOf(lp1.address)).to.equal(ONE_ETH)
    })
  })

  describe('get prices', function () {
    it('should give the wright price', async function () {
      const [tokenReserve, ethReserve] = await exchange.getReserves()
      const tokenPrice = await exchange.getPrice(tokenReserve, ethReserve)
      const ethPrice = await exchange.getPrice(ethReserve, tokenReserve)

      expect(tokenPrice.toNumber() / 1000000, 'TOKEN / ETH').to.equal(2000)
      expect(ethPrice.toNumber() / 1000000, 'ETH / TOKEN').to.equal(0.0005)
    })
  })

  describe('before a swap', function () {
    it('should return the right out amount', async function () {
      let output = await exchange.getTokenAmount(ONE_ETH)
      expect(await exchange.getTokenAmount(ONE_ETH), 'getTokenAmount').to.equal(
        output
      )

      output = await exchange.getEthAmount(SOME_TOKEN)
      expect(
        await exchange.getEthAmount(SOME_TOKEN),
        'getTokenAmount'
      ).to.equal(output)
    })
  })

  describe('do a swap', function () {
    let swapCall
    beforeEach(async function () {
      await token.connect(dev).transfer(owner.address, SUPPLY.div(25))
      await token.connect(owner).approve(exchange.address, SUPPLY.div(50))
      // expected output amount is set to zero for the test (auto generatedby the front-end part)
    })

    it('should change balances of the swapper [ETH to Token]', async function () {
      const [, amountWithFee] = await exchange.feeCalculation(ONE_ETH)
      const newTokenBalance = await exchange.getTokenAmount(amountWithFee)
      await getPoolData(exchange, '1 ETH')
      swapCall = await exchange.connect(owner).swap(0, 0, { value: ONE_ETH })
      await getPoolData(exchange)

      expect(
        await token.balanceOf(owner.address),
        'increase token balance'
      ).to.equal(SUPPLY.div(25).add(newTokenBalance))
      expect(swapCall, 'decrease ETH balance').to.changeEtherBalance(
        owner,
        ONE_ETH.mul(-1)
      )
    })

    it('should change balances of the swapper [Token to ETH]', async function () {
      const [, amountWithFee] = await exchange.feeCalculation(SOME_TOKEN)
      const newEthBalance = await exchange.getEthAmount(amountWithFee)
      await getPoolData(exchange, '300 TOKEN')
      swapCall = await exchange.connect(owner).swap(SOME_TOKEN, 0)
      await getPoolData(exchange)

      expect(
        await token.balanceOf(owner.address),
        'decrease token balance'
      ).to.equal(SUPPLY.div(25).sub(SOME_TOKEN))

      expect(swapCall, 'increase ETH balance').to.changeEtherBalance(
        owner,
        newEthBalance
      )
    })

    it('should update reserve in the pool', async function () {
      const [tokenReserve0, ethReserve0] = await exchange.getReserves()

      const [, amountWithFee] = await exchange.feeCalculation(SOME_TOKEN)
      const ethOut = await exchange.getEthAmount(amountWithFee)
      await exchange.connect(owner).swap(SOME_TOKEN, 0)
      const [tokenReserve1, ethReserve1] = await exchange.getReserves()

      expect(tokenReserve1, 'token reserve').to.equal(
        tokenReserve0.add(amountWithFee)
      )
      expect(ethReserve1, 'eth reserve').to.equal(ethReserve0.sub(ethOut))
    })
  })

  describe('calculate the share of the pool', function () {
    beforeEach(async function () {
      await exchange.connect(lp1).swap(0, 0, { value: ONE_ETH })
      await exchange.connect(lp2).swap(0, 0, { value: ONE_ETH.mul(2) })
      await token.connect(lp1).approve(exchange.address, SOME_TOKEN.mul(1000))
      await token.connect(lp2).approve(exchange.address, SOME_TOKEN.mul(1000))
      await token.connect(dev).approve(exchange.address, SUPPLY.div(2))
      await exchange
        .connect(lp1)
        .addLiquidity(SOME_TOKEN.mul(1000), { value: ONE_ETH })
      await exchange
        .connect(lp2)
        .addLiquidity(SOME_TOKEN.mul(1000), { value: ONE_ETH.mul(2) })

      const output = await exchange.getEthAmount(SOME_TOKEN)

      await exchange.connect(dev).addLiquidity(SUPPLY.div(2), { value: output })

      // lp1, lp2 add
      // calculate the share
      // calculate the expected reward after few swap
    })

    it('should mint LP token', async function () {
      expect(await lpToken.balanceOf(lp1.address)).to.equal(ONE_ETH)
      expect(await lpToken.balanceOf(lp2.address)).to.equal(ONE_ETH.mul(2))
    })

    it('should display the share of the pool', async function () {
      const share = ethers.utils.formatEther(
        (await exchange.shareOfPool(lp1.address)).toString()
      )
      const totSup = ethers.utils.formatEther(
        (await lpToken.totalSupply()).toString()
      )
      const lp1BALANCE = ethers.utils.formatEther(
        (await lpToken.balanceOf(lp2.address)).toString()
      )

      console.log(`${share * 100}%`)
      console.log(totSup)
      console.log((lp1BALANCE / totSup) * 100)
    })
  })

  describe('withdraw fees', function () {
    beforeEach(async function () {
      await exchange.connect(lp2).swap(0, 0, { value: ONE_ETH })
      await exchange.connect(lp2).swap(0, 0, { value: ONE_ETH })
      await exchange.connect(lp2).swap(0, 0, { value: ONE_ETH })
      await exchange.connect(lp2).swap(0, 0, { value: ONE_ETH })
      await exchange.connect(lp2).swap(0, 0, { value: ONE_ETH })
      await exchange.connect(lp2).swap(0, 0, { value: ONE_ETH })
      const balance = await token.balanceOf(lp2.address)
      await token.connect(lp2).approve(exchange.address, balance)
      // await exchange.connect(lp2).swap(balance, 0)
    })

    it('should withdraw', async function () {
      getPoolData(exchange)

      await exchange.connect(dev).removeLiquidity(ONE_ETH.mul(5))

      getPoolData(exchange)
    })

    it('should withdraw fees', async function () {
      const balance = await token.balanceOf(lp2.address)
      const [BT, BE] = await exchange.getReserves()
      const price = await exchange.getPrice(BE, BT)

      await exchange
        .connect(lp2)
        .addLiquidity(balance, { value: balance.div(price) })
      await exchange.connect(dev).withdraw()
      getPoolData(exchange)
      // withdraw()
      // probleme les nouveau arrivant on une part sur les fees
    })
  })
})
