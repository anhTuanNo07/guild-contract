import { expect } from "chai"
import { ethers, upgrades } from "hardhat"
import { utils, BigNumber } from "ethers"
import { time } from "@openzeppelin/test-helpers";
import { signGuildTicketClaim } from './util'

describe("Guild basic function ", function () {
  // assign address
  before(async function() {
    this.signers = await ethers.getSigners();
    this.alice = this.signers[0]; // This is owner default
    this.bob = this.signers[1];
    this.carol = this.signers[2];
    this.minter = this.signers[4];
    
    // this.GuildMode = await ethers.getContractFactory("MechaGuild")
  })
  
    // initial Token
  beforeEach(async function() {    
    // Deploy the guild contract
    const GuildContract = await ethers.getContractFactory("MechGuild");
    this.guild = await upgrades.deployProxy(GuildContract, {
      initializer: '__MechaGuild_init'
    });
    this.guild.deployed();
    
    // set owner
    await this.guild.connect(this.alice).setSigner(this.minter.address)
    
    // Sign for minter create guild
    const signatureRes = await signGuildTicketClaim(this.guild, 300, 0, this.minter, this.minter)

    // claim Tokens
    await this.guild.connect(this.minter).claimGuildTicket(300, 0, signatureRes)

    // create the first guild for minter
    await this.guild.connect(this.minter).createGuild(
      (await time.latest()).toNumber(),
      this.minter.address
    )
  })

  
  it("check balance of minter", async function() {
    const minterGuildTicket = await this.guild.getGuildTicketCount(this.minter.address)
    expect(minterGuildTicket.toNumber()).to.equal(200)
  })

  it("minter create a new guild", async function() {
    const guild = await this.guild.guildIdToInformation(1)
    expect(guild.guildMaster).to.equal(this.minter.address)
  });

  it("change guild master to other address not in the guild", async function() {
    try {
      // change guild master to alice who is not inside the guild
      await this.guild.connect(this.minter).changeGuildMaster(this.alice.address)
    } catch (error: any) {
      expect(error.message)
        .to.equal(`VM Exception while processing transaction: reverted with reason string 'Must be the same guild'`)
    }
  });

  it("change guild master to other address inside the guild", async function () {
    // add alice to the guild
    await this.guild.connect(this.minter).addMemberToGuild(this.alice.address)
    const aliceGuild = await this.guild.returnMemberGuild(this.alice.address)
    const minterGuild = await this.guild.returnMemberGuild(this.minter.address)

    // change master guild
    await this.guild.connect(this.minter).changeGuildMaster(this.alice.address)

    const guild = await this.guild.guildIdToInformation(1)
    expect(guild.guildMaster).to.equal(this.alice.address)
  });

  it("remove member and add again", async function() {
    await this.guild.connect(this.minter).addMemberToGuild(this.alice.address)
    await this.guild.connect(this.minter).kickMember(this.alice.address)
    try {
      await this.guild.connect(this.minter).addMemberToGuild(this.alice.address)
    } catch(error: any) {
      expect(error.message)
        .to.equal(`VM Exception while processing transaction: reverted with reason string 'Have not ended penalty time'`)
    }
  });

  it("out of guild successfully", async function() {
    await this.guild.connect(this.minter).addMemberToGuild(this.alice.address)
    await this.guild.connect(this.alice).outOfGuild()
    const aliceGuild = await this.guild.returnMemberGuild(this.alice.address)
    expect(aliceGuild.toNumber()).to.equal(0)
  });

  it("request join private guild", async function() {
    try{
      await this.guild.connect(this.bob).requestJoinGuild(1)
    } catch (error: any) {
      expect(error.message)
        .to.equal(`VM Exception while processing transaction: reverted with reason string 'not a public guild'`)
    }
  })

  it("request join public guild", async function() {
    await this.guild.connect(this.minter).changePublicStatus(true)
    await this.guild.connect(this.bob).requestJoinGuild(1)
    const bobGuild = await this.guild.returnMemberGuild(this.bob.address)
    expect(bobGuild.toNumber()).to.equal(1)
  });

  it("create other guild while still be in certain guild", async function() {
    try {
      await this.guild.connect(this.minter).createGuild(
        (await time.latest()).toNumber(),
        this.minter.address
      )
    } catch(error: any) {
      expect(error.message)
        .to.equal(`VM Exception while processing transaction: reverted with reason string 'Must be not in certain guild'`)
    }
  })

  it("guild master out guild", async function() {
    try {
      await this.guild.connect(this.minter).outOfGuild()
    } catch (error: any) {
      expect(error.message)
        .to.equal(`VM Exception while processing transaction: reverted with reason string 'Be the master of guild'`)
    }
  })

  it("kick member in other guild", async function () {
    // Sign for signer create guild
    const signatureRes = await signGuildTicketClaim(this.guild, 500, 0, this.minter, this.alice)
    // console.log(signatureRes, 'signatureRes')

    // claim Tokens
    await this.guild.connect(this.alice).claimGuildTicket(500, 0, signatureRes)
    
    // create the second guild for signer
    await this.guild.connect(this.alice).createGuild(
      (await time.latest()).toNumber(),
      this.alice.address
    )

    // minter kick alice from other guild
    try {
      await this.guild.connect(this.minter).kickMember(this.alice.address);
    } catch (error) {
      expect(error.message)
        .to.equal(`VM Exception while processing transaction: reverted with reason string 'Must be the same guild'`)
    }
  })
})