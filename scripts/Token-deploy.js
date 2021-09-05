const { ethers } = require('hardhat')
const hre = require('hardhat')
const { deployed } = require('./deployed')

const CONTRACT_NAME = 'Token'
const SUPPLY = ethers.utils.parseEther('100000')

const main = async () => {
  const [deployer] = await ethers.getSigners()
  console.log('Deploying contracts with the account:', deployer.address)
  const Token = await hre.ethers.getContractFactory(CONTRACT_NAME)
  const token = await Token.deploy(SUPPLY)
  await token.deployed()
  await deployed(CONTRACT_NAME, hre.network.name, token.address)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
