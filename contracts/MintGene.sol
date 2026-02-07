// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MintGene is ERC721, Ownable {
    
    struct Trait {
        string name;
        string description;
    }

    // Mapping from token ID to Traits
    mapping(uint256 => Trait[]) public tokenTraits;
    uint256 public nextTokenId;

    constructor() ERC721("MintGene", "MINT") {}

    function mint() external onlyOwner {
        uint256 tokenId = nextTokenId;
        nextTokenId++;
        _safeMint(msg.sender, tokenId);
    }

    function setTraits(uint256 tokenId, Trait[] memory traits) external onlyOwner {
        require(_exists(tokenId), "Token does not exist");
        tokenTraits[tokenId] = traits;
    }

    function fuseTraits(uint256 tokenId1, uint256 tokenId2) external {
        require(_exists(tokenId1) && _exists(tokenId2), "Token does not exist");

        Trait[] memory traits1 = tokenTraits[tokenId1];
        Trait[] memory traits2 = tokenTraits[tokenId2];

        Trait[] memory fusedTraits = new Trait[](traits1.length + traits2.length);
        
        for (uint256 i = 0; i < traits1.length; i++) {
            fusedTraits[i] = traits1[i];
        }
        for (uint256 i = 0; i < traits2.length; i++) {
            fusedTraits[traits1.length + i] = traits2[i];
        }

        tokenTraits[tokenId1] = fusedTraits; // Fusing into the first token
        _burn(tokenId2); // Burn the second token as it's fused into the first
    }
}