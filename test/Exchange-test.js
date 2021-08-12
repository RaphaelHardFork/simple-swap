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

describe('Exchange', function () {
  let Exchange, exchange, Token, token, LPToken, lpToken, dev, owner

  beforeEach(async function () {
    ;[dev, owner] = await ethers.getSigners()

    Token = await ethers.getContractFactory('Token')
    token = await Token.connect(dev).deploy(SUPPLY)
    await token.deployed()

    Exchange = await ethers.getContractFactory(CONTRACT_NAME)

    // done by the factory
    exchange = await Exchange.connect(dev).deploy(
      token.address,
      dev.address,
      SUPPLY.div(5),
      { value: SUPPLY.div(1000) }
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
      const balance = await lpToken.balanceOf(dev.address)
      expect(await lpToken.balanceOf(dev.address)).to.equal(balance) // no matter quantity
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
      expect(ethReserve, 'eth').to.equal(SUPPLY.div(1000))
    })
  })

  describe('add liquidity', async function () {
    beforeEach(async function () {
      await token.connect(dev).transfer(owner.address, SUPPLY.div(25))
      await token.connect(owner).approve(exchange.address, SUPPLY.div(50))
      await exchange
        .connect(owner)
        .addLiquidity(SUPPLY.div(50), { value: SUPPLY.div(10000) })
    })

    it('should update reserves', async function () {
      const [tokenReserve, ethReserve] = await exchange.getReserves()
      expect(tokenReserve, 'token').to.equal(SUPPLY.div(5).add(SUPPLY.div(50)))
      expect(ethReserve, 'eth').to.equal(
        SUPPLY.div(1000).add(SUPPLY.div(10000))
      )
    })
  })

  describe('get prices', function () {
    it('should give the wright price', async function () {
      const [tokenReserve, ethReserve] = await exchange.getReserves()

      // get data of the pool on console
      console.log(
        `Reserve: ${ethers.utils.formatEther(
          tokenReserve.toString()
        )} TOKEN, ${ethers.utils.formatEther(ethReserve.toString())} ETH`
      )
      console.log(
        `Prices: ${
          (await exchange.getPrice(tokenReserve, ethReserve)) / 1000
        } Token per ETH`
      )
      // ---

      expect(
        await exchange.getPrice(tokenReserve, ethReserve),
        'TOKEN / ETH'
      ).to.equal('200000')
      expect(
        await exchange.getPrice(ethReserve, tokenReserve),
        'ETH / TOKEN'
      ).to.equal('5')
    })
  })

  describe('before a swap', function () {
    it('should return the right out amount', async function () {
      let output = await exchange.getTokenAmount(ONE_ETH)
      console.log(
        `Add ${1} ETH in the pool return ${ethers.utils.formatEther(
          output
        )} TOKEN`
      )
      expect(await exchange.getTokenAmount(ONE_ETH), 'getTokenAmount').to.equal(
        output
      )

      output = await exchange.getEthAmount(SOME_TOKEN)
      console.log(
        `Add ${300} TOKEN in the pool return ${ethers.utils.formatEther(
          output
        )} TOKEN`
      )
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
      const newTokenBalance = await exchange.getTokenAmount(ONE_ETH)
      swapCall = await exchange.connect(owner).swap(0, 0, { value: ONE_ETH })

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
      const newEthBalance = await exchange.getEthAmount(SOME_TOKEN)
      swapCall = await exchange.connect(owner).swap(SOME_TOKEN, 0)

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
      // get data of the pool on console
      console.log(
        `Reserve: ${ethers.utils.formatEther(
          tokenReserve0.toString()
        )} TOKEN, ${ethers.utils.formatEther(ethReserve0.toString())} ETH`
      )
      console.log(
        `Prices: ${
          (await exchange.getPrice(tokenReserve0, ethReserve0)) / 1000
        } Token per ETH`
      )
      // ---

      const ethOut = await exchange.getEthAmount(SOME_TOKEN)
      await exchange.connect(owner).swap(SOME_TOKEN, 0)
      const [tokenReserve1, ethReserve1] = await exchange.getReserves()
      console.log('--- SWAP ---')

      // get data of the pool on console
      console.log(
        `Reserve: ${ethers.utils.formatEther(
          tokenReserve1.toString()
        )} TOKEN, ${ethers.utils.formatEther(ethReserve1.toString())} ETH`
      )
      console.log(
        `Prices: ${
          (await exchange.getPrice(tokenReserve1, ethReserve1)) / 1000
        } Token per ETH`
      )
      // ---

      expect(tokenReserve1, 'token reserve').to.equal(
        tokenReserve0.add(SOME_TOKEN)
      )
      expect(ethReserve1, 'eth reserve').to.equal(ethReserve0.sub(ethOut))
    })
  })
})
