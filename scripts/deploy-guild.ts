import { MechGuild__factory } from './../typechain-types/factories/MechGuild__factory';
// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers, upgrades } from "hardhat";
import { MechGuild } from '../typechain-types/MechGuild';

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Deploy contract proxy
  const guild = await (await upgrades.deployProxy(
    new MechGuild__factory(deployer),
    [],
    { initializer: '__MechaGuild_init' }
  )).deployed() as MechGuild;

  console.log("Guild address:", guild.address);


}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
