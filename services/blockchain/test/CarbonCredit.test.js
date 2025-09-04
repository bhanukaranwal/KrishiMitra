const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("CarbonCredit", function () {
  async function deployCarbonCreditFixture() {
    const [owner, farmer, verifier, buyer, otherAccount] = await ethers.getSigners();

    const CarbonCredit = await ethers.getContractFactory("CarbonCredit");
    const carbonCredit = await CarbonCredit.deploy();

    // Grant roles
    const MINTER_ROLE = await carbonCredit.MINTER_ROLE();
    const VERIFIER_ROLE = await carbonCredit.VERIFIER_ROLE();
    
    await carbonCredit.grantRole(MINTER_ROLE, owner.address);
    await carbonCredit.grantRole(VERIFIER_ROLE, verifier.address);

    return { 
      carbonCredit, 
      owner, 
      farmer, 
      verifier, 
      buyer, 
      otherAccount,
      MINTER_ROLE,
      VERIFIER_ROLE 
    };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { carbonCredit, owner } = await loadFixture(deployCarbonCreditFixture);
      const DEFAULT_ADMIN_ROLE = await carbonCredit.DEFAULT_ADMIN_ROLE();
      expect(await carbonCredit.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("Should assign minter role to owner", async function () {
      const { carbonCredit, owner, MINTER_ROLE } = await loadFixture(deployCarbonCreditFixture);
      expect(await carbonCredit.hasRole(MINTER_ROLE, owner.address)).to.be.true;
    });
  });

  describe("Minting", function () {
    it("Should mint carbon credit successfully", async function () {
      const { carbonCredit, farmer } = await loadFixture(deployCarbonCreditFixture);
      
      const projectId = "PROJ001";
      const carbonAmount = ethers.utils.parseUnits("100", 4); // 100.0000 tonnes
      const vintageYear = 2023;
      const location = "Tamil Nadu, India";
      const methodology = "VM0042";
      const expirationDate = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60); // 1 year
      const additionalData = "ipfs://QmHash123";
      const tokenURI = "https://api.krishimitra.com/metadata/1";

      await expect(
        carbonCredit.mintCarbonCredit(
          farmer.address,
          projectId,
          carbonAmount,
          vintageYear,
          location,
          methodology,
          expirationDate,
          additionalData,
          tokenURI
        )
      ).to.emit(carbonCredit, "CreditMinted")
       .withArgs(0, farmer.address, projectId, carbonAmount, vintageYear);

      // Check ownership
      expect(await carbonCredit.ownerOf(0)).to.equal(farmer.address);
      
      // Check metadata
      const metadata = await carbonCredit.creditMetadata(0);
      expect(metadata.carbonAmount).to.equal(carbonAmount);
      expect(metadata.projectId).to.equal(projectId);
      expect(metadata.methodology).to.equal(methodology);
      expect(metadata.farmer).to.equal(farmer.address);
      expect(metadata.isVerified).to.be.false;
      expect(metadata.isRetired).to.be.false;
    });

    it("Should fail if not minter", async function () {
      const { carbonCredit, farmer, otherAccount } = await loadFixture(deployCarbonCreditFixture);
      
      await expect(
        carbonCredit.connect(otherAccount).mintCarbonCredit(
          farmer.address,
          "PROJ001",
          ethers.utils.parseUnits("100", 4),
          2023,
          "Location",
          "VM0042",
          Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60),
          "data",
          "uri"
        )
      ).to.be.revertedWith("AccessControl:");
    });

    it("Should batch mint multiple credits", async function () {
      const { carbonCredit, farmer, otherAccount } = await loadFixture(deployCarbonCreditFixture);
      
      const farmers = [farmer.address, otherAccount.address];
      const projectIds = ["PROJ001", "PROJ002"];
      const carbonAmounts = [
        ethers.utils.parseUnits("100", 4),
        ethers.utils.parseUnits("200", 4)
      ];
      const vintageYears = [2023, 2023];
      const locations = ["Location1", "Location2"];
      const methodologies = ["VM0042", "VM0042"];
      const expirationDates = [
        Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60),
        Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60)
      ];
      const additionalDataArray = ["data1", "data2"];
      const tokenURIs = ["uri1", "uri2"];

      await carbonCredit.batchMintCarbonCredits(
        farmers,
        projectIds,
        carbonAmounts,
        vintageYears,
        locations,
        methodologies,
        expirationDates,
        additionalDataArray,
        tokenURIs
      );

      expect(await carbonCredit.ownerOf(0)).to.equal(farmer.address);
      expect(await carbonCredit.ownerOf(1)).to.equal(otherAccount.address);
    });
  });

  describe("Verification", function () {
    it("Should verify carbon credit successfully", async function () {
      const { carbonCredit, farmer, verifier } = await loadFixture(deployCarbonCreditFixture);
      
      // First mint a credit
      await carbonCredit.mintCarbonCredit(
        farmer.address,
        "PROJ001",
        ethers.utils.parseUnits("100", 4),
        2023,
        "Location",
        "VM0042",
        Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60),
        "data",
        "uri"
      );

      // Verify the credit
      await expect(
        carbonCredit.connect(verifier).verifyCarbonCredit(0, "VCS")
      ).to.emit(carbonCredit, "CreditVerified")
       .withArgs(0, verifier.address, "VCS");

      // Check verification status
      const metadata = await carbonCredit.creditMetadata(0);
      expect(metadata.isVerified).to.be.true;
      expect(metadata.verificationStandard).to.equal("VCS");
      
      // Check transferability
      expect(await carbonCredit.isTransferable(0)).to.be.true;
    });

    it("Should fail verification if not verifier", async function () {
      const { carbonCredit, farmer, otherAccount } = await loadFixture(deployCarbonCreditFixture);
      
      await carbonCredit.mintCarbonCredit(
        farmer.address,
        "PROJ001",
        ethers.utils.parseUnits("100", 4),
        2023,
        "Location",
        "VM0042",
        Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60),
        "data",
        "uri"
      );

      await expect(
        carbonCredit.connect(otherAccount).verifyCarbonCredit(0, "VCS")
      ).to.be.revertedWith("AccessControl:");
    });
  });

  describe("Trading", function () {
    it("Should list credit for sale successfully", async function () {
      const { carbonCredit, farmer, verifier } = await loadFixture(deployCarbonCreditFixture);
      
      // Mint and verify credit
      await carbonCredit.mintCarbonCredit(
        farmer.address,
        "PROJ001",
        ethers.utils.parseUnits("100", 4),
        2023,
        "Location",
        "VM0042",
        Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60),
        "data",
        "uri"
      );
      
      await carbonCredit.connect(verifier).verifyCarbonCredit(0, "VCS");

      // List for sale
      const price = ethers.utils.parseEther("1"); // 1 ETH
      const duration = 7 * 24 * 60 * 60; // 7 days

      await expect(
        carbonCredit.connect(farmer).listCreditForSale(0, price, duration)
      ).to.emit(carbonCredit, "CreditListed");

      // Check sale offer
      const saleOffer = await carbonCredit.saleOffers(0);
      expect(saleOffer.seller).to.equal(farmer.address);
      expect(saleOffer.price).to.equal(price);
      expect(saleOffer.active).to.be.true;
    });

    it("Should buy carbon credit successfully", async function () {
      const { carbonCredit, farmer, verifier, buyer } = await loadFixture(deployCarbonCreditFixture);
      
      // Mint, verify, and list credit
      await carbonCredit.mintCarbonCredit(
        farmer.address,
        "PROJ001",
        ethers.utils.parseUnits("100", 4),
        2023,
        "Location",
        "VM0042",
        Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60),
        "data",
        "uri"
      );
      
      await carbonCredit.connect(verifier).verifyCarbonCredit(0, "VCS");
      
      const price = ethers.utils.parseEther("1");
      const duration = 7 * 24 * 60 * 60;
      await carbonCredit.connect(farmer).listCreditForSale(0, price, duration);

      // Buy credit
      await expect(
        carbonCredit.connect(buyer).buyCarbonCredit(0, { value: price })
      ).to.emit(carbonCredit, "CreditSold")
       .withArgs(0, farmer.address, buyer.address, price);

      // Check ownership transfer
      expect(await carbonCredit.ownerOf(0)).to.equal(buyer.address);
      
      // Check pending withdrawals
      expect(await carbonCredit.pendingWithdrawals(farmer.address)).to.equal(price);
    });

    it("Should allow withdrawal of sale proceeds", async function () {
      const { carbonCredit, farmer, verifier, buyer } = await loadFixture(deployCarbonCreditFixture);
      
      // Setup and complete sale
      await carbonCredit.mintCarbonCredit(
        farmer.address,
        "PROJ001",
        ethers.utils.parseUnits("100", 4),
        2023,
        "Location",
        "VM0042",
        Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60),
        "data",
        "uri"
      );
      
      await carbonCredit.connect(verifier).verifyCarbonCredit(0, "VCS");
      
      const price = ethers.utils.parseEther("1");
      await carbonCredit.connect(farmer).listCreditForSale(0, price, 7 * 24 * 60 * 60);
      await carbonCredit.connect(buyer).buyCarbonCredit(0, { value: price });

      // Withdraw proceeds
      const initialBalance = await farmer.getBalance();
      await carbonCredit.connect(farmer).withdraw();
      const finalBalance = await farmer.getBalance();

      expect(finalBalance).to.be.gt(initialBalance);
      expect(await carbonCredit.pendingWithdrawals(farmer.address)).to.equal(0);
    });
  });

  describe("Retirement", function () {
    it("Should retire carbon credit successfully", async function () {
      const { carbonCredit, farmer, verifier } = await loadFixture(deployCarbonCreditFixture);
      
      // Mint and verify credit
      await carbonCredit.mintCarbonCredit(
        farmer.address,
        "PROJ001",
        ethers.utils.parseUnits("100", 4),
        2023,
        "Location",
        "VM0042",
        Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60),
        "data",
        "uri"
      );
      
      await carbonCredit.connect(verifier).verifyCarbonCredit(0, "VCS");

      // Retire credit
      const reason = "Corporate offset program";
      await expect(
        carbonCredit.connect(farmer).retireCarbonCredit(0, reason)
      ).to.emit(carbonCredit, "CreditRetired")
       .withArgs(0, farmer.address, reason);

      // Check retirement status
      const metadata = await carbonCredit.creditMetadata(0);
      expect(metadata.isRetired).to.be.true;

      // Token should be burned
      await expect(carbonCredit.ownerOf(0)).to.be.revertedWith("ERC721:");
    });

    it("Should fail retirement if not owner", async function () {
      const { carbonCredit, farmer, verifier, otherAccount } = await loadFixture(deployCarbonCreditFixture);
      
      await carbonCredit.mintCarbonCredit(
        farmer.address,
        "PROJ001",
        ethers.utils.parseUnits("100", 4),
        2023,
        "Location",
        "VM0042",
        Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60),
        "data",
        "uri"
      );
      
      await carbonCredit.connect(verifier).verifyCarbonCredit(0, "VCS");

      await expect(
        carbonCredit.connect(otherAccount).retireCarbonCredit(0, "reason")
      ).to.be.revertedWith("Not the owner");
    });
  });

  describe("Transfer Restrictions", function () {
    it("Should prevent transfer of unverified credit", async function () {
      const { carbonCredit, farmer, buyer } = await loadFixture(deployCarbonCreditFixture);
      
      await carbonCredit.mintCarbonCredit(
        farmer.address,
        "PROJ001",
        ethers.utils.parseUnits("100", 4),
        2023,
        "Location",
        "VM0042",
        Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60),
        "data",
        "uri"
      );

      await expect(
        carbonCredit.connect(farmer).transferFrom(farmer.address, buyer.address, 0)
      ).to.be.revertedWith("Token not transferable");
    });

    it("Should allow transfer of verified credit", async function () {
      const { carbonCredit, farmer, verifier, buyer } = await loadFixture(deployCarbonCreditFixture);
      
      await carbonCredit.mintCarbonCredit(
        farmer.address,
        "PROJ001",
        ethers.utils.parseUnits("100", 4),
        2023,
        "Location",
        "VM0042",
        Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60),
        "data",
        "uri"
      );
      
      await carbonCredit.connect(verifier).verifyCarbonCredit(0, "VCS");

      await carbonCredit.connect(farmer).transferFrom(farmer.address, buyer.address, 0);
      expect(await carbonCredit.ownerOf(0)).to.equal(buyer.address);
    });
  });

  describe("Utility Functions", function () {
    it("Should return farmer's credits", async function () {
      const { carbonCredit, farmer } = await loadFixture(deployCarbonCreditFixture);
      
      // Mint multiple credits
      for (let i = 0; i < 3; i++) {
        await carbonCredit.mintCarbonCredit(
          farmer.address,
          `PROJ00${i + 1}`,
          ethers.utils.parseUnits("100", 4),
          2023,
          "Location",
          "VM0042",
          Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60),
          "data",
          `uri${i}`
        );
      }

      const farmerCredits = await carbonCredit.getFarmerCredits(farmer.address);
      expect(farmerCredits.length).to.equal(3);
      expect(farmerCredits[0]).to.equal(0);
      expect(farmerCredits[1]).to.equal(1);
      expect(farmerCredits[2]).to.equal(2);
    });

    it("Should return project's credits", async function () {
      const { carbonCredit, farmer, otherAccount } = await loadFixture(deployCarbonCreditFixture);
      
      const projectId = "PROJ001";
      
      // Mint credits for same project
      await carbonCredit.mintCarbonCredit(
        farmer.address,
        projectId,
        ethers.utils.parseUnits("100", 4),
        2023,
        "Location",
        "VM0042",
        Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60),
        "data",
        "uri1"
      );
      
      await carbonCredit.mintCarbonCredit(
        otherAccount.address,
        projectId,
        ethers.utils.parseUnits("200", 4),
        2023,
        "Location",
        "VM0042",
        Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60),
        "data",
        "uri2"
      );

      const projectCredits = await carbonCredit.getProjectCredits(projectId);
      expect(projectCredits.length).to.equal(2);
    });

    it("Should check credit expiration", async function () {
      const { carbonCredit, farmer } = await loadFixture(deployCarbonCreditFixture);
      
      // Mint expired credit
      const pastDate = Math.floor(Date.now() / 1000) - (24 * 60 * 60); // 1 day ago
      await carbonCredit.mintCarbonCredit(
        farmer.address,
        "PROJ001",
        ethers.utils.parseUnits("100", 4),
        2023,
        "Location",
        "VM0042",
        pastDate,
        "data",
        "uri"
      );

      expect(await carbonCredit.isCreditExpired(0)).to.be.true;
    });
  });

  describe("Access Control", function () {
    it("Should allow admin to grant roles", async function () {
      const { carbonCredit, owner, otherAccount, MINTER_ROLE } = await loadFixture(deployCarbonCreditFixture);
      
      await carbonCredit.connect(owner).grantRole(MINTER_ROLE, otherAccount.address);
      expect(await carbonCredit.hasRole(MINTER_ROLE, otherAccount.address)).to.be.true;
    });

    it("Should allow admin to revoke roles", async function () {
      const { carbonCredit, owner, otherAccount, MINTER_ROLE } = await loadFixture(deployCarbonCreditFixture);
      
      await carbonCredit.connect(owner).grantRole(MINTER_ROLE, otherAccount.address);
      await carbonCredit.connect(owner).revokeRole(MINTER_ROLE, otherAccount.address);
      expect(await carbonCredit.hasRole(MINTER_ROLE, otherAccount.address)).to.be.false;
    });

    it("Should allow admin to pause contract", async function () {
      const { carbonCredit, owner, farmer } = await loadFixture(deployCarbonCreditFixture);
      
      await carbonCredit.connect(owner).pause();
      
      await expect(
        carbonCredit.mintCarbonCredit(
          farmer.address,
          "PROJ001",
          ethers.utils.parseUnits("100", 4),
          2023,
          "Location",
          "VM0042",
          Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60),
          "data",
          "uri"
        )
      ).to.be.revertedWith("Pausable: paused");
    });
  });
});
