const Blockchain = require('./index');
const Block = require('./block');
const { cryptoHash } = require('../util');
const Wallet = require('../wallet');
const Transaction = require('../wallet/transaction');

describe('Blockchain', () => {
  let blockchain, newChain, originalChain, errorMock;

  // Reset instance for each tes that follows the previous
  beforeEach(() => {
    blockchain = new Blockchain();
    newChain = new Blockchain();
    errorMock = jest.fn();

    originalChain = blockchain.chain;
    global.console.error = errorMock;
  });

  it('contains a `chain` Array instance', () => {
    expect(blockchain.chain instanceof Array).toBe(true);
  });
    // Blockchain begins with Genesis block
  it('starts a with the genesis block', () => {
    expect(blockchain.chain[0]).toEqual(Block.genesis());
  });

  //Blockchain has ability to add a block to the chain
  it('adds a new block to the chain', () => {
    const newData = 'foo bar';
    blockchain.addBlock({ data: newData });

    // last block - find most recent block - accessing item at last position in array and look at it's data field to see value of data
    expect(blockchain.chain[blockchain.chain.length-1].data).toEqual(newData);
  });

  // Validate Chain - if validation is false
  describe('isValidChain()', () => {
    describe('when the chain does not start with the genesis block', () => {
      it('returns false', () => {
        blockchain.chain[0] = { data: 'fake-genesis' };

        expect(Blockchain.isValidChain(blockchain.chain)).toBe(false);
      });
    });

    // Chain starts with gen block, has nultple blocks but lasthash is invalid
    describe('when the chain does start with the genesis block and has multiple blocks', () => {
      beforeEach(() => {
        blockchain.addBlock({ data: 'Bears' });
        blockchain.addBlock({ data: 'Beets' });
        blockchain.addBlock({ data: 'Battlestar Galactica' });
      });

      describe('and a lastHash reference has changed', () => {
        it('returns false', () => {
          // change lasthash reference of one item - change it
          blockchain.chain[2].lastHash = 'broken-lastHash';

          expect(Blockchain.isValidChain(blockchain.chain)).toBe(false);
        });
      });

      // hash is invalid
      describe('and the chain contains a block with an invalid field', () => {
        it('returns false', () => {

          blockchain.chain[2].data = 'wrong-data';

          expect(Blockchain.isValidChain(blockchain.chain)).toBe(false);
        });
      });

      // Preventing a jumped difficulty rate
      describe('and the chain contains a blcok with a jumped difficulty', () => {
        it('returns false', () => {
          const lastBlock = blockchain.chain[blockchain.chain.length-1];
          const lastHash = lastBlock.hash;
          const timestamp = Date.now();
          const nonce = 0;
          const data = [];
          const difficulty = lastBlock.difficulty - 3;

          const hash = cryptoHash(timestamp, lastHash, difficulty, nonce, data);

          const badBlock = new Block({ 
            timestamp, lastHash, hash, nonce, difficulty, data 
          });

          blockchain.chain.push(badBlock);

          expect(Blockchain.isValidChain(blockchain.chain)).toBe(false);
        });
      });
      

      describe('and the chain does not contain any valid blocks', () => {
        it('returns true', () => {

          expect(Blockchain.isValidChain(blockchain.chain)).toBe(true);
        });
      });
    });
  });

  // Chain Replacement - do not replace chain if incoming one is NOT longer
  describe('replaceChain', () => {
    let logMock;

    beforeEach(() => {
      logMock = jest.fn();

      global.console.log = logMock;
    });

    describe('when the new chain is not longer', () => {
      beforeEach(() => {
        newChain.chain[0] = { new: 'chain' }

        blockchain.replaceChain(newChain.chain);
      });

      it('does not replace the chain', () => {
        expect(blockchain.chain).toEqual(originalChain);
      });

      it('logs and error', () => {
        expect(errorMock).toHaveBeenCalled();
      });
    });

    describe('when the new chain is longer', () => {
      beforeEach(() => {
        newChain.addBlock({ data: 'Bears' });
        newChain.addBlock({ data: 'Beets' });
        newChain.addBlock({ data: 'Battlestar Galactica' });
      });
      
      describe('and the chain is invalid', () => {
        beforeEach(() => {
          newChain.chain[2].hash = 'some-fake-hash';

          blockchain.replaceChain(newChain.chain);
        });

        it('does not replace the chain', () => {
          newChain.chain[2].hash = 'some-fake-hash';

          blockchain.replaceChain(newChain.chain);

          expect(blockchain.chain).toEqual(originalChain);
        });

        it('logs and error', () => {
          expect(errorMock).toHaveBeenCalled();
        });
      });
      
      describe('and the chain is valid', () => {
        beforeEach(() => {
          blockchain.replaceChain(newChain.chain);
        });
        it('replaces the chain', () => {
          expect(blockchain.chain).toEqual(newChain.chain);
        });

        it('logs about the chain replacement', () => {
          expect(logMock).toHaveBeenCalled();
        });
      });
    });

    describe('and the `validateTransactions` flag is true', () => {
      it('calls validTransactionData()', () => {
        const validTransactionDataMock = jest.fn();

        newChain.addBlock({ data: 'foo' });
        blockchain.validTransactionData = validTransactionDataMock;

        blockchain.replaceChain(newChain.chain, true);

        expect(validTransactionDataMock).toHaveBeenCalled();
      });
    });
  });

  // Validate Transaction Data
  describe('validTransactionData()', () => {
    let transaction, rewardTransaction, wallet;

    beforeEach(() => {
      wallet = new Wallet();
      transaction = wallet.createTransaction({ recipient: 'foo-address', amount: 65 });
      rewardTransaction = Transaction.rewardTransaction({ minerWallet: wallet });
    });

    describe('and the transaction data is valid', () => {
      it('returns true', () => {
        newChain.addBlock({ data: [transaction, rewardTransaction] })
        
        expect(blockchain.validTransactionData({ chain: newChain.chain }))
          .toBe(true);
        expect(errorMock).not.toHaveBeenCalled();
      });
    });
    // invalid data - multiple rewards
    describe('and the transaction data has multiple rewards', () => {
      it('returns false and logs an error', () => {
        newChain.addBlock({ data: [transaction, rewardTransaction, rewardTransaction] });

        expect(blockchain.validTransactionData({ chain: newChain.chain }))
          .toBe(false);
        expect(errorMock).toHaveBeenCalled();
      });
    });

    // invalid data - >1 malformed outputmap
    describe('and the transaction data has at least one malformed outputMap', () => {
      describe('and the transaction is not a reward transaction', () => {
        it('returns false and logs an error', () => {
          transaction.outputMap[wallet.publicKey] = 999999;

          newChain.addBlock({ data: [transaction, rewardTransaction] });

          expect(blockchain.validTransactionData({ chain: newChain.chain }))
            .toBe(false);
          expect(errorMock).toHaveBeenCalled();
        });
      });

      describe('and the transaction is a reward transaction', () => {
        it('returns false and logs an error', () => {
          rewardTransaction.outputMap[wallet.publicKey] = 999999;

          newChain.addBlock({ data: [transaction, rewardTransaction] });

          expect(blockchain.validTransactionData({ chain: newChain.chain }))
            .toBe(false);
          expect(errorMock).toHaveBeenCalled();
        });
      });
    });

    // invalid data - input (balance) is too high
    describe('and the transaction data has at least one malformed input', () => {
      it('returns false and logs an error', () => {
        wallet.balance = 9000;

        const evilOutputMap = {
          [wallet.publicKey]: 8900,
          fooRecipient: 100
        };

        const evilTransaction = {
          input: {
            timestamp: Date.now(),
            amount: wallet.balance,
            address: wallet.publicKey,
            signature: wallet.sign(evilOutputMap)
          },
          outputMap: evilOutputMap
        }

        newChain.addBlock({ data: [evilTransaction, rewardTransaction] });
        expect(blockchain.validTransactionData({ chain: newChain.chain }))
          .toBe(false);
        expect(errorMock).toHaveBeenCalled();
      });
    });

    // invalid data - block does not contain multiple, identical txn's
    describe('and a block contains multiple identical txn/s', () => {
      it('returns false and logs an error', () => {
        newChain.addBlock({
          data: [transaction, transaction, transaction, rewardTransaction]
        });
        expect(blockchain.validTransactionData({ chain: newChain.chain }))
          .toBe(false);
        expect(errorMock).toHaveBeenCalled();
      });
    });
  });
});