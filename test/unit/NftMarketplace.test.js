const { TransactionOrderForkEvent } = require("@ethersproject/abstract-provider")
const { assert, expect } = require("chai")
const { network, deployments, ethers, getNamedAccounts } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Nft Marketplace Tests", function () {
          let nftMarketPlace, basicNft, deployer, player
          const PRICE = ethers.utils.parseEther("0.1")
          const TOKEN_ID = 0

          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer
              //player = (await getNamedAccounts()).player
              const accounts = await ethers.getSigners()
              player = accounts[1]
              await deployments.fixture(["all"])
              nftMarketPlace = await ethers.getContract("NftMarketplace")
              basicNft = await ethers.getContract("BasicNft")
              //mint nft - deployer is minting and approving
              await basicNft.mintNft()
              await basicNft.approve(nftMarketPlace.address, TOKEN_ID)
          })

          describe("listItem", function () {
              it("emits an event after listing an item", async function () {
                  expect(await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE)).to.emit(
                      "ItemListed"
                  )
              })

              it("emits an AlreadyListed event, if NFT is alreadt listed", async function () {
                  //list nft first
                  await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  //get event message - string
                  const error = `AlreadyListed("${basicNft.address}", ${TOKEN_ID})`
                  await expect(
                      nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith(error)
              })

              it("exclusively allows owner to list", async function () {
                  //connect player to marketplace
                  const nftMarketplaceContract = nftMarketPlace.connect(player)
                  await basicNft.approve(player.address, TOKEN_ID)
                  await expect(
                      nftMarketplaceContract.listItem(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("NftMarketplace___NotOwner")
              })

              it("needs approval to list item", async function () {
                  await basicNft.approve(ethers.constants.AddressZero, TOKEN_ID)
                  await expect(
                      nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("NftMarketplace__NotApprovedForMarketplace")
              })

              it("updates listing with seller and price", async function () {
                  //list item
                  await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE)

                  //get item
                  const listing = await nftMarketPlace.getListing(basicNft.address, TOKEN_ID)
                  assert(listing.seller == deployer)
                  assert(listing.price.toString() == PRICE.toString())
              })
          })

          //can be deleted later
          //   it("lists and can be bought", async function () {
          //       //list nft
          //       await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE)
          //       //connect player
          //       const playerConnectedNftMarketPlace = nftMarketPlace.connect(player)
          //       //buy nft
          //       await playerConnectedNftMarketPlace.buyItem(basicNft.address, TOKEN_ID, {
          //           value: PRICE,
          //       })

          //       const newOwner = await basicNft.ownerOf(TOKEN_ID)
          //       const deployerProceeds = await nftMarketPlace.getProceeds(deployer)
          //       assert(newOwner.toString() == player.address)
          //       assert(deployerProceeds.toString() == PRICE.toString())
          //   })
      })
