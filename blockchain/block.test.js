const hexToBinary = require('hex-to-binary');
const Block = require('./block');
const { GENESIS_DATA, MINE_RATE } = require('../config');
const { cryptoHash } = require('../util');

describe('Block', () => {
  const timestamp = 2000;
  const lastHash = 'foo-hash';
  const hash = 'bar-hash';
  const data = ['blockchain', 'data'];
  const nonce = 1;
  const difficulty  = 1;
  const block = new Block({
    timestamp, lastHash, hash, nonce, difficulty
  });

  // First Test - Ensure block has all variables above
  it('has a timestamp, lastHash, hash, and data property', () => {
    expect(block.timestamp).toEqual(timestamp);
    expect(block.lastHash).toEqual(lastHash);
    expect(block.hash).toEqual(hash);
    // expect(block.data).toEqual(data);
    expect(block.nonce).toEqual(nonce);
    expect(block.difficulty).toEqual(difficulty);
  });

  // Genesis Function
  describe('genesis()', () => {
    const genesisBlock = Block.genesis();

    it('returns a Block instance', () => {
      expect(genesisBlock instanceof Block).toBe(true);
    });

    it('returns the genesis data', () => {
      expect(genesisBlock).toEqual(GENESIS_DATA);
    });
  });

  describe('mineBlock()', () => {
    const lastBlock = Block.genesis();
    const data = 'minded data';
    const minedBlock = Block.mineBlock({ lastBlock, data });

    it('returns a Block instance', () => {
      expect(minedBlock instanceof Block).toBe(true);
    });

    it('sets the `lastHash` to be the `hash` of the lastBlock', () => {
      expect(minedBlock.lastHash).toEqual(lastBlock.hash);
    });

    it('sets the `data`', () => {
      expect(minedBlock.data).toEqual(data);
    });

    it('sets a `timestamp`', () => {
      // Is defined
      expect(minedBlock.timestamp).not.toEqual(undefined);
    });

    // Hash in MineBlock
    // Add nonce and difficulty variables
    it('creates a SHA-256 `hash` based on proper inputs', () => {
      expect(minedBlock.hash)
        .toEqual(
          cryptoHash(
            minedBlock.timestamp, 
            minedBlock.nonce, 
            minedBlock.difficulty, 
            lastBlock.hash, 
            data
      ));
    });

    // Checks if sets hash that meets the difficulty criteria
    // A substring from 0 to the minedblock.difficulty is equal to the zeros of that difficulty itself.
    it('sets a `hash` that matches the diff. criteria', () => {
      expect
        (hexToBinary(minedBlock.hash).substring(0, minedBlock.difficulty))
          .toEqual('0'.repeat(minedBlock.difficulty));
    });

    it('adjusts the difficulty', () => {
      const possibleResults = [lastBlock.difficulty+1, lastBlock.difficulty-1];

      expect(possibleResults.includes(minedBlock.difficulty)).toBe(true);
    });
  });

  describe('adjustDifficulty', () => {
    it('raises the difficulty for the quickly mined block', () => {
      expect(Block.adjustDifficulty({ 
        originalBlock: block, timestamp: block.timestamp + MINE_RATE - 100 
      })).toEqual(block.difficulty+1);
    });

    it('lowers the difficulty for the slowly mined block', () => {
      expect(Block.adjustDifficulty({
        originalBlock: block, timestamp: block.timestamp + MINE_RATE + 100
      })).toEqual(block.difficulty-1);
    });

    // Never have difficulty level go below 1
    it('has a lower limit of 1', () => {
      block.difficulty = -1;

      expect(Block.adjustDifficulty({ originalBlock: block })).toEqual(1);
    });
  });
});


