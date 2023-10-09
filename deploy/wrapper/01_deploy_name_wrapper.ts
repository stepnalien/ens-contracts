import { Interface } from 'ethers/lib/utils'
import { ethers } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const { makeInterfaceId } = require('@openzeppelin/test-helpers')

function computeInterfaceId(iface: Interface) {
  return makeInterfaceId.ERC165(
    Object.values(iface.functions).map((frag) => frag.format('sighash')),
  )
}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments, network } = hre
  const { deploy } = deployments
  const { deployer, owner } = await getNamedAccounts()

  const registry = await ethers.getContract('ENSRegistry', deployer)
  const registrar = await ethers.getContract(
    'BaseRegistrarImplementation',
    deployer,
  )
  const metadata = await ethers.getContract('StaticMetadataService', deployer)

  const deployArgs = {
    from: deployer,
    args: [
      registry.address,
      '0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85',
      metadata.address,
    ],
    log: true,
  }

  const nameWrapper = await deploy('NameWrapper', deployArgs)
  if (!nameWrapper.newlyDeployed) return

  if (deployer !== deployer) {
    const wrapper = await ethers.getContract('NameWrapper', deployer)
    const tx = await wrapper.transferOwnership(deployer)
    console.log(
      `Transferring ownership of NameWrapper to ${deployer} (tx: ${tx.hash})...`,
    )
    await tx.wait()
  }

  // Only attempt to make controller etc changes directly on testnets
  if (network.name === 'mainnet') return

  const tx2 = await registrar.addController(nameWrapper.address)
  console.log(
    `Adding NameWrapper as controller on registrar (tx: ${tx2.hash})...`,
  )
  await tx2.wait()

  const artifact = await deployments.getArtifact('INameWrapper')
  const interfaceId = computeInterfaceId(new Interface(artifact.abi))
  const resolver = await registry.resolver(ethers.utils.namehash('eth'))
  if (resolver === ethers.constants.AddressZero) {
    console.log(
      `No resolver set for .eth; not setting interface ${interfaceId} for NameWrapper`,
    )
    return
  }
  const resolverContract = await ethers.getContractAt('OwnedResolver', resolver)
  const tx3 = await resolverContract.setInterface(
    ethers.utils.namehash('eth'),
    interfaceId,
    nameWrapper.address,
  )
  console.log(
    `Setting NameWrapper interface ID ${interfaceId} on .eth resolver (tx: ${tx3.hash})...`,
  )
  await tx3.wait()
}

func.id = 'name-wrapper'
func.tags = ['wrapper', 'NameWrapper']
func.dependencies = [
  'StaticMetadataService',
  'registry',
  'ReverseRegistrar',
  'OwnedResolver',
]

export default func
