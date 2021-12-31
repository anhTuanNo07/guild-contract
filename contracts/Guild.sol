//SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeCastUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";

contract MechGuild is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{

    using SafeCastUpgradeable for uint256;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.UintSet;

    uint32 public OUT_GUILD_PENALTY_TIME;
    uint256 public guildCount;
    uint256 public createGuildFee;

    // Detail information of guilds
    GuildInformation[] public guildInformation;

    // Struct for guild
    struct GuildInformation {
        uint256 totalSupply;
        uint256 createdGuildTime;
        uint16 guildHallLevel;
        address guildMaster;
        uint256 guildTicket;
        bool guildPublic;
    }

    // Struct for signature
    struct EIP712Signature {
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    // mapping
    mapping(address => uint256) memberToGuild;

    mapping(address => uint256) lastTimeOutGuild;

    mapping(address => uint256) guildTicketCount;

    mapping(address => uint256) claimGuildTicketWithSigNonces;

    mapping(address => mapping(uint256 => bool)) public guildTicketClaim;

    mapping(uint256 => GuildInformation) public guildIdToInformation;

    // Type has to fit the data structure when claim guild ticket
    bytes32 public constant CLAIM_GUILD_TICKET_WITH_SIG_TYPEHASH = 
        keccak256(
            "ClaimGuildTicketWithSig(address memberAddress,uint256 amount,uint256 checkpoint,uint256 nonce,uint256 deadline)"
        );

    bytes32 public constant DOMAIN_SEPARATOR =
        keccak256(
            "EIP712Domain(string name,string version,address verifyingContract)"
        );

    // Modifiers
    modifier inGuild() {
        require(
            memberToGuild[msg.sender] != 0,
            "Must be in certain guild"
        );
        _;
    }

    modifier notInGuild() {
        require(
            memberToGuild[msg.sender] == 0,
            "Must be not in certain guild"
        );
        _;
    }

    modifier inTheSameGuild(address _member) {
        require(
            memberToGuild[msg.sender] == memberToGuild[_member], 
            "Must be the same guild"
        );
        _;
    }

    modifier guildMaster() {
        require(
            msg.sender == guildIdToInformation[memberToGuild[msg.sender]].guildMaster,
            "Not the master of guild"
        );
        _;
    }

    modifier notGuildMaster() {
        require(
            msg.sender != guildIdToInformation[memberToGuild[msg.sender]].guildMaster,
            "Be the master of guild"
        );
        _;
    }

    modifier outOfPenaltyTime(address _address) {
        require(
            block.timestamp >= lastTimeOutGuild[_address] + OUT_GUILD_PENALTY_TIME,
            "Have not ended penalty time"
        );
        _;
    }

    modifier publicGuild(uint256 _guildId) {
        require(
            guildIdToInformation[_guildId].guildPublic == true,
            "not a public guild"
        );
        _;
    }

    modifier enoughBalance(uint256 _amount) {
        require(
            guildTicketCount[msg.sender] >= _amount,
            "not enough balance"
        );
        _;
    }

    // events
    event CreatedGuild(
        uint256 guildId, 
        address guildMaster, 
        uint256 createdGuildTime
    );

    event ChangedGuildMaster(
        uint256 guildId,
        address newGuildMaster
    );

    event AddMemberToGuild(
        uint256 guildId,
        address memberAddress    
    );

    event OutOfGuild(
        address memberAddress
    );

    event AccountGuildTicketClaimed(
        address account,
        uint256 checkpoint,
        uint256 amount
    );


    // Signer address that sign message to claim reward
    address private signer;

    // function
    function __MechaGuild_init() public initializer {
        __Ownable_init();
        OUT_GUILD_PENALTY_TIME = 2 days;
        guildCount = 1;
        createGuildFee = 100;
    }

    function setSigner(address _signer) public onlyOwner {
        signer = _signer;
    }

    function createGuild(
        uint256 _createdGuildTime,
        address _guildMaster
    ) public notInGuild() {
        require(guildTicketCount[msg.sender] >= 100, "not enough guild ticket");
        guildIdToInformation[guildCount] =  GuildInformation({
                totalSupply: 0,
                createdGuildTime: _createdGuildTime,
                guildHallLevel: 1,
                guildMaster: _guildMaster,
                guildTicket: 0,
                guildPublic: false
            });

        memberToGuild[msg.sender] = guildCount;
        guildTicketCount[msg.sender] -= createGuildFee;
        guildCount++;

        emit AddMemberToGuild(guildInformation.length, msg.sender);
        emit CreatedGuild(guildInformation.length, _guildMaster, _createdGuildTime);
    }

    function changeGuildMaster(
        address _newGuildMaster
    ) external inGuild() inTheSameGuild(_newGuildMaster) guildMaster() {
        guildIdToInformation[memberToGuild[msg.sender]].guildMaster = _newGuildMaster;

        emit ChangedGuildMaster(memberToGuild[msg.sender], _newGuildMaster);
    }

    function returnMemberGuild(address _memberAddress) public view returns(uint256) {
        return memberToGuild[_memberAddress];
    }

    function addMemberToGuild(
        address _memberAddress
    ) public inGuild() guildMaster() outOfPenaltyTime(_memberAddress) {
        _addMemberToGuild(memberToGuild[msg.sender], _memberAddress);
    }

    function requestJoinGuild(
        uint256 _guildId
    ) public publicGuild(_guildId) {
        _addMemberToGuild(_guildId, msg.sender);
    }

    function outOfGuild() public inGuild() notGuildMaster() {
        _outOfGuild(msg.sender);
    }

    function kickMember(
        address _memberAddress
    ) public inGuild() guildMaster() inTheSameGuild(_memberAddress) {
        _outOfGuild(_memberAddress);
    }

    function changePublicStatus(
        bool status
    ) public inGuild() guildMaster() {
        guildIdToInformation[memberToGuild[msg.sender]].guildPublic = status;
    }

    function claimGuildTicket(
        uint256 _amount,
        uint256 _checkpoint,
        EIP712Signature memory sig_
    ) external {
        require(!guildTicketClaim[msg.sender][_checkpoint], "already claimed");
        require(sig_.deadline == 0 || sig_.deadline >= block.timestamp, "signature expired");

        bytes32 domainSeparator = _calculateDomainSeparator();

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                domainSeparator,
                keccak256(
                    abi.encode(
                        CLAIM_GUILD_TICKET_WITH_SIG_TYPEHASH,
                        msg.sender,
                        _amount,
                        _checkpoint,
                        claimGuildTicketWithSigNonces[msg.sender]++,
                        sig_.deadline
                    )
                )
            )
        );

        address recoveredAddress = ecrecover(digest, sig_.v, sig_.r, sig_.s);

        require(recoveredAddress == signer, "invalid signature");

        guildTicketClaim[msg.sender][_checkpoint] = true;

        guildTicketCount[msg.sender] += _amount;
        emit AccountGuildTicketClaimed(msg.sender, _checkpoint, _amount);
    }

    function getSigNonce(address _address) public view returns(uint256) {
        return claimGuildTicketWithSigNonces[_address];
    }

    function getGuildTicketCount(address _address) public view returns(uint256) {
        return guildTicketCount[_address];
    }

    function donateGuild(uint256 _amount) public inGuild() enoughBalance(_amount) {
        guildIdToInformation[memberToGuild[msg.sender]].guildTicket += _amount;
        guildTicketCount[msg.sender] -= _amount;
    }

    // function levelUp

    // private function
    function _outOfGuild(address _address) private {
        memberToGuild[_address] = 0;
        lastTimeOutGuild[_address] = block.timestamp;

        emit OutOfGuild(_address);
    }

    function _addMemberToGuild(
        uint256 _guildId,
        address _memberAddress
    ) private {
        memberToGuild[_memberAddress] = _guildId;

        emit AddMemberToGuild(
            _guildId, 
            _memberAddress
        );
    }

    function _calculateDomainSeparator() internal view returns (bytes32) {
        return 
            keccak256(
                abi.encode(
                    DOMAIN_SEPARATOR,
                    keccak256(bytes("Guild")),
                    keccak256(bytes("1")),
                    address(this)
                )
            );
    }
}