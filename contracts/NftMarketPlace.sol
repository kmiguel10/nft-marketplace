// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

error NftMarketplace__PriceMustBeAboveZero();
error NftMarketplace__NotApprovedForMarketplace();
error NftMarketplace_AlreadyListed(address nftAddress, uint256 tokenId);
error NftMarketplace___NotOwner();

contract NftMarketplace {
    struct Listing {
        uint256 price;
        address seller;
    }

    event ItemListed(
        address indexed seller,
        address indexed nftAddress,
        uint256 tokenId,
        uint256 price
    );

    //NFT Contract Address => (NFT tokenId => Listing )
    mapping(address => mapping(uint256 => Listing)) private s_listings;

    /**Modifiers */

    //checks if nft is not already lister
    modifier notListed(
        address nftAddress,
        uint256 tokenId,
        address owner
    ) {
        Listing memory listing = s_listings[nftAddress][tokenId];
        if (listing.price > 0) {
            revert NftMarketplace_AlreadyListed(nftAddress, tokenId);
        }
        _;
    }

    //check if the nft being listed is owned by msg.sender
    modifier isOwner(
        address nftAddress,
        uint256 tokenId,
        address spender
    ) {
        IERC721 nft = IERC721(nftAddress);
        address owner = nft.ownerOf(tokenId);
        if (spender != owner) {
            revert NftMarketplace___NotOwner();
        }
        _;
    }

    /** Main Functions */
    /**
    @notice Method for listing your NFT on the marketplace
    @param nftAddress: Address of the NFT
    @param tokenId: tokenId of the NFT
    @param price: sale price of the listed NFT
    @dev Technically, we could have the contract be the escrow of the NFTs but this way people can still hold their NFTs when listed
     */
    function listItem(
        address nftAddress,
        uint256 tokenId,
        uint256 price
    ) external notListed(nftAddress, tokenId, msg.sender) isOwner(nftAddress, tokenId, msg.sender) {
        //check price
        if (price <= 0) {
            revert NftMarketplace__PriceMustBeAboveZero();
        }

        //Owners can still hold their NFTs, and give the marketplace approval to sell the nft for them
        //to get approval we need to call getApproved() from the NFT
        IERC721 nft = IERC721(nftAddress);
        if (nft.getApproved(tokenId) != address(this)) {
            revert NftMarketplace__NotApprovedForMarketplace();
        }

        s_listings[nftAddress][tokenId] = Listing(price, msg.sender);
        emit ItemListed(msg.sender, nftAddress, tokenId, price);
    }
}

// a. `listItem` : List NFTs on the marketplace
// b. `buyItem` : Buy NFTs
// c. `cancelItem` : Cancel a listing
// d. `updateListing` : Update Price
// e. `withdrawProceeds` : withdraw payment for bought NFTs
