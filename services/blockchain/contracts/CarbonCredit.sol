// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title CarbonCredit
 * @dev NFT contract for tokenizing carbon credits with comprehensive features
 */
contract CarbonCredit is 
    ERC721, 
    ERC721URIStorage, 
    ERC721Burnable, 
    AccessControl, 
    Pausable, 
    ReentrancyGuard 
{
    using Counters for Counters.Counter;

    // Role definitions
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant MARKETPLACE_ROLE = keccak256("MARKETPLACE_ROLE");

    // Token counter
    Counters.Counter private _tokenIdCounter;

    // Carbon credit metadata structure
    struct CreditMetadata {
        uint256 carbonAmount; // CO2 equivalent in tonnes
        string projectId;
        string methodology;
        uint256 vintageYear;
        string location;
        address farmer;
        uint256 issuanceDate;
        uint256 expirationDate;
        bool isVerified;
        bool isRetired;
        string verificationStandard; // VCS, Gold Standard, etc.
        string additionalData; // IPFS hash for additional data
    }

    // Mappings
    mapping(uint256 => CreditMetadata) public creditMetadata;
    mapping(address => uint256[]) public farmerCredits;
    mapping(string => uint256[]) public projectCredits;
    mapping(uint256 => bool) public isTransferable;
    mapping(uint256 => uint256) public creditPrices;
    
    // Trading and marketplace
    struct SaleOffer {
        address seller;
        uint256 price;
        uint256 expiration;
        bool active;
    }
    
    mapping(uint256 => SaleOffer) public saleOffers;
    mapping(address => uint256) public pendingWithdrawals;

    // Events
    event CreditMinted(
        uint256 indexed tokenId,
        address indexed farmer,
        string projectId,
        uint256 carbonAmount,
        uint256 vintageYear
    );
    
    event CreditVerified(
        uint256 indexed tokenId,
        address indexed verifier,
        string verificationStandard
    );
    
    event CreditRetired(
        uint256 indexed tokenId,
        address indexed retiree,
        string reason
    );
    
    event CreditListed(
        uint256 indexed tokenId,
        address indexed seller,
        uint256 price,
        uint256 expiration
    );
    
    event CreditSold(
        uint256 indexed tokenId,
        address indexed seller,
        address indexed buyer,
        uint256 price
    );

    constructor() ERC721("KrishiMitra Carbon Credits", "KMCC") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
    }

    /**
     * @dev Mint new carbon credit NFT
     */
    function mintCarbonCredit(
        address farmer,
        string memory projectId,
        uint256 carbonAmount,
        uint256 vintageYear,
        string memory location,
        string memory methodology,
        uint256 expirationDate,
        string memory additionalData,
        string memory tokenURI
    ) public onlyRole(MINTER_ROLE) whenNotPaused returns (uint256) {
        require(farmer != address(0), "Invalid farmer address");
        require(carbonAmount > 0, "Carbon amount must be positive");
        require(vintageYear <= block.timestamp / 365 days + 1970, "Invalid vintage year");
        require(expirationDate > block.timestamp, "Expiration date must be in future");

        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();

        // Mint the NFT
        _safeMint(farmer, tokenId);
        _setTokenURI(tokenId, tokenURI);

        // Set metadata
        creditMetadata[tokenId] = CreditMetadata({
            carbonAmount: carbonAmount,
            projectId: projectId,
            methodology: methodology,
            vintageYear: vintageYear,
            location: location,
            farmer: farmer,
            issuanceDate: block.timestamp,
            expirationDate: expirationDate,
            isVerified: false,
            isRetired: false,
            verificationStandard: "",
            additionalData: additionalData
        });

        // Update mappings
        farmerCredits[farmer].push(tokenId);
        projectCredits[projectId].push(tokenId);
        isTransferable[tokenId] = false; // Not transferable until verified

        emit CreditMinted(tokenId, farmer, projectId, carbonAmount, vintageYear);
        
        return tokenId;
    }

    /**
     * @dev Verify a carbon credit
     */
    function verifyCarbonCredit(
        uint256 tokenId,
        string memory verificationStandard
    ) public onlyRole(VERIFIER_ROLE) {
        require(_exists(tokenId), "Token does not exist");
        require(!creditMetadata[tokenId].isVerified, "Already verified");
        require(!creditMetadata[tokenId].isRetired, "Cannot verify retired credit");

        creditMetadata[tokenId].isVerified = true;
        creditMetadata[tokenId].verificationStandard = verificationStandard;
        isTransferable[tokenId] = true;

        emit CreditVerified(tokenId, msg.sender, verificationStandard);
    }

    /**
     * @dev Retire a carbon credit (burn for offset)
     */
    function retireCarbonCredit(
        uint256 tokenId,
        string memory reason
    ) public {
        require(_exists(tokenId), "Token does not exist");
        require(ownerOf(tokenId) == msg.sender, "Not the owner");
        require(creditMetadata[tokenId].isVerified, "Credit not verified");
        require(!creditMetadata[tokenId].isRetired, "Already retired");

        creditMetadata[tokenId].isRetired = true;
        
        // Remove from active marketplace if listed
        if (saleOffers[tokenId].active) {
            saleOffers[tokenId].active = false;
        }

        emit CreditRetired(tokenId, msg.sender, reason);
        
        // Burn the token
        _burn(tokenId);
    }

    /**
     * @dev List carbon credit for sale
     */
    function listCreditForSale(
        uint256 tokenId,
        uint256 price,
        uint256 duration
    ) public {
        require(_exists(tokenId), "Token does not exist");
        require(ownerOf(tokenId) == msg.sender, "Not the owner");
        require(isTransferable[tokenId], "Credit not transferable");
        require(!creditMetadata[tokenId].isRetired, "Cannot sell retired credit");
        require(price > 0, "Price must be positive");

        uint256 expiration = block.timestamp + duration;
        
        saleOffers[tokenId] = SaleOffer({
            seller: msg.sender,
            price: price,
            expiration: expiration,
            active: true
        });

        emit CreditListed(tokenId, msg.sender, price, expiration);
    }

    /**
     * @dev Buy carbon credit from marketplace
     */
    function buyCarbonCredit(uint256 tokenId) public payable nonReentrant {
        require(_exists(tokenId), "Token does not exist");
        
        SaleOffer storage offer = saleOffers[tokenId];
        require(offer.active, "Not for sale");
        require(block.timestamp <= offer.expiration, "Sale expired");
        require(msg.value >= offer.price, "Insufficient payment");
        require(!creditMetadata[tokenId].isRetired, "Cannot buy retired credit");

        address seller = offer.seller;
        uint256 price = offer.price;

        // Deactivate the offer
        offer.active = false;

        // Transfer the NFT
        _transfer(seller, msg.sender, tokenId);

        // Handle payment
        pendingWithdrawals[seller] += price;

        // Refund excess payment
        if (msg.value > price) {
            pendingWithdrawals[msg.sender] += (msg.value - price);
        }

        emit CreditSold(tokenId, seller, msg.sender, price);
    }

    /**
     * @dev Withdraw pending payments
     */
    function withdraw() public nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "No funds to withdraw");

        pendingWithdrawals[msg.sender] = 0;
        
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Withdrawal failed");
    }

    /**
     * @dev Cancel sale offer
     */
    function cancelSale(uint256 tokenId) public {
        require(ownerOf(tokenId) == msg.sender, "Not the owner");
        require(saleOffers[tokenId].active, "Not for sale");

        saleOffers[tokenId].active = false;
    }

    /**
     * @dev Get farmer's carbon credits
     */
    function getFarmerCredits(address farmer) public view returns (uint256[] memory) {
        return farmerCredits[farmer];
    }

    /**
     * @dev Get project's carbon credits
     */
    function getProjectCredits(string memory projectId) public view returns (uint256[] memory) {
        return projectCredits[projectId];
    }

    /**
     * @dev Check if credit is expired
     */
    function isCreditExpired(uint256 tokenId) public view returns (bool) {
        require(_exists(tokenId), "Token does not exist");
        return block.timestamp > creditMetadata[tokenId].expirationDate;
    }

    /**
     * @dev Batch mint for multiple farmers
     */
    function batchMintCarbonCredits(
        address[] memory farmers,
        string[] memory projectIds,
        uint256[] memory carbonAmounts,
        uint256[] memory vintageYears,
        string[] memory locations,
        string[] memory methodologies,
        uint256[] memory expirationDates,
        string[] memory additionalDataArray,
        string[] memory tokenURIs
    ) public onlyRole(MINTER_ROLE) whenNotPaused {
        require(farmers.length == projectIds.length, "Arrays length mismatch");
        require(farmers.length == carbonAmounts.length, "Arrays length mismatch");
        // Additional length checks...

        for (uint256 i = 0; i < farmers.length; i++) {
            mintCarbonCredit(
                farmers[i],
                projectIds[i],
                carbonAmounts[i],
                vintageYears[i],
                locations[i],
                methodologies[i],
                expirationDates[i],
                additionalDataArray[i],
                tokenURIs[i]
            );
        }
    }

    /**
     * @dev Emergency pause functionality
     */
    function pause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Override transfer to check transferability
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override whenNotPaused {
        if (from != address(0) && to != address(0)) { // Not minting or burning
            require(isTransferable[tokenId], "Token not transferable");
            require(!creditMetadata[tokenId].isRetired, "Cannot transfer retired credit");
            require(!isCreditExpired(tokenId), "Cannot transfer expired credit");
        }
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    // Required overrides
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
