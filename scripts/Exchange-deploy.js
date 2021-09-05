/* eslint-disable comma-dangle */
const { ethers } = require('hardhat')
const hre = require('hardhat')
const { deployed } = require('./deployed')
const { readFile } = require('fs/promises')

const CONTRACT_NAME = 'Exchange'
const SUPPLY = ethers.utils.parseEther('100000')
const ONE_ETH = ethers.utils.parseEther('1')

const main = async () => {
  const [deployer] = await ethers.getSigners()
  const CONTRACTS_DEPLOYED = JSON.parse(
    await readFile('./scripts/deployed.json', 'utf-8')
  )
  const TOKEN_CONTRACT = CONTRACTS_DEPLOYED.Token[hre.network.name].address
  console.log('Deploying contracts with the account:', deployer.address)
  const Exchange = await hre.ethers.getContractFactory(CONTRACT_NAME)
  const exchange = await Exchange.deploy(
    TOKEN_CONTRACT,
    deployer.address,
    SUPPLY.div(5),
    { value: ONE_ETH }
  )
  await exchange.deployed()

  const Token = await ethers.getContractFactory('Token')
  const token = await Token.attach(TOKEN_CONTRACT)
  await token.connect(deployer).transfer(exchange.address, SUPPLY.div(5))

  await deployed(CONTRACT_NAME, hre.network.name, exchange.address)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
