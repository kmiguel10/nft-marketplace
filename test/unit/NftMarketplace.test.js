const { TransactionOrderForkEvent } = require("@ethersproject/abstract-provider")
const { assert, expect } = require("chai")
const { network, deployments, ethers, getNamedAccounts, userConfig } = require("hardhat")
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
          //Test 3 things here:
          // revert NotListed
          //rever NotOwner
          //emits ItemCancelled event
          describe("cancelListing", function () {
              it("reverts if there is no listing", async function () {
                  //get the error
                  const error = `NftMarketplace__NotListed("${basicNft.address}", ${TOKEN_ID})`
                  //attempt to cancel without listing item
                  await expect(
                      nftMarketPlace.cancelListing(basicNft.address, TOKEN_ID)
                  ).to.be.revertedWith(error)
              })

              it("reverts if anyone but the owner tries to cancel", async function () {
                  //add item to listing
                  await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE)

                  //change to a different user
                  const nftMarketplaceContract = nftMarketPlace.connect(player)
                  const error = `NftMarketplace___NotOwner()`

                  //attempt to cancel
                  await expect(
                      nftMarketplaceContract.cancelListing(basicNft.address, TOKEN_ID)
                  ).to.be.revertedWith(error)
              })

              it("emits event and removes listing", async function () {
                  //add item to listing
                  await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  //remove listing
                  expect(await nftMarketPlace.cancelListing(basicNft.address, TOKEN_ID)).to.emit(
                      "ItemCanceled"
                  )

                  //get listing
                  const listing = await nftMarketPlace.getListing(basicNft.address, TOKEN_ID)
                  assert(listing.price.toString() == "0")
              })
          })
          //test
          //revert if attempting to but item thats not listed ✅
          //revert if attempting to buy with not enough eth ✅
          //emit event after buying ✅
          describe("buyItem", function () {
              it("reverts if there is no item to buy", async function () {
                  //buy without listing
                  await expect(
                      nftMarketPlace.buyItem(basicNft.address, TOKEN_ID)
                  ).to.be.revertedWith("NftMarketplace__NotListed")
              })

              it("reverts if payment is not enough", async function () {
                  //payment - less than PRICE
                  const payment = ethers.utils.parseEther("0.08")
                  //list item
                  await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  //buy item with payment less then price
                  //expect revert
                  await expect(nftMarketPlace.buyItem(basicNft.address, TOKEN_ID), {
                      value: payment,
                  }).to.be.revertedWith("NftMarketplace__PriceNotMet")
              })

              it("emits event after buying NFT", async function () {
                  //list nft
                  await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  //connect buyer
                  const buyerNftMarketPlaceContract = nftMarketPlace.connect(player)
                  //buy nft
                  //check for event
                  expect(
                      await buyerNftMarketPlaceContract.buyItem(basicNft.address, TOKEN_ID, {
                          value: PRICE,
                      })
                  ).to.emit("ItemBought")
              })

              it("checks for owner of new nft and proceeds is transferred to the seller", async function () {
                  await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  const buyerNftMarketPlaceContract = nftMarketPlace.connect(player)
                  await buyerNftMarketPlaceContract.buyItem(basicNft.address, TOKEN_ID, {
                      value: PRICE,
                  })
                  const owner = await basicNft.ownerOf(TOKEN_ID)
                  const deployerProceeds = await nftMarketPlace.getProceeds(deployer)
                  assert(owner.toString() == player.address)
                  assert(deployerProceeds.toString() == PRICE.toString())
              })
          })

          //test the following
          //revert if the person updating is not the owner of the NFT ✅
          //revert if updating a nonexisten nft ✅
          //check for the new price ✅
          describe("updateListing", function () {
              it("revert if the user updating is not the owner of the nft", async function () {
                  //new price
                  const newPrice = ethers.utils.parseEther("0.2")
                  //list nft
                  await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  //connect to player
                  const nftMarketplaceContract = nftMarketPlace.connect(player)
                  //attempt to update
                  await expect(
                      nftMarketplaceContract.updateListing(basicNft.address, TOKEN_ID, newPrice)
                  ).to.be.revertedWith("NftMarketplace___NotOwner()")
              })

              it("revert if updating a nonexistent nft", async function () {
                  //check
                  //new price
                  const newPrice = ethers.utils.parseEther("0.2")
                  //   const error = `NftMarketplace__NotListed("${basicNft.address}",)`

                  await expect(
                      nftMarketPlace.updateListing(basicNft.address, TOKEN_ID, newPrice)
                  ).to.be.revertedWith("NftMarketplace__NotListed")
              })

              it("checks for event after updating item", async function () {
                  const newPrice = ethers.utils.parseEther("0.2")
                  //list item
                  await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  //update item
                  expect(
                      await nftMarketPlace.updateListing(basicNft.address, TOKEN_ID, newPrice)
                  ).to.emit("ItemListed")
              })

              it("checks the new price after updating nft", async function () {
                  const newPrice = ethers.utils.parseEther("0.2")
                  //list item
                  await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  //update item
                  await nftMarketPlace.updateListing(basicNft.address, TOKEN_ID, newPrice)
                  //get new price
                  const listing = await nftMarketPlace.getListing(basicNft.address, TOKEN_ID)

                  //check for event and new price
                  assert(listing.price.toString() == newPrice.toString())
              })
          })

          //test
          //revert if attemping to get 0 proceeds
          //revert if transfer failed
          //check for proceed -- successful withdrawal
          describe("withdrawProceeds", function () {
              it("reverts if attempting to withdraw 0 proceeds", async function () {
                  await expect(nftMarketPlace.withdrawProceeds()).to.be.revertedWith(
                      "NftMarketplace__NoProceeds()"
                  )
              })

              //   it("successfully withdrawn proceeds", async function () {
              //       //list nft
              //       await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE)
              //       //buy nft - player
              //       const buyerContract = nftMarketPlace.connect(player)
              //       await buyerContract.buyItem(basicNft.address, TOKEN_ID, { value: PRICE })
              //       nftMarketPlace = buyerContract.connect(deployer)
              //       //withdraw proceeds
              //       await nftMarketPlace.withdrawProceeds()
              //       //check for proceed - provider
              //       const sellerProceeds = await nftMarketPlace.getProceeds(deployer)

              //       const ownerBalance = await deployer.getBalance()

              //       console.log(ownerBalance)

              //       //assert(sellerProceeds.toString() == PRICE.toString())
              //   })
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
