import { MechGuild } from './../typechain-types/MechGuild';
import { expect } from "chai"
import { ethers, upgrades } from "hardhat"
import { utils, BigNumber } from "ethers"
import { time } from "@openzeppelin/test-helpers";
import { signGuildTicketClaim } from './util'
import { expectRevert } from "@openzeppelin/test-helpers"

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
    this.guild.deployed() as MechGuild;
    
    // set owner
    await this.guild.connect(this.alice).setSigner(this.minter.address)
    
    // Sign for minter create guild
    const signatureRes = await signGuildTicketClaim(this.guild, 300, 0, this.minter, this.minter)

    // claim Tokens
    await this.guild.connect(this.minter).claimGuildTicket(300, 0, signatureRes)

    // create the first guild for minter
    await this.guild.connect(this.minter).createGuild(
      (await time.latest()).toNumber()
    )
  })

  
  it("check balance of minter", async function() {
    const minterGuildTicket = await this.guild.guildTicketCount(this.minter.address)
    expect(minterGuildTicket.toNumber()).to.equal(200)
  })

  it("minter create a new guild", async function() {
    const guild = await this.guild.guildIdToInformation(1)
    expect(guild.guildMaster).to.equal(this.minter.address)
  });

  it("not enough guild ticket to create new guild", async function() {
    await expectRevert(
      this.guild.connect(this.bob).createGuild(
        (await time.latest()).toNumber()
      ),
      'not enough balance',
    )
  })

  it("change guild master to other address not in the guild", async function() {
    await expectRevert(
      this.guild.connect(this.minter).changeGuildMaster(this.alice.address),
      'Must be the same guild',
    )
  });

  it("change guild master to other address inside the guild", async function () {
    // add alice to the guild
    await this.guild.connect(this.minter).addMemberToGuild(this.alice.address)
    const aliceGuild = await this.guild.memberToGuild(this.alice.address)
    const minterGuild = await this.guild.memberToGuild(this.minter.address)

    // change master guild
    await this.guild.connect(this.minter).changeGuildMaster(this.alice.address)

    const guild = await this.guild.guildIdToInformation(1)
    expect(guild.guildMaster).to.equal(this.alice.address)
  });

  it("remove member and add again", async function() {
    await this.guild.connect(this.minter).addMemberToGuild(this.alice.address)
    await this.guild.connect(this.minter).kickMember(this.alice.address)
    await expectRevert(
      this.guild.connect(this.minter).addMemberToGuild(this.alice.address),
      'Have not ended penalty time',
    )
  });

  it("normal member out of guild successfully", async function() {
    await this.guild.connect(this.minter).addMemberToGuild(this.alice.address)
    await this.guild.connect(this.alice).outOfGuild()
    const aliceGuild = await this.guild.memberToGuild(this.alice.address)
    expect(aliceGuild.toNumber()).to.equal(0)
  });

  it("guild master out of guild without transfer power", async function() {
    await expectRevert(
      this.guild.connect(this.minter).outOfGuild(),
      'Be the master of guild',
    )
  })

  it("guild master out of guild with transfer power", async function() {
    await this.guild.connect(this.minter).addMemberToGuild(this.alice.address)
    await this.guild.connect(this.minter).changeGuildMaster(this.alice.address)
    await this.guild.connect(this.minter).outOfGuild()
    const minterGuild = await this.guild.memberToGuild(this.minter.address)
    expect(minterGuild.toNumber()).to.equal(0)

  })

  it("change guild master for user not in current guild", async function() {
    await expectRevert(
      this.guild.connect(this.minter).changeGuildMaster(this.alice.address),
      'Must be the same guild',
    )
  })

  it("request join private guild", async function() {
    await expectRevert(
      this.guild.connect(this.bob).requestJoinGuild(1),
      'not a public guild',
    )
  })

  it("request join public guild", async function() {
    await this.guild.connect(this.minter).changePublicStatus(true)
    await this.guild.connect(this.bob).requestJoinGuild(1)
    const bobGuild = await this.guild.memberToGuild(this.bob.address)
    expect(bobGuild.toNumber()).to.equal(1)
  });

  it("create other guild while still be in certain guild", async function() {
    await expectRevert(
      this.guild.connect(this.minter).createGuild(
        (await time.latest()).toNumber()
      ),
      'Must be not in certain guild',
    )
  })

  it("guild master out guild", async function() {
    await expectRevert(
      this.guild.connect(this.minter).outOfGuild(),
      'Be the master of guild',
    )
  })

  it("kick member in other guild", async function () {
    // Sign for signer create guild
    const signatureRes = await signGuildTicketClaim(this.guild, 500, 0, this.minter, this.alice)
    // console.log(signatureRes, 'signatureRes')

    // claim Tokens
    await this.guild.connect(this.alice).claimGuildTicket(500, 0, signatureRes)
    
    // create the second guild for alice
    await this.guild.connect(this.alice).createGuild(
      (await time.latest()).toNumber()
    )

    // minter kick alice from other guild
    await expectRevert(
      this.guild.connect(this.minter).kickMember(this.alice.address),
      'Must be the same guild',
    )
  })

  it("add member in other guild", async function() {
    // Sign for signer create guild
    const signatureRes = await signGuildTicketClaim(this.guild, 500, 0, this.minter, this.alice)
    // console.log(signatureRes, 'signatureRes')

    // claim Tokens
    await this.guild.connect(this.alice).claimGuildTicket(500, 0, signatureRes)
    
    // create the second guild for alice
    await this.guild.connect(this.alice).createGuild(
      (await time.latest()).toNumber()
    )

    // minter add alice from other guild
    await expectRevert(
      this.guild.connect(this.minter).addMemberToGuild(this.alice.address),
      'Must be not in certain guild'
    )
  })
})