import packet from 'dns-packet'
import { ethers } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const tld_map = {
  mainnet: ['xyz'],
  ropsten: ['xyz'],
  localhost: ['xyz'],
  hardhat: ['xyz'],
  goerli: ['xyz'],
  'bsc-testnet': ['exposed', 'joy', 'market', 'netbank'],
}

const ZERO_HASH =
  '0x0000000000000000000000000000000000000000000000000000000000000000'

function encodeName(name: string) {
  return '0x' + packet.name.encode(name).toString('hex')
}

async function setTLDs(
  owner: string,
  registry: any,
  registrar: any,
  tlds: any[],
) {
  if (tlds === undefined) {
    return []
  }

  const transactions: any[] = []
  for (const tld of tlds) {
    if (
      registrar.address !== (await registry.owner(ethers.utils.namehash(tld)))
    ) {
      console.log(`Transferring .${tld} to new DNS registrar`)
      transactions.push(
        await registrar.enableNode(encodeName(tld), {
          gasLimit: 10000000,
        }),
      )
    }
  }
  return transactions
}
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, network } = hre
  const { deployer } = await getNamedAccounts()

  const signer = await ethers.getSigner(deployer)

  let transactions: any[] = []
  const registrar = await ethers.getContract('DNSRegistrar', signer)
  const registry = await ethers.getContract('ENSRegistry', signer)
  transactions = await setTLDs(
    deployer,
    registry,
    registrar,
    tld_map[network.name as keyof typeof tld_map],
  )

  if (transactions.length > 0) {
    console.log(
      `Waiting on ${transactions.length} transactions setting DNS TLDs`,
    )
    await Promise.all(transactions.map((tx) => tx.wait()))
  }
}

func.tags = ['dnsregistrar']
func.dependencies = ['registry', 'dnssec-oracle']

export default func
