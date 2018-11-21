(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
;(function (root, factory, undef) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"), require("./enc-base64"), require("./md5"), require("./evpkdf"), require("./cipher-core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core", "./enc-base64", "./md5", "./evpkdf", "./cipher-core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	(function () {
	    // Shortcuts
	    var C = CryptoJS;
	    var C_lib = C.lib;
	    var BlockCipher = C_lib.BlockCipher;
	    var C_algo = C.algo;

	    // Lookup tables
	    var SBOX = [];
	    var INV_SBOX = [];
	    var SUB_MIX_0 = [];
	    var SUB_MIX_1 = [];
	    var SUB_MIX_2 = [];
	    var SUB_MIX_3 = [];
	    var INV_SUB_MIX_0 = [];
	    var INV_SUB_MIX_1 = [];
	    var INV_SUB_MIX_2 = [];
	    var INV_SUB_MIX_3 = [];

	    // Compute lookup tables
	    (function () {
	        // Compute double table
	        var d = [];
	        for (var i = 0; i < 256; i++) {
	            if (i < 128) {
	                d[i] = i << 1;
	            } else {
	                d[i] = (i << 1) ^ 0x11b;
	            }
	        }

	        // Walk GF(2^8)
	        var x = 0;
	        var xi = 0;
	        for (var i = 0; i < 256; i++) {
	            // Compute sbox
	            var sx = xi ^ (xi << 1) ^ (xi << 2) ^ (xi << 3) ^ (xi << 4);
	            sx = (sx >>> 8) ^ (sx & 0xff) ^ 0x63;
	            SBOX[x] = sx;
	            INV_SBOX[sx] = x;

	            // Compute multiplication
	            var x2 = d[x];
	            var x4 = d[x2];
	            var x8 = d[x4];

	            // Compute sub bytes, mix columns tables
	            var t = (d[sx] * 0x101) ^ (sx * 0x1010100);
	            SUB_MIX_0[x] = (t << 24) | (t >>> 8);
	            SUB_MIX_1[x] = (t << 16) | (t >>> 16);
	            SUB_MIX_2[x] = (t << 8)  | (t >>> 24);
	            SUB_MIX_3[x] = t;

	            // Compute inv sub bytes, inv mix columns tables
	            var t = (x8 * 0x1010101) ^ (x4 * 0x10001) ^ (x2 * 0x101) ^ (x * 0x1010100);
	            INV_SUB_MIX_0[sx] = (t << 24) | (t >>> 8);
	            INV_SUB_MIX_1[sx] = (t << 16) | (t >>> 16);
	            INV_SUB_MIX_2[sx] = (t << 8)  | (t >>> 24);
	            INV_SUB_MIX_3[sx] = t;

	            // Compute next counter
	            if (!x) {
	                x = xi = 1;
	            } else {
	                x = x2 ^ d[d[d[x8 ^ x2]]];
	                xi ^= d[d[xi]];
	            }
	        }
	    }());

	    // Precomputed Rcon lookup
	    var RCON = [0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

	    /**
	     * AES block cipher algorithm.
	     */
	    var AES = C_algo.AES = BlockCipher.extend({
	        _doReset: function () {
	            // Skip reset of nRounds has been set before and key did not change
	            if (this._nRounds && this._keyPriorReset === this._key) {
	                return;
	            }

	            // Shortcuts
	            var key = this._keyPriorReset = this._key;
	            var keyWords = key.words;
	            var keySize = key.sigBytes / 4;

	            // Compute number of rounds
	            var nRounds = this._nRounds = keySize + 6;

	            // Compute number of key schedule rows
	            var ksRows = (nRounds + 1) * 4;

	            // Compute key schedule
	            var keySchedule = this._keySchedule = [];
	            for (var ksRow = 0; ksRow < ksRows; ksRow++) {
	                if (ksRow < keySize) {
	                    keySchedule[ksRow] = keyWords[ksRow];
	                } else {
	                    var t = keySchedule[ksRow - 1];

	                    if (!(ksRow % keySize)) {
	                        // Rot word
	                        t = (t << 8) | (t >>> 24);

	                        // Sub word
	                        t = (SBOX[t >>> 24] << 24) | (SBOX[(t >>> 16) & 0xff] << 16) | (SBOX[(t >>> 8) & 0xff] << 8) | SBOX[t & 0xff];

	                        // Mix Rcon
	                        t ^= RCON[(ksRow / keySize) | 0] << 24;
	                    } else if (keySize > 6 && ksRow % keySize == 4) {
	                        // Sub word
	                        t = (SBOX[t >>> 24] << 24) | (SBOX[(t >>> 16) & 0xff] << 16) | (SBOX[(t >>> 8) & 0xff] << 8) | SBOX[t & 0xff];
	                    }

	                    keySchedule[ksRow] = keySchedule[ksRow - keySize] ^ t;
	                }
	            }

	            // Compute inv key schedule
	            var invKeySchedule = this._invKeySchedule = [];
	            for (var invKsRow = 0; invKsRow < ksRows; invKsRow++) {
	                var ksRow = ksRows - invKsRow;

	                if (invKsRow % 4) {
	                    var t = keySchedule[ksRow];
	                } else {
	                    var t = keySchedule[ksRow - 4];
	                }

	                if (invKsRow < 4 || ksRow <= 4) {
	                    invKeySchedule[invKsRow] = t;
	                } else {
	                    invKeySchedule[invKsRow] = INV_SUB_MIX_0[SBOX[t >>> 24]] ^ INV_SUB_MIX_1[SBOX[(t >>> 16) & 0xff]] ^
	                                               INV_SUB_MIX_2[SBOX[(t >>> 8) & 0xff]] ^ INV_SUB_MIX_3[SBOX[t & 0xff]];
	                }
	            }
	        },

	        encryptBlock: function (M, offset) {
	            this._doCryptBlock(M, offset, this._keySchedule, SUB_MIX_0, SUB_MIX_1, SUB_MIX_2, SUB_MIX_3, SBOX);
	        },

	        decryptBlock: function (M, offset) {
	            // Swap 2nd and 4th rows
	            var t = M[offset + 1];
	            M[offset + 1] = M[offset + 3];
	            M[offset + 3] = t;

	            this._doCryptBlock(M, offset, this._invKeySchedule, INV_SUB_MIX_0, INV_SUB_MIX_1, INV_SUB_MIX_2, INV_SUB_MIX_3, INV_SBOX);

	            // Inv swap 2nd and 4th rows
	            var t = M[offset + 1];
	            M[offset + 1] = M[offset + 3];
	            M[offset + 3] = t;
	        },

	        _doCryptBlock: function (M, offset, keySchedule, SUB_MIX_0, SUB_MIX_1, SUB_MIX_2, SUB_MIX_3, SBOX) {
	            // Shortcut
	            var nRounds = this._nRounds;

	            // Get input, add round key
	            var s0 = M[offset]     ^ keySchedule[0];
	            var s1 = M[offset + 1] ^ keySchedule[1];
	            var s2 = M[offset + 2] ^ keySchedule[2];
	            var s3 = M[offset + 3] ^ keySchedule[3];

	            // Key schedule row counter
	            var ksRow = 4;

	            // Rounds
	            for (var round = 1; round < nRounds; round++) {
	                // Shift rows, sub bytes, mix columns, add round key
	                var t0 = SUB_MIX_0[s0 >>> 24] ^ SUB_MIX_1[(s1 >>> 16) & 0xff] ^ SUB_MIX_2[(s2 >>> 8) & 0xff] ^ SUB_MIX_3[s3 & 0xff] ^ keySchedule[ksRow++];
	                var t1 = SUB_MIX_0[s1 >>> 24] ^ SUB_MIX_1[(s2 >>> 16) & 0xff] ^ SUB_MIX_2[(s3 >>> 8) & 0xff] ^ SUB_MIX_3[s0 & 0xff] ^ keySchedule[ksRow++];
	                var t2 = SUB_MIX_0[s2 >>> 24] ^ SUB_MIX_1[(s3 >>> 16) & 0xff] ^ SUB_MIX_2[(s0 >>> 8) & 0xff] ^ SUB_MIX_3[s1 & 0xff] ^ keySchedule[ksRow++];
	                var t3 = SUB_MIX_0[s3 >>> 24] ^ SUB_MIX_1[(s0 >>> 16) & 0xff] ^ SUB_MIX_2[(s1 >>> 8) & 0xff] ^ SUB_MIX_3[s2 & 0xff] ^ keySchedule[ksRow++];

	                // Update state
	                s0 = t0;
	                s1 = t1;
	                s2 = t2;
	                s3 = t3;
	            }

	            // Shift rows, sub bytes, add round key
	            var t0 = ((SBOX[s0 >>> 24] << 24) | (SBOX[(s1 >>> 16) & 0xff] << 16) | (SBOX[(s2 >>> 8) & 0xff] << 8) | SBOX[s3 & 0xff]) ^ keySchedule[ksRow++];
	            var t1 = ((SBOX[s1 >>> 24] << 24) | (SBOX[(s2 >>> 16) & 0xff] << 16) | (SBOX[(s3 >>> 8) & 0xff] << 8) | SBOX[s0 & 0xff]) ^ keySchedule[ksRow++];
	            var t2 = ((SBOX[s2 >>> 24] << 24) | (SBOX[(s3 >>> 16) & 0xff] << 16) | (SBOX[(s0 >>> 8) & 0xff] << 8) | SBOX[s1 & 0xff]) ^ keySchedule[ksRow++];
	            var t3 = ((SBOX[s3 >>> 24] << 24) | (SBOX[(s0 >>> 16) & 0xff] << 16) | (SBOX[(s1 >>> 8) & 0xff] << 8) | SBOX[s2 & 0xff]) ^ keySchedule[ksRow++];

	            // Set output
	            M[offset]     = t0;
	            M[offset + 1] = t1;
	            M[offset + 2] = t2;
	            M[offset + 3] = t3;
	        },

	        keySize: 256/32
	    });

	    /**
	     * Shortcut functions to the cipher's object interface.
	     *
	     * @example
	     *
	     *     var ciphertext = CryptoJS.AES.encrypt(message, key, cfg);
	     *     var plaintext  = CryptoJS.AES.decrypt(ciphertext, key, cfg);
	     */
	    C.AES = BlockCipher._createHelper(AES);
	}());


	return CryptoJS.AES;

}));
},{"./cipher-core":2,"./core":3,"./enc-base64":4,"./evpkdf":6,"./md5":11}],2:[function(require,module,exports){
;(function (root, factory, undef) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"), require("./evpkdf"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core", "./evpkdf"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	/**
	 * Cipher core components.
	 */
	CryptoJS.lib.Cipher || (function (undefined) {
	    // Shortcuts
	    var C = CryptoJS;
	    var C_lib = C.lib;
	    var Base = C_lib.Base;
	    var WordArray = C_lib.WordArray;
	    var BufferedBlockAlgorithm = C_lib.BufferedBlockAlgorithm;
	    var C_enc = C.enc;
	    var Utf8 = C_enc.Utf8;
	    var Base64 = C_enc.Base64;
	    var C_algo = C.algo;
	    var EvpKDF = C_algo.EvpKDF;

	    /**
	     * Abstract base cipher template.
	     *
	     * @property {number} keySize This cipher's key size. Default: 4 (128 bits)
	     * @property {number} ivSize This cipher's IV size. Default: 4 (128 bits)
	     * @property {number} _ENC_XFORM_MODE A constant representing encryption mode.
	     * @property {number} _DEC_XFORM_MODE A constant representing decryption mode.
	     */
	    var Cipher = C_lib.Cipher = BufferedBlockAlgorithm.extend({
	        /**
	         * Configuration options.
	         *
	         * @property {WordArray} iv The IV to use for this operation.
	         */
	        cfg: Base.extend(),

	        /**
	         * Creates this cipher in encryption mode.
	         *
	         * @param {WordArray} key The key.
	         * @param {Object} cfg (Optional) The configuration options to use for this operation.
	         *
	         * @return {Cipher} A cipher instance.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var cipher = CryptoJS.algo.AES.createEncryptor(keyWordArray, { iv: ivWordArray });
	         */
	        createEncryptor: function (key, cfg) {
	            return this.create(this._ENC_XFORM_MODE, key, cfg);
	        },

	        /**
	         * Creates this cipher in decryption mode.
	         *
	         * @param {WordArray} key The key.
	         * @param {Object} cfg (Optional) The configuration options to use for this operation.
	         *
	         * @return {Cipher} A cipher instance.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var cipher = CryptoJS.algo.AES.createDecryptor(keyWordArray, { iv: ivWordArray });
	         */
	        createDecryptor: function (key, cfg) {
	            return this.create(this._DEC_XFORM_MODE, key, cfg);
	        },

	        /**
	         * Initializes a newly created cipher.
	         *
	         * @param {number} xformMode Either the encryption or decryption transormation mode constant.
	         * @param {WordArray} key The key.
	         * @param {Object} cfg (Optional) The configuration options to use for this operation.
	         *
	         * @example
	         *
	         *     var cipher = CryptoJS.algo.AES.create(CryptoJS.algo.AES._ENC_XFORM_MODE, keyWordArray, { iv: ivWordArray });
	         */
	        init: function (xformMode, key, cfg) {
	            // Apply config defaults
	            this.cfg = this.cfg.extend(cfg);

	            // Store transform mode and key
	            this._xformMode = xformMode;
	            this._key = key;

	            // Set initial values
	            this.reset();
	        },

	        /**
	         * Resets this cipher to its initial state.
	         *
	         * @example
	         *
	         *     cipher.reset();
	         */
	        reset: function () {
	            // Reset data buffer
	            BufferedBlockAlgorithm.reset.call(this);

	            // Perform concrete-cipher logic
	            this._doReset();
	        },

	        /**
	         * Adds data to be encrypted or decrypted.
	         *
	         * @param {WordArray|string} dataUpdate The data to encrypt or decrypt.
	         *
	         * @return {WordArray} The data after processing.
	         *
	         * @example
	         *
	         *     var encrypted = cipher.process('data');
	         *     var encrypted = cipher.process(wordArray);
	         */
	        process: function (dataUpdate) {
	            // Append
	            this._append(dataUpdate);

	            // Process available blocks
	            return this._process();
	        },

	        /**
	         * Finalizes the encryption or decryption process.
	         * Note that the finalize operation is effectively a destructive, read-once operation.
	         *
	         * @param {WordArray|string} dataUpdate The final data to encrypt or decrypt.
	         *
	         * @return {WordArray} The data after final processing.
	         *
	         * @example
	         *
	         *     var encrypted = cipher.finalize();
	         *     var encrypted = cipher.finalize('data');
	         *     var encrypted = cipher.finalize(wordArray);
	         */
	        finalize: function (dataUpdate) {
	            // Final data update
	            if (dataUpdate) {
	                this._append(dataUpdate);
	            }

	            // Perform concrete-cipher logic
	            var finalProcessedData = this._doFinalize();

	            return finalProcessedData;
	        },

	        keySize: 128/32,

	        ivSize: 128/32,

	        _ENC_XFORM_MODE: 1,

	        _DEC_XFORM_MODE: 2,

	        /**
	         * Creates shortcut functions to a cipher's object interface.
	         *
	         * @param {Cipher} cipher The cipher to create a helper for.
	         *
	         * @return {Object} An object with encrypt and decrypt shortcut functions.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var AES = CryptoJS.lib.Cipher._createHelper(CryptoJS.algo.AES);
	         */
	        _createHelper: (function () {
	            function selectCipherStrategy(key) {
	                if (typeof key == 'string') {
	                    return PasswordBasedCipher;
	                } else {
	                    return SerializableCipher;
	                }
	            }

	            return function (cipher) {
	                return {
	                    encrypt: function (message, key, cfg) {
	                        return selectCipherStrategy(key).encrypt(cipher, message, key, cfg);
	                    },

	                    decrypt: function (ciphertext, key, cfg) {
	                        return selectCipherStrategy(key).decrypt(cipher, ciphertext, key, cfg);
	                    }
	                };
	            };
	        }())
	    });

	    /**
	     * Abstract base stream cipher template.
	     *
	     * @property {number} blockSize The number of 32-bit words this cipher operates on. Default: 1 (32 bits)
	     */
	    var StreamCipher = C_lib.StreamCipher = Cipher.extend({
	        _doFinalize: function () {
	            // Process partial blocks
	            var finalProcessedBlocks = this._process(!!'flush');

	            return finalProcessedBlocks;
	        },

	        blockSize: 1
	    });

	    /**
	     * Mode namespace.
	     */
	    var C_mode = C.mode = {};

	    /**
	     * Abstract base block cipher mode template.
	     */
	    var BlockCipherMode = C_lib.BlockCipherMode = Base.extend({
	        /**
	         * Creates this mode for encryption.
	         *
	         * @param {Cipher} cipher A block cipher instance.
	         * @param {Array} iv The IV words.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var mode = CryptoJS.mode.CBC.createEncryptor(cipher, iv.words);
	         */
	        createEncryptor: function (cipher, iv) {
	            return this.Encryptor.create(cipher, iv);
	        },

	        /**
	         * Creates this mode for decryption.
	         *
	         * @param {Cipher} cipher A block cipher instance.
	         * @param {Array} iv The IV words.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var mode = CryptoJS.mode.CBC.createDecryptor(cipher, iv.words);
	         */
	        createDecryptor: function (cipher, iv) {
	            return this.Decryptor.create(cipher, iv);
	        },

	        /**
	         * Initializes a newly created mode.
	         *
	         * @param {Cipher} cipher A block cipher instance.
	         * @param {Array} iv The IV words.
	         *
	         * @example
	         *
	         *     var mode = CryptoJS.mode.CBC.Encryptor.create(cipher, iv.words);
	         */
	        init: function (cipher, iv) {
	            this._cipher = cipher;
	            this._iv = iv;
	        }
	    });

	    /**
	     * Cipher Block Chaining mode.
	     */
	    var CBC = C_mode.CBC = (function () {
	        /**
	         * Abstract base CBC mode.
	         */
	        var CBC = BlockCipherMode.extend();

	        /**
	         * CBC encryptor.
	         */
	        CBC.Encryptor = CBC.extend({
	            /**
	             * Processes the data block at offset.
	             *
	             * @param {Array} words The data words to operate on.
	             * @param {number} offset The offset where the block starts.
	             *
	             * @example
	             *
	             *     mode.processBlock(data.words, offset);
	             */
	            processBlock: function (words, offset) {
	                // Shortcuts
	                var cipher = this._cipher;
	                var blockSize = cipher.blockSize;

	                // XOR and encrypt
	                xorBlock.call(this, words, offset, blockSize);
	                cipher.encryptBlock(words, offset);

	                // Remember this block to use with next block
	                this._prevBlock = words.slice(offset, offset + blockSize);
	            }
	        });

	        /**
	         * CBC decryptor.
	         */
	        CBC.Decryptor = CBC.extend({
	            /**
	             * Processes the data block at offset.
	             *
	             * @param {Array} words The data words to operate on.
	             * @param {number} offset The offset where the block starts.
	             *
	             * @example
	             *
	             *     mode.processBlock(data.words, offset);
	             */
	            processBlock: function (words, offset) {
	                // Shortcuts
	                var cipher = this._cipher;
	                var blockSize = cipher.blockSize;

	                // Remember this block to use with next block
	                var thisBlock = words.slice(offset, offset + blockSize);

	                // Decrypt and XOR
	                cipher.decryptBlock(words, offset);
	                xorBlock.call(this, words, offset, blockSize);

	                // This block becomes the previous block
	                this._prevBlock = thisBlock;
	            }
	        });

	        function xorBlock(words, offset, blockSize) {
	            // Shortcut
	            var iv = this._iv;

	            // Choose mixing block
	            if (iv) {
	                var block = iv;

	                // Remove IV for subsequent blocks
	                this._iv = undefined;
	            } else {
	                var block = this._prevBlock;
	            }

	            // XOR blocks
	            for (var i = 0; i < blockSize; i++) {
	                words[offset + i] ^= block[i];
	            }
	        }

	        return CBC;
	    }());

	    /**
	     * Padding namespace.
	     */
	    var C_pad = C.pad = {};

	    /**
	     * PKCS #5/7 padding strategy.
	     */
	    var Pkcs7 = C_pad.Pkcs7 = {
	        /**
	         * Pads data using the algorithm defined in PKCS #5/7.
	         *
	         * @param {WordArray} data The data to pad.
	         * @param {number} blockSize The multiple that the data should be padded to.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     CryptoJS.pad.Pkcs7.pad(wordArray, 4);
	         */
	        pad: function (data, blockSize) {
	            // Shortcut
	            var blockSizeBytes = blockSize * 4;

	            // Count padding bytes
	            var nPaddingBytes = blockSizeBytes - data.sigBytes % blockSizeBytes;

	            // Create padding word
	            var paddingWord = (nPaddingBytes << 24) | (nPaddingBytes << 16) | (nPaddingBytes << 8) | nPaddingBytes;

	            // Create padding
	            var paddingWords = [];
	            for (var i = 0; i < nPaddingBytes; i += 4) {
	                paddingWords.push(paddingWord);
	            }
	            var padding = WordArray.create(paddingWords, nPaddingBytes);

	            // Add padding
	            data.concat(padding);
	        },

	        /**
	         * Unpads data that had been padded using the algorithm defined in PKCS #5/7.
	         *
	         * @param {WordArray} data The data to unpad.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     CryptoJS.pad.Pkcs7.unpad(wordArray);
	         */
	        unpad: function (data) {
	            // Get number of padding bytes from last byte
	            var nPaddingBytes = data.words[(data.sigBytes - 1) >>> 2] & 0xff;

	            // Remove padding
	            data.sigBytes -= nPaddingBytes;
	        }
	    };

	    /**
	     * Abstract base block cipher template.
	     *
	     * @property {number} blockSize The number of 32-bit words this cipher operates on. Default: 4 (128 bits)
	     */
	    var BlockCipher = C_lib.BlockCipher = Cipher.extend({
	        /**
	         * Configuration options.
	         *
	         * @property {Mode} mode The block mode to use. Default: CBC
	         * @property {Padding} padding The padding strategy to use. Default: Pkcs7
	         */
	        cfg: Cipher.cfg.extend({
	            mode: CBC,
	            padding: Pkcs7
	        }),

	        reset: function () {
	            // Reset cipher
	            Cipher.reset.call(this);

	            // Shortcuts
	            var cfg = this.cfg;
	            var iv = cfg.iv;
	            var mode = cfg.mode;

	            // Reset block mode
	            if (this._xformMode == this._ENC_XFORM_MODE) {
	                var modeCreator = mode.createEncryptor;
	            } else /* if (this._xformMode == this._DEC_XFORM_MODE) */ {
	                var modeCreator = mode.createDecryptor;
	                // Keep at least one block in the buffer for unpadding
	                this._minBufferSize = 1;
	            }

	            if (this._mode && this._mode.__creator == modeCreator) {
	                this._mode.init(this, iv && iv.words);
	            } else {
	                this._mode = modeCreator.call(mode, this, iv && iv.words);
	                this._mode.__creator = modeCreator;
	            }
	        },

	        _doProcessBlock: function (words, offset) {
	            this._mode.processBlock(words, offset);
	        },

	        _doFinalize: function () {
	            // Shortcut
	            var padding = this.cfg.padding;

	            // Finalize
	            if (this._xformMode == this._ENC_XFORM_MODE) {
	                // Pad data
	                padding.pad(this._data, this.blockSize);

	                // Process final blocks
	                var finalProcessedBlocks = this._process(!!'flush');
	            } else /* if (this._xformMode == this._DEC_XFORM_MODE) */ {
	                // Process final blocks
	                var finalProcessedBlocks = this._process(!!'flush');

	                // Unpad data
	                padding.unpad(finalProcessedBlocks);
	            }

	            return finalProcessedBlocks;
	        },

	        blockSize: 128/32
	    });

	    /**
	     * A collection of cipher parameters.
	     *
	     * @property {WordArray} ciphertext The raw ciphertext.
	     * @property {WordArray} key The key to this ciphertext.
	     * @property {WordArray} iv The IV used in the ciphering operation.
	     * @property {WordArray} salt The salt used with a key derivation function.
	     * @property {Cipher} algorithm The cipher algorithm.
	     * @property {Mode} mode The block mode used in the ciphering operation.
	     * @property {Padding} padding The padding scheme used in the ciphering operation.
	     * @property {number} blockSize The block size of the cipher.
	     * @property {Format} formatter The default formatting strategy to convert this cipher params object to a string.
	     */
	    var CipherParams = C_lib.CipherParams = Base.extend({
	        /**
	         * Initializes a newly created cipher params object.
	         *
	         * @param {Object} cipherParams An object with any of the possible cipher parameters.
	         *
	         * @example
	         *
	         *     var cipherParams = CryptoJS.lib.CipherParams.create({
	         *         ciphertext: ciphertextWordArray,
	         *         key: keyWordArray,
	         *         iv: ivWordArray,
	         *         salt: saltWordArray,
	         *         algorithm: CryptoJS.algo.AES,
	         *         mode: CryptoJS.mode.CBC,
	         *         padding: CryptoJS.pad.PKCS7,
	         *         blockSize: 4,
	         *         formatter: CryptoJS.format.OpenSSL
	         *     });
	         */
	        init: function (cipherParams) {
	            this.mixIn(cipherParams);
	        },

	        /**
	         * Converts this cipher params object to a string.
	         *
	         * @param {Format} formatter (Optional) The formatting strategy to use.
	         *
	         * @return {string} The stringified cipher params.
	         *
	         * @throws Error If neither the formatter nor the default formatter is set.
	         *
	         * @example
	         *
	         *     var string = cipherParams + '';
	         *     var string = cipherParams.toString();
	         *     var string = cipherParams.toString(CryptoJS.format.OpenSSL);
	         */
	        toString: function (formatter) {
	            return (formatter || this.formatter).stringify(this);
	        }
	    });

	    /**
	     * Format namespace.
	     */
	    var C_format = C.format = {};

	    /**
	     * OpenSSL formatting strategy.
	     */
	    var OpenSSLFormatter = C_format.OpenSSL = {
	        /**
	         * Converts a cipher params object to an OpenSSL-compatible string.
	         *
	         * @param {CipherParams} cipherParams The cipher params object.
	         *
	         * @return {string} The OpenSSL-compatible string.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var openSSLString = CryptoJS.format.OpenSSL.stringify(cipherParams);
	         */
	        stringify: function (cipherParams) {
	            // Shortcuts
	            var ciphertext = cipherParams.ciphertext;
	            var salt = cipherParams.salt;

	            // Format
	            if (salt) {
	                var wordArray = WordArray.create([0x53616c74, 0x65645f5f]).concat(salt).concat(ciphertext);
	            } else {
	                var wordArray = ciphertext;
	            }

	            return wordArray.toString(Base64);
	        },

	        /**
	         * Converts an OpenSSL-compatible string to a cipher params object.
	         *
	         * @param {string} openSSLStr The OpenSSL-compatible string.
	         *
	         * @return {CipherParams} The cipher params object.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var cipherParams = CryptoJS.format.OpenSSL.parse(openSSLString);
	         */
	        parse: function (openSSLStr) {
	            // Parse base64
	            var ciphertext = Base64.parse(openSSLStr);

	            // Shortcut
	            var ciphertextWords = ciphertext.words;

	            // Test for salt
	            if (ciphertextWords[0] == 0x53616c74 && ciphertextWords[1] == 0x65645f5f) {
	                // Extract salt
	                var salt = WordArray.create(ciphertextWords.slice(2, 4));

	                // Remove salt from ciphertext
	                ciphertextWords.splice(0, 4);
	                ciphertext.sigBytes -= 16;
	            }

	            return CipherParams.create({ ciphertext: ciphertext, salt: salt });
	        }
	    };

	    /**
	     * A cipher wrapper that returns ciphertext as a serializable cipher params object.
	     */
	    var SerializableCipher = C_lib.SerializableCipher = Base.extend({
	        /**
	         * Configuration options.
	         *
	         * @property {Formatter} format The formatting strategy to convert cipher param objects to and from a string. Default: OpenSSL
	         */
	        cfg: Base.extend({
	            format: OpenSSLFormatter
	        }),

	        /**
	         * Encrypts a message.
	         *
	         * @param {Cipher} cipher The cipher algorithm to use.
	         * @param {WordArray|string} message The message to encrypt.
	         * @param {WordArray} key The key.
	         * @param {Object} cfg (Optional) The configuration options to use for this operation.
	         *
	         * @return {CipherParams} A cipher params object.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var ciphertextParams = CryptoJS.lib.SerializableCipher.encrypt(CryptoJS.algo.AES, message, key);
	         *     var ciphertextParams = CryptoJS.lib.SerializableCipher.encrypt(CryptoJS.algo.AES, message, key, { iv: iv });
	         *     var ciphertextParams = CryptoJS.lib.SerializableCipher.encrypt(CryptoJS.algo.AES, message, key, { iv: iv, format: CryptoJS.format.OpenSSL });
	         */
	        encrypt: function (cipher, message, key, cfg) {
	            // Apply config defaults
	            cfg = this.cfg.extend(cfg);

	            // Encrypt
	            var encryptor = cipher.createEncryptor(key, cfg);
	            var ciphertext = encryptor.finalize(message);

	            // Shortcut
	            var cipherCfg = encryptor.cfg;

	            // Create and return serializable cipher params
	            return CipherParams.create({
	                ciphertext: ciphertext,
	                key: key,
	                iv: cipherCfg.iv,
	                algorithm: cipher,
	                mode: cipherCfg.mode,
	                padding: cipherCfg.padding,
	                blockSize: cipher.blockSize,
	                formatter: cfg.format
	            });
	        },

	        /**
	         * Decrypts serialized ciphertext.
	         *
	         * @param {Cipher} cipher The cipher algorithm to use.
	         * @param {CipherParams|string} ciphertext The ciphertext to decrypt.
	         * @param {WordArray} key The key.
	         * @param {Object} cfg (Optional) The configuration options to use for this operation.
	         *
	         * @return {WordArray} The plaintext.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var plaintext = CryptoJS.lib.SerializableCipher.decrypt(CryptoJS.algo.AES, formattedCiphertext, key, { iv: iv, format: CryptoJS.format.OpenSSL });
	         *     var plaintext = CryptoJS.lib.SerializableCipher.decrypt(CryptoJS.algo.AES, ciphertextParams, key, { iv: iv, format: CryptoJS.format.OpenSSL });
	         */
	        decrypt: function (cipher, ciphertext, key, cfg) {
	            // Apply config defaults
	            cfg = this.cfg.extend(cfg);

	            // Convert string to CipherParams
	            ciphertext = this._parse(ciphertext, cfg.format);

	            // Decrypt
	            var plaintext = cipher.createDecryptor(key, cfg).finalize(ciphertext.ciphertext);

	            return plaintext;
	        },

	        /**
	         * Converts serialized ciphertext to CipherParams,
	         * else assumed CipherParams already and returns ciphertext unchanged.
	         *
	         * @param {CipherParams|string} ciphertext The ciphertext.
	         * @param {Formatter} format The formatting strategy to use to parse serialized ciphertext.
	         *
	         * @return {CipherParams} The unserialized ciphertext.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var ciphertextParams = CryptoJS.lib.SerializableCipher._parse(ciphertextStringOrParams, format);
	         */
	        _parse: function (ciphertext, format) {
	            if (typeof ciphertext == 'string') {
	                return format.parse(ciphertext, this);
	            } else {
	                return ciphertext;
	            }
	        }
	    });

	    /**
	     * Key derivation function namespace.
	     */
	    var C_kdf = C.kdf = {};

	    /**
	     * OpenSSL key derivation function.
	     */
	    var OpenSSLKdf = C_kdf.OpenSSL = {
	        /**
	         * Derives a key and IV from a password.
	         *
	         * @param {string} password The password to derive from.
	         * @param {number} keySize The size in words of the key to generate.
	         * @param {number} ivSize The size in words of the IV to generate.
	         * @param {WordArray|string} salt (Optional) A 64-bit salt to use. If omitted, a salt will be generated randomly.
	         *
	         * @return {CipherParams} A cipher params object with the key, IV, and salt.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var derivedParams = CryptoJS.kdf.OpenSSL.execute('Password', 256/32, 128/32);
	         *     var derivedParams = CryptoJS.kdf.OpenSSL.execute('Password', 256/32, 128/32, 'saltsalt');
	         */
	        execute: function (password, keySize, ivSize, salt) {
	            // Generate random salt
	            if (!salt) {
	                salt = WordArray.random(64/8);
	            }

	            // Derive key and IV
	            var key = EvpKDF.create({ keySize: keySize + ivSize }).compute(password, salt);

	            // Separate key and IV
	            var iv = WordArray.create(key.words.slice(keySize), ivSize * 4);
	            key.sigBytes = keySize * 4;

	            // Return params
	            return CipherParams.create({ key: key, iv: iv, salt: salt });
	        }
	    };

	    /**
	     * A serializable cipher wrapper that derives the key from a password,
	     * and returns ciphertext as a serializable cipher params object.
	     */
	    var PasswordBasedCipher = C_lib.PasswordBasedCipher = SerializableCipher.extend({
	        /**
	         * Configuration options.
	         *
	         * @property {KDF} kdf The key derivation function to use to generate a key and IV from a password. Default: OpenSSL
	         */
	        cfg: SerializableCipher.cfg.extend({
	            kdf: OpenSSLKdf
	        }),

	        /**
	         * Encrypts a message using a password.
	         *
	         * @param {Cipher} cipher The cipher algorithm to use.
	         * @param {WordArray|string} message The message to encrypt.
	         * @param {string} password The password.
	         * @param {Object} cfg (Optional) The configuration options to use for this operation.
	         *
	         * @return {CipherParams} A cipher params object.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var ciphertextParams = CryptoJS.lib.PasswordBasedCipher.encrypt(CryptoJS.algo.AES, message, 'password');
	         *     var ciphertextParams = CryptoJS.lib.PasswordBasedCipher.encrypt(CryptoJS.algo.AES, message, 'password', { format: CryptoJS.format.OpenSSL });
	         */
	        encrypt: function (cipher, message, password, cfg) {
	            // Apply config defaults
	            cfg = this.cfg.extend(cfg);

	            // Derive key and other params
	            var derivedParams = cfg.kdf.execute(password, cipher.keySize, cipher.ivSize);

	            // Add IV to config
	            cfg.iv = derivedParams.iv;

	            // Encrypt
	            var ciphertext = SerializableCipher.encrypt.call(this, cipher, message, derivedParams.key, cfg);

	            // Mix in derived params
	            ciphertext.mixIn(derivedParams);

	            return ciphertext;
	        },

	        /**
	         * Decrypts serialized ciphertext using a password.
	         *
	         * @param {Cipher} cipher The cipher algorithm to use.
	         * @param {CipherParams|string} ciphertext The ciphertext to decrypt.
	         * @param {string} password The password.
	         * @param {Object} cfg (Optional) The configuration options to use for this operation.
	         *
	         * @return {WordArray} The plaintext.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var plaintext = CryptoJS.lib.PasswordBasedCipher.decrypt(CryptoJS.algo.AES, formattedCiphertext, 'password', { format: CryptoJS.format.OpenSSL });
	         *     var plaintext = CryptoJS.lib.PasswordBasedCipher.decrypt(CryptoJS.algo.AES, ciphertextParams, 'password', { format: CryptoJS.format.OpenSSL });
	         */
	        decrypt: function (cipher, ciphertext, password, cfg) {
	            // Apply config defaults
	            cfg = this.cfg.extend(cfg);

	            // Convert string to CipherParams
	            ciphertext = this._parse(ciphertext, cfg.format);

	            // Derive key and other params
	            var derivedParams = cfg.kdf.execute(password, cipher.keySize, cipher.ivSize, ciphertext.salt);

	            // Add IV to config
	            cfg.iv = derivedParams.iv;

	            // Decrypt
	            var plaintext = SerializableCipher.decrypt.call(this, cipher, ciphertext, derivedParams.key, cfg);

	            return plaintext;
	        }
	    });
	}());


}));
},{"./core":3,"./evpkdf":6}],3:[function(require,module,exports){
;(function (root, factory) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory();
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define([], factory);
	}
	else {
		// Global (browser)
		root.CryptoJS = factory();
	}
}(this, function () {

	/**
	 * CryptoJS core components.
	 */
	var CryptoJS = CryptoJS || (function (Math, undefined) {
	    /*
	     * Local polyfil of Object.create
	     */
	    var create = Object.create || (function () {
	        function F() {};

	        return function (obj) {
	            var subtype;

	            F.prototype = obj;

	            subtype = new F();

	            F.prototype = null;

	            return subtype;
	        };
	    }())

	    /**
	     * CryptoJS namespace.
	     */
	    var C = {};

	    /**
	     * Library namespace.
	     */
	    var C_lib = C.lib = {};

	    /**
	     * Base object for prototypal inheritance.
	     */
	    var Base = C_lib.Base = (function () {


	        return {
	            /**
	             * Creates a new object that inherits from this object.
	             *
	             * @param {Object} overrides Properties to copy into the new object.
	             *
	             * @return {Object} The new object.
	             *
	             * @static
	             *
	             * @example
	             *
	             *     var MyType = CryptoJS.lib.Base.extend({
	             *         field: 'value',
	             *
	             *         method: function () {
	             *         }
	             *     });
	             */
	            extend: function (overrides) {
	                // Spawn
	                var subtype = create(this);

	                // Augment
	                if (overrides) {
	                    subtype.mixIn(overrides);
	                }

	                // Create default initializer
	                if (!subtype.hasOwnProperty('init') || this.init === subtype.init) {
	                    subtype.init = function () {
	                        subtype.$super.init.apply(this, arguments);
	                    };
	                }

	                // Initializer's prototype is the subtype object
	                subtype.init.prototype = subtype;

	                // Reference supertype
	                subtype.$super = this;

	                return subtype;
	            },

	            /**
	             * Extends this object and runs the init method.
	             * Arguments to create() will be passed to init().
	             *
	             * @return {Object} The new object.
	             *
	             * @static
	             *
	             * @example
	             *
	             *     var instance = MyType.create();
	             */
	            create: function () {
	                var instance = this.extend();
	                instance.init.apply(instance, arguments);

	                return instance;
	            },

	            /**
	             * Initializes a newly created object.
	             * Override this method to add some logic when your objects are created.
	             *
	             * @example
	             *
	             *     var MyType = CryptoJS.lib.Base.extend({
	             *         init: function () {
	             *             // ...
	             *         }
	             *     });
	             */
	            init: function () {
	            },

	            /**
	             * Copies properties into this object.
	             *
	             * @param {Object} properties The properties to mix in.
	             *
	             * @example
	             *
	             *     MyType.mixIn({
	             *         field: 'value'
	             *     });
	             */
	            mixIn: function (properties) {
	                for (var propertyName in properties) {
	                    if (properties.hasOwnProperty(propertyName)) {
	                        this[propertyName] = properties[propertyName];
	                    }
	                }

	                // IE won't copy toString using the loop above
	                if (properties.hasOwnProperty('toString')) {
	                    this.toString = properties.toString;
	                }
	            },

	            /**
	             * Creates a copy of this object.
	             *
	             * @return {Object} The clone.
	             *
	             * @example
	             *
	             *     var clone = instance.clone();
	             */
	            clone: function () {
	                return this.init.prototype.extend(this);
	            }
	        };
	    }());

	    /**
	     * An array of 32-bit words.
	     *
	     * @property {Array} words The array of 32-bit words.
	     * @property {number} sigBytes The number of significant bytes in this word array.
	     */
	    var WordArray = C_lib.WordArray = Base.extend({
	        /**
	         * Initializes a newly created word array.
	         *
	         * @param {Array} words (Optional) An array of 32-bit words.
	         * @param {number} sigBytes (Optional) The number of significant bytes in the words.
	         *
	         * @example
	         *
	         *     var wordArray = CryptoJS.lib.WordArray.create();
	         *     var wordArray = CryptoJS.lib.WordArray.create([0x00010203, 0x04050607]);
	         *     var wordArray = CryptoJS.lib.WordArray.create([0x00010203, 0x04050607], 6);
	         */
	        init: function (words, sigBytes) {
	            words = this.words = words || [];

	            if (sigBytes != undefined) {
	                this.sigBytes = sigBytes;
	            } else {
	                this.sigBytes = words.length * 4;
	            }
	        },

	        /**
	         * Converts this word array to a string.
	         *
	         * @param {Encoder} encoder (Optional) The encoding strategy to use. Default: CryptoJS.enc.Hex
	         *
	         * @return {string} The stringified word array.
	         *
	         * @example
	         *
	         *     var string = wordArray + '';
	         *     var string = wordArray.toString();
	         *     var string = wordArray.toString(CryptoJS.enc.Utf8);
	         */
	        toString: function (encoder) {
	            return (encoder || Hex).stringify(this);
	        },

	        /**
	         * Concatenates a word array to this word array.
	         *
	         * @param {WordArray} wordArray The word array to append.
	         *
	         * @return {WordArray} This word array.
	         *
	         * @example
	         *
	         *     wordArray1.concat(wordArray2);
	         */
	        concat: function (wordArray) {
	            // Shortcuts
	            var thisWords = this.words;
	            var thatWords = wordArray.words;
	            var thisSigBytes = this.sigBytes;
	            var thatSigBytes = wordArray.sigBytes;

	            // Clamp excess bits
	            this.clamp();

	            // Concat
	            if (thisSigBytes % 4) {
	                // Copy one byte at a time
	                for (var i = 0; i < thatSigBytes; i++) {
	                    var thatByte = (thatWords[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
	                    thisWords[(thisSigBytes + i) >>> 2] |= thatByte << (24 - ((thisSigBytes + i) % 4) * 8);
	                }
	            } else {
	                // Copy one word at a time
	                for (var i = 0; i < thatSigBytes; i += 4) {
	                    thisWords[(thisSigBytes + i) >>> 2] = thatWords[i >>> 2];
	                }
	            }
	            this.sigBytes += thatSigBytes;

	            // Chainable
	            return this;
	        },

	        /**
	         * Removes insignificant bits.
	         *
	         * @example
	         *
	         *     wordArray.clamp();
	         */
	        clamp: function () {
	            // Shortcuts
	            var words = this.words;
	            var sigBytes = this.sigBytes;

	            // Clamp
	            words[sigBytes >>> 2] &= 0xffffffff << (32 - (sigBytes % 4) * 8);
	            words.length = Math.ceil(sigBytes / 4);
	        },

	        /**
	         * Creates a copy of this word array.
	         *
	         * @return {WordArray} The clone.
	         *
	         * @example
	         *
	         *     var clone = wordArray.clone();
	         */
	        clone: function () {
	            var clone = Base.clone.call(this);
	            clone.words = this.words.slice(0);

	            return clone;
	        },

	        /**
	         * Creates a word array filled with random bytes.
	         *
	         * @param {number} nBytes The number of random bytes to generate.
	         *
	         * @return {WordArray} The random word array.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var wordArray = CryptoJS.lib.WordArray.random(16);
	         */
	        random: function (nBytes) {
	            var words = [];

	            var r = (function (m_w) {
	                var m_w = m_w;
	                var m_z = 0x3ade68b1;
	                var mask = 0xffffffff;

	                return function () {
	                    m_z = (0x9069 * (m_z & 0xFFFF) + (m_z >> 0x10)) & mask;
	                    m_w = (0x4650 * (m_w & 0xFFFF) + (m_w >> 0x10)) & mask;
	                    var result = ((m_z << 0x10) + m_w) & mask;
	                    result /= 0x100000000;
	                    result += 0.5;
	                    return result * (Math.random() > .5 ? 1 : -1);
	                }
	            });

	            for (var i = 0, rcache; i < nBytes; i += 4) {
	                var _r = r((rcache || Math.random()) * 0x100000000);

	                rcache = _r() * 0x3ade67b7;
	                words.push((_r() * 0x100000000) | 0);
	            }

	            return new WordArray.init(words, nBytes);
	        }
	    });

	    /**
	     * Encoder namespace.
	     */
	    var C_enc = C.enc = {};

	    /**
	     * Hex encoding strategy.
	     */
	    var Hex = C_enc.Hex = {
	        /**
	         * Converts a word array to a hex string.
	         *
	         * @param {WordArray} wordArray The word array.
	         *
	         * @return {string} The hex string.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var hexString = CryptoJS.enc.Hex.stringify(wordArray);
	         */
	        stringify: function (wordArray) {
	            // Shortcuts
	            var words = wordArray.words;
	            var sigBytes = wordArray.sigBytes;

	            // Convert
	            var hexChars = [];
	            for (var i = 0; i < sigBytes; i++) {
	                var bite = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
	                hexChars.push((bite >>> 4).toString(16));
	                hexChars.push((bite & 0x0f).toString(16));
	            }

	            return hexChars.join('');
	        },

	        /**
	         * Converts a hex string to a word array.
	         *
	         * @param {string} hexStr The hex string.
	         *
	         * @return {WordArray} The word array.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var wordArray = CryptoJS.enc.Hex.parse(hexString);
	         */
	        parse: function (hexStr) {
	            // Shortcut
	            var hexStrLength = hexStr.length;

	            // Convert
	            var words = [];
	            for (var i = 0; i < hexStrLength; i += 2) {
	                words[i >>> 3] |= parseInt(hexStr.substr(i, 2), 16) << (24 - (i % 8) * 4);
	            }

	            return new WordArray.init(words, hexStrLength / 2);
	        }
	    };

	    /**
	     * Latin1 encoding strategy.
	     */
	    var Latin1 = C_enc.Latin1 = {
	        /**
	         * Converts a word array to a Latin1 string.
	         *
	         * @param {WordArray} wordArray The word array.
	         *
	         * @return {string} The Latin1 string.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var latin1String = CryptoJS.enc.Latin1.stringify(wordArray);
	         */
	        stringify: function (wordArray) {
	            // Shortcuts
	            var words = wordArray.words;
	            var sigBytes = wordArray.sigBytes;

	            // Convert
	            var latin1Chars = [];
	            for (var i = 0; i < sigBytes; i++) {
	                var bite = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
	                latin1Chars.push(String.fromCharCode(bite));
	            }

	            return latin1Chars.join('');
	        },

	        /**
	         * Converts a Latin1 string to a word array.
	         *
	         * @param {string} latin1Str The Latin1 string.
	         *
	         * @return {WordArray} The word array.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var wordArray = CryptoJS.enc.Latin1.parse(latin1String);
	         */
	        parse: function (latin1Str) {
	            // Shortcut
	            var latin1StrLength = latin1Str.length;

	            // Convert
	            var words = [];
	            for (var i = 0; i < latin1StrLength; i++) {
	                words[i >>> 2] |= (latin1Str.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
	            }

	            return new WordArray.init(words, latin1StrLength);
	        }
	    };

	    /**
	     * UTF-8 encoding strategy.
	     */
	    var Utf8 = C_enc.Utf8 = {
	        /**
	         * Converts a word array to a UTF-8 string.
	         *
	         * @param {WordArray} wordArray The word array.
	         *
	         * @return {string} The UTF-8 string.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var utf8String = CryptoJS.enc.Utf8.stringify(wordArray);
	         */
	        stringify: function (wordArray) {
	            try {
	                return decodeURIComponent(escape(Latin1.stringify(wordArray)));
	            } catch (e) {
	                throw new Error('Malformed UTF-8 data');
	            }
	        },

	        /**
	         * Converts a UTF-8 string to a word array.
	         *
	         * @param {string} utf8Str The UTF-8 string.
	         *
	         * @return {WordArray} The word array.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var wordArray = CryptoJS.enc.Utf8.parse(utf8String);
	         */
	        parse: function (utf8Str) {
	            return Latin1.parse(unescape(encodeURIComponent(utf8Str)));
	        }
	    };

	    /**
	     * Abstract buffered block algorithm template.
	     *
	     * The property blockSize must be implemented in a concrete subtype.
	     *
	     * @property {number} _minBufferSize The number of blocks that should be kept unprocessed in the buffer. Default: 0
	     */
	    var BufferedBlockAlgorithm = C_lib.BufferedBlockAlgorithm = Base.extend({
	        /**
	         * Resets this block algorithm's data buffer to its initial state.
	         *
	         * @example
	         *
	         *     bufferedBlockAlgorithm.reset();
	         */
	        reset: function () {
	            // Initial values
	            this._data = new WordArray.init();
	            this._nDataBytes = 0;
	        },

	        /**
	         * Adds new data to this block algorithm's buffer.
	         *
	         * @param {WordArray|string} data The data to append. Strings are converted to a WordArray using UTF-8.
	         *
	         * @example
	         *
	         *     bufferedBlockAlgorithm._append('data');
	         *     bufferedBlockAlgorithm._append(wordArray);
	         */
	        _append: function (data) {
	            // Convert string to WordArray, else assume WordArray already
	            if (typeof data == 'string') {
	                data = Utf8.parse(data);
	            }

	            // Append
	            this._data.concat(data);
	            this._nDataBytes += data.sigBytes;
	        },

	        /**
	         * Processes available data blocks.
	         *
	         * This method invokes _doProcessBlock(offset), which must be implemented by a concrete subtype.
	         *
	         * @param {boolean} doFlush Whether all blocks and partial blocks should be processed.
	         *
	         * @return {WordArray} The processed data.
	         *
	         * @example
	         *
	         *     var processedData = bufferedBlockAlgorithm._process();
	         *     var processedData = bufferedBlockAlgorithm._process(!!'flush');
	         */
	        _process: function (doFlush) {
	            // Shortcuts
	            var data = this._data;
	            var dataWords = data.words;
	            var dataSigBytes = data.sigBytes;
	            var blockSize = this.blockSize;
	            var blockSizeBytes = blockSize * 4;

	            // Count blocks ready
	            var nBlocksReady = dataSigBytes / blockSizeBytes;
	            if (doFlush) {
	                // Round up to include partial blocks
	                nBlocksReady = Math.ceil(nBlocksReady);
	            } else {
	                // Round down to include only full blocks,
	                // less the number of blocks that must remain in the buffer
	                nBlocksReady = Math.max((nBlocksReady | 0) - this._minBufferSize, 0);
	            }

	            // Count words ready
	            var nWordsReady = nBlocksReady * blockSize;

	            // Count bytes ready
	            var nBytesReady = Math.min(nWordsReady * 4, dataSigBytes);

	            // Process blocks
	            if (nWordsReady) {
	                for (var offset = 0; offset < nWordsReady; offset += blockSize) {
	                    // Perform concrete-algorithm logic
	                    this._doProcessBlock(dataWords, offset);
	                }

	                // Remove processed words
	                var processedWords = dataWords.splice(0, nWordsReady);
	                data.sigBytes -= nBytesReady;
	            }

	            // Return processed words
	            return new WordArray.init(processedWords, nBytesReady);
	        },

	        /**
	         * Creates a copy of this object.
	         *
	         * @return {Object} The clone.
	         *
	         * @example
	         *
	         *     var clone = bufferedBlockAlgorithm.clone();
	         */
	        clone: function () {
	            var clone = Base.clone.call(this);
	            clone._data = this._data.clone();

	            return clone;
	        },

	        _minBufferSize: 0
	    });

	    /**
	     * Abstract hasher template.
	     *
	     * @property {number} blockSize The number of 32-bit words this hasher operates on. Default: 16 (512 bits)
	     */
	    var Hasher = C_lib.Hasher = BufferedBlockAlgorithm.extend({
	        /**
	         * Configuration options.
	         */
	        cfg: Base.extend(),

	        /**
	         * Initializes a newly created hasher.
	         *
	         * @param {Object} cfg (Optional) The configuration options to use for this hash computation.
	         *
	         * @example
	         *
	         *     var hasher = CryptoJS.algo.SHA256.create();
	         */
	        init: function (cfg) {
	            // Apply config defaults
	            this.cfg = this.cfg.extend(cfg);

	            // Set initial values
	            this.reset();
	        },

	        /**
	         * Resets this hasher to its initial state.
	         *
	         * @example
	         *
	         *     hasher.reset();
	         */
	        reset: function () {
	            // Reset data buffer
	            BufferedBlockAlgorithm.reset.call(this);

	            // Perform concrete-hasher logic
	            this._doReset();
	        },

	        /**
	         * Updates this hasher with a message.
	         *
	         * @param {WordArray|string} messageUpdate The message to append.
	         *
	         * @return {Hasher} This hasher.
	         *
	         * @example
	         *
	         *     hasher.update('message');
	         *     hasher.update(wordArray);
	         */
	        update: function (messageUpdate) {
	            // Append
	            this._append(messageUpdate);

	            // Update the hash
	            this._process();

	            // Chainable
	            return this;
	        },

	        /**
	         * Finalizes the hash computation.
	         * Note that the finalize operation is effectively a destructive, read-once operation.
	         *
	         * @param {WordArray|string} messageUpdate (Optional) A final message update.
	         *
	         * @return {WordArray} The hash.
	         *
	         * @example
	         *
	         *     var hash = hasher.finalize();
	         *     var hash = hasher.finalize('message');
	         *     var hash = hasher.finalize(wordArray);
	         */
	        finalize: function (messageUpdate) {
	            // Final message update
	            if (messageUpdate) {
	                this._append(messageUpdate);
	            }

	            // Perform concrete-hasher logic
	            var hash = this._doFinalize();

	            return hash;
	        },

	        blockSize: 512/32,

	        /**
	         * Creates a shortcut function to a hasher's object interface.
	         *
	         * @param {Hasher} hasher The hasher to create a helper for.
	         *
	         * @return {Function} The shortcut function.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var SHA256 = CryptoJS.lib.Hasher._createHelper(CryptoJS.algo.SHA256);
	         */
	        _createHelper: function (hasher) {
	            return function (message, cfg) {
	                return new hasher.init(cfg).finalize(message);
	            };
	        },

	        /**
	         * Creates a shortcut function to the HMAC's object interface.
	         *
	         * @param {Hasher} hasher The hasher to use in this HMAC helper.
	         *
	         * @return {Function} The shortcut function.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var HmacSHA256 = CryptoJS.lib.Hasher._createHmacHelper(CryptoJS.algo.SHA256);
	         */
	        _createHmacHelper: function (hasher) {
	            return function (message, key) {
	                return new C_algo.HMAC.init(hasher, key).finalize(message);
	            };
	        }
	    });

	    /**
	     * Algorithm namespace.
	     */
	    var C_algo = C.algo = {};

	    return C;
	}(Math));


	return CryptoJS;

}));
},{}],4:[function(require,module,exports){
;(function (root, factory) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	(function () {
	    // Shortcuts
	    var C = CryptoJS;
	    var C_lib = C.lib;
	    var WordArray = C_lib.WordArray;
	    var C_enc = C.enc;

	    /**
	     * Base64 encoding strategy.
	     */
	    var Base64 = C_enc.Base64 = {
	        /**
	         * Converts a word array to a Base64 string.
	         *
	         * @param {WordArray} wordArray The word array.
	         *
	         * @return {string} The Base64 string.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var base64String = CryptoJS.enc.Base64.stringify(wordArray);
	         */
	        stringify: function (wordArray) {
	            // Shortcuts
	            var words = wordArray.words;
	            var sigBytes = wordArray.sigBytes;
	            var map = this._map;

	            // Clamp excess bits
	            wordArray.clamp();

	            // Convert
	            var base64Chars = [];
	            for (var i = 0; i < sigBytes; i += 3) {
	                var byte1 = (words[i >>> 2]       >>> (24 - (i % 4) * 8))       & 0xff;
	                var byte2 = (words[(i + 1) >>> 2] >>> (24 - ((i + 1) % 4) * 8)) & 0xff;
	                var byte3 = (words[(i + 2) >>> 2] >>> (24 - ((i + 2) % 4) * 8)) & 0xff;

	                var triplet = (byte1 << 16) | (byte2 << 8) | byte3;

	                for (var j = 0; (j < 4) && (i + j * 0.75 < sigBytes); j++) {
	                    base64Chars.push(map.charAt((triplet >>> (6 * (3 - j))) & 0x3f));
	                }
	            }

	            // Add padding
	            var paddingChar = map.charAt(64);
	            if (paddingChar) {
	                while (base64Chars.length % 4) {
	                    base64Chars.push(paddingChar);
	                }
	            }

	            return base64Chars.join('');
	        },

	        /**
	         * Converts a Base64 string to a word array.
	         *
	         * @param {string} base64Str The Base64 string.
	         *
	         * @return {WordArray} The word array.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var wordArray = CryptoJS.enc.Base64.parse(base64String);
	         */
	        parse: function (base64Str) {
	            // Shortcuts
	            var base64StrLength = base64Str.length;
	            var map = this._map;
	            var reverseMap = this._reverseMap;

	            if (!reverseMap) {
	                    reverseMap = this._reverseMap = [];
	                    for (var j = 0; j < map.length; j++) {
	                        reverseMap[map.charCodeAt(j)] = j;
	                    }
	            }

	            // Ignore padding
	            var paddingChar = map.charAt(64);
	            if (paddingChar) {
	                var paddingIndex = base64Str.indexOf(paddingChar);
	                if (paddingIndex !== -1) {
	                    base64StrLength = paddingIndex;
	                }
	            }

	            // Convert
	            return parseLoop(base64Str, base64StrLength, reverseMap);

	        },

	        _map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='
	    };

	    function parseLoop(base64Str, base64StrLength, reverseMap) {
	      var words = [];
	      var nBytes = 0;
	      for (var i = 0; i < base64StrLength; i++) {
	          if (i % 4) {
	              var bits1 = reverseMap[base64Str.charCodeAt(i - 1)] << ((i % 4) * 2);
	              var bits2 = reverseMap[base64Str.charCodeAt(i)] >>> (6 - (i % 4) * 2);
	              words[nBytes >>> 2] |= (bits1 | bits2) << (24 - (nBytes % 4) * 8);
	              nBytes++;
	          }
	      }
	      return WordArray.create(words, nBytes);
	    }
	}());


	return CryptoJS.enc.Base64;

}));
},{"./core":3}],5:[function(require,module,exports){
;(function (root, factory) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	(function () {
	    // Shortcuts
	    var C = CryptoJS;
	    var C_lib = C.lib;
	    var WordArray = C_lib.WordArray;
	    var C_enc = C.enc;

	    /**
	     * UTF-16 BE encoding strategy.
	     */
	    var Utf16BE = C_enc.Utf16 = C_enc.Utf16BE = {
	        /**
	         * Converts a word array to a UTF-16 BE string.
	         *
	         * @param {WordArray} wordArray The word array.
	         *
	         * @return {string} The UTF-16 BE string.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var utf16String = CryptoJS.enc.Utf16.stringify(wordArray);
	         */
	        stringify: function (wordArray) {
	            // Shortcuts
	            var words = wordArray.words;
	            var sigBytes = wordArray.sigBytes;

	            // Convert
	            var utf16Chars = [];
	            for (var i = 0; i < sigBytes; i += 2) {
	                var codePoint = (words[i >>> 2] >>> (16 - (i % 4) * 8)) & 0xffff;
	                utf16Chars.push(String.fromCharCode(codePoint));
	            }

	            return utf16Chars.join('');
	        },

	        /**
	         * Converts a UTF-16 BE string to a word array.
	         *
	         * @param {string} utf16Str The UTF-16 BE string.
	         *
	         * @return {WordArray} The word array.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var wordArray = CryptoJS.enc.Utf16.parse(utf16String);
	         */
	        parse: function (utf16Str) {
	            // Shortcut
	            var utf16StrLength = utf16Str.length;

	            // Convert
	            var words = [];
	            for (var i = 0; i < utf16StrLength; i++) {
	                words[i >>> 1] |= utf16Str.charCodeAt(i) << (16 - (i % 2) * 16);
	            }

	            return WordArray.create(words, utf16StrLength * 2);
	        }
	    };

	    /**
	     * UTF-16 LE encoding strategy.
	     */
	    C_enc.Utf16LE = {
	        /**
	         * Converts a word array to a UTF-16 LE string.
	         *
	         * @param {WordArray} wordArray The word array.
	         *
	         * @return {string} The UTF-16 LE string.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var utf16Str = CryptoJS.enc.Utf16LE.stringify(wordArray);
	         */
	        stringify: function (wordArray) {
	            // Shortcuts
	            var words = wordArray.words;
	            var sigBytes = wordArray.sigBytes;

	            // Convert
	            var utf16Chars = [];
	            for (var i = 0; i < sigBytes; i += 2) {
	                var codePoint = swapEndian((words[i >>> 2] >>> (16 - (i % 4) * 8)) & 0xffff);
	                utf16Chars.push(String.fromCharCode(codePoint));
	            }

	            return utf16Chars.join('');
	        },

	        /**
	         * Converts a UTF-16 LE string to a word array.
	         *
	         * @param {string} utf16Str The UTF-16 LE string.
	         *
	         * @return {WordArray} The word array.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var wordArray = CryptoJS.enc.Utf16LE.parse(utf16Str);
	         */
	        parse: function (utf16Str) {
	            // Shortcut
	            var utf16StrLength = utf16Str.length;

	            // Convert
	            var words = [];
	            for (var i = 0; i < utf16StrLength; i++) {
	                words[i >>> 1] |= swapEndian(utf16Str.charCodeAt(i) << (16 - (i % 2) * 16));
	            }

	            return WordArray.create(words, utf16StrLength * 2);
	        }
	    };

	    function swapEndian(word) {
	        return ((word << 8) & 0xff00ff00) | ((word >>> 8) & 0x00ff00ff);
	    }
	}());


	return CryptoJS.enc.Utf16;

}));
},{"./core":3}],6:[function(require,module,exports){
;(function (root, factory, undef) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"), require("./sha1"), require("./hmac"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core", "./sha1", "./hmac"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	(function () {
	    // Shortcuts
	    var C = CryptoJS;
	    var C_lib = C.lib;
	    var Base = C_lib.Base;
	    var WordArray = C_lib.WordArray;
	    var C_algo = C.algo;
	    var MD5 = C_algo.MD5;

	    /**
	     * This key derivation function is meant to conform with EVP_BytesToKey.
	     * www.openssl.org/docs/crypto/EVP_BytesToKey.html
	     */
	    var EvpKDF = C_algo.EvpKDF = Base.extend({
	        /**
	         * Configuration options.
	         *
	         * @property {number} keySize The key size in words to generate. Default: 4 (128 bits)
	         * @property {Hasher} hasher The hash algorithm to use. Default: MD5
	         * @property {number} iterations The number of iterations to perform. Default: 1
	         */
	        cfg: Base.extend({
	            keySize: 128/32,
	            hasher: MD5,
	            iterations: 1
	        }),

	        /**
	         * Initializes a newly created key derivation function.
	         *
	         * @param {Object} cfg (Optional) The configuration options to use for the derivation.
	         *
	         * @example
	         *
	         *     var kdf = CryptoJS.algo.EvpKDF.create();
	         *     var kdf = CryptoJS.algo.EvpKDF.create({ keySize: 8 });
	         *     var kdf = CryptoJS.algo.EvpKDF.create({ keySize: 8, iterations: 1000 });
	         */
	        init: function (cfg) {
	            this.cfg = this.cfg.extend(cfg);
	        },

	        /**
	         * Derives a key from a password.
	         *
	         * @param {WordArray|string} password The password.
	         * @param {WordArray|string} salt A salt.
	         *
	         * @return {WordArray} The derived key.
	         *
	         * @example
	         *
	         *     var key = kdf.compute(password, salt);
	         */
	        compute: function (password, salt) {
	            // Shortcut
	            var cfg = this.cfg;

	            // Init hasher
	            var hasher = cfg.hasher.create();

	            // Initial values
	            var derivedKey = WordArray.create();

	            // Shortcuts
	            var derivedKeyWords = derivedKey.words;
	            var keySize = cfg.keySize;
	            var iterations = cfg.iterations;

	            // Generate key
	            while (derivedKeyWords.length < keySize) {
	                if (block) {
	                    hasher.update(block);
	                }
	                var block = hasher.update(password).finalize(salt);
	                hasher.reset();

	                // Iterations
	                for (var i = 1; i < iterations; i++) {
	                    block = hasher.finalize(block);
	                    hasher.reset();
	                }

	                derivedKey.concat(block);
	            }
	            derivedKey.sigBytes = keySize * 4;

	            return derivedKey;
	        }
	    });

	    /**
	     * Derives a key from a password.
	     *
	     * @param {WordArray|string} password The password.
	     * @param {WordArray|string} salt A salt.
	     * @param {Object} cfg (Optional) The configuration options to use for this computation.
	     *
	     * @return {WordArray} The derived key.
	     *
	     * @static
	     *
	     * @example
	     *
	     *     var key = CryptoJS.EvpKDF(password, salt);
	     *     var key = CryptoJS.EvpKDF(password, salt, { keySize: 8 });
	     *     var key = CryptoJS.EvpKDF(password, salt, { keySize: 8, iterations: 1000 });
	     */
	    C.EvpKDF = function (password, salt, cfg) {
	        return EvpKDF.create(cfg).compute(password, salt);
	    };
	}());


	return CryptoJS.EvpKDF;

}));
},{"./core":3,"./hmac":8,"./sha1":27}],7:[function(require,module,exports){
;(function (root, factory, undef) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"), require("./cipher-core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core", "./cipher-core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	(function (undefined) {
	    // Shortcuts
	    var C = CryptoJS;
	    var C_lib = C.lib;
	    var CipherParams = C_lib.CipherParams;
	    var C_enc = C.enc;
	    var Hex = C_enc.Hex;
	    var C_format = C.format;

	    var HexFormatter = C_format.Hex = {
	        /**
	         * Converts the ciphertext of a cipher params object to a hexadecimally encoded string.
	         *
	         * @param {CipherParams} cipherParams The cipher params object.
	         *
	         * @return {string} The hexadecimally encoded string.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var hexString = CryptoJS.format.Hex.stringify(cipherParams);
	         */
	        stringify: function (cipherParams) {
	            return cipherParams.ciphertext.toString(Hex);
	        },

	        /**
	         * Converts a hexadecimally encoded ciphertext string to a cipher params object.
	         *
	         * @param {string} input The hexadecimally encoded string.
	         *
	         * @return {CipherParams} The cipher params object.
	         *
	         * @static
	         *
	         * @example
	         *
	         *     var cipherParams = CryptoJS.format.Hex.parse(hexString);
	         */
	        parse: function (input) {
	            var ciphertext = Hex.parse(input);
	            return CipherParams.create({ ciphertext: ciphertext });
	        }
	    };
	}());


	return CryptoJS.format.Hex;

}));
},{"./cipher-core":2,"./core":3}],8:[function(require,module,exports){
;(function (root, factory) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	(function () {
	    // Shortcuts
	    var C = CryptoJS;
	    var C_lib = C.lib;
	    var Base = C_lib.Base;
	    var C_enc = C.enc;
	    var Utf8 = C_enc.Utf8;
	    var C_algo = C.algo;

	    /**
	     * HMAC algorithm.
	     */
	    var HMAC = C_algo.HMAC = Base.extend({
	        /**
	         * Initializes a newly created HMAC.
	         *
	         * @param {Hasher} hasher The hash algorithm to use.
	         * @param {WordArray|string} key The secret key.
	         *
	         * @example
	         *
	         *     var hmacHasher = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, key);
	         */
	        init: function (hasher, key) {
	            // Init hasher
	            hasher = this._hasher = new hasher.init();

	            // Convert string to WordArray, else assume WordArray already
	            if (typeof key == 'string') {
	                key = Utf8.parse(key);
	            }

	            // Shortcuts
	            var hasherBlockSize = hasher.blockSize;
	            var hasherBlockSizeBytes = hasherBlockSize * 4;

	            // Allow arbitrary length keys
	            if (key.sigBytes > hasherBlockSizeBytes) {
	                key = hasher.finalize(key);
	            }

	            // Clamp excess bits
	            key.clamp();

	            // Clone key for inner and outer pads
	            var oKey = this._oKey = key.clone();
	            var iKey = this._iKey = key.clone();

	            // Shortcuts
	            var oKeyWords = oKey.words;
	            var iKeyWords = iKey.words;

	            // XOR keys with pad constants
	            for (var i = 0; i < hasherBlockSize; i++) {
	                oKeyWords[i] ^= 0x5c5c5c5c;
	                iKeyWords[i] ^= 0x36363636;
	            }
	            oKey.sigBytes = iKey.sigBytes = hasherBlockSizeBytes;

	            // Set initial values
	            this.reset();
	        },

	        /**
	         * Resets this HMAC to its initial state.
	         *
	         * @example
	         *
	         *     hmacHasher.reset();
	         */
	        reset: function () {
	            // Shortcut
	            var hasher = this._hasher;

	            // Reset
	            hasher.reset();
	            hasher.update(this._iKey);
	        },

	        /**
	         * Updates this HMAC with a message.
	         *
	         * @param {WordArray|string} messageUpdate The message to append.
	         *
	         * @return {HMAC} This HMAC instance.
	         *
	         * @example
	         *
	         *     hmacHasher.update('message');
	         *     hmacHasher.update(wordArray);
	         */
	        update: function (messageUpdate) {
	            this._hasher.update(messageUpdate);

	            // Chainable
	            return this;
	        },

	        /**
	         * Finalizes the HMAC computation.
	         * Note that the finalize operation is effectively a destructive, read-once operation.
	         *
	         * @param {WordArray|string} messageUpdate (Optional) A final message update.
	         *
	         * @return {WordArray} The HMAC.
	         *
	         * @example
	         *
	         *     var hmac = hmacHasher.finalize();
	         *     var hmac = hmacHasher.finalize('message');
	         *     var hmac = hmacHasher.finalize(wordArray);
	         */
	        finalize: function (messageUpdate) {
	            // Shortcut
	            var hasher = this._hasher;

	            // Compute HMAC
	            var innerHash = hasher.finalize(messageUpdate);
	            hasher.reset();
	            var hmac = hasher.finalize(this._oKey.clone().concat(innerHash));

	            return hmac;
	        }
	    });
	}());


}));
},{"./core":3}],9:[function(require,module,exports){
;(function (root, factory, undef) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"), require("./x64-core"), require("./lib-typedarrays"), require("./enc-utf16"), require("./enc-base64"), require("./md5"), require("./sha1"), require("./sha256"), require("./sha224"), require("./sha512"), require("./sha384"), require("./sha3"), require("./ripemd160"), require("./hmac"), require("./pbkdf2"), require("./evpkdf"), require("./cipher-core"), require("./mode-cfb"), require("./mode-ctr"), require("./mode-ctr-gladman"), require("./mode-ofb"), require("./mode-ecb"), require("./pad-ansix923"), require("./pad-iso10126"), require("./pad-iso97971"), require("./pad-zeropadding"), require("./pad-nopadding"), require("./format-hex"), require("./aes"), require("./tripledes"), require("./rc4"), require("./rabbit"), require("./rabbit-legacy"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core", "./x64-core", "./lib-typedarrays", "./enc-utf16", "./enc-base64", "./md5", "./sha1", "./sha256", "./sha224", "./sha512", "./sha384", "./sha3", "./ripemd160", "./hmac", "./pbkdf2", "./evpkdf", "./cipher-core", "./mode-cfb", "./mode-ctr", "./mode-ctr-gladman", "./mode-ofb", "./mode-ecb", "./pad-ansix923", "./pad-iso10126", "./pad-iso97971", "./pad-zeropadding", "./pad-nopadding", "./format-hex", "./aes", "./tripledes", "./rc4", "./rabbit", "./rabbit-legacy"], factory);
	}
	else {
		// Global (browser)
		root.CryptoJS = factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	return CryptoJS;

}));
},{"./aes":1,"./cipher-core":2,"./core":3,"./enc-base64":4,"./enc-utf16":5,"./evpkdf":6,"./format-hex":7,"./hmac":8,"./lib-typedarrays":10,"./md5":11,"./mode-cfb":12,"./mode-ctr":14,"./mode-ctr-gladman":13,"./mode-ecb":15,"./mode-ofb":16,"./pad-ansix923":17,"./pad-iso10126":18,"./pad-iso97971":19,"./pad-nopadding":20,"./pad-zeropadding":21,"./pbkdf2":22,"./rabbit":24,"./rabbit-legacy":23,"./rc4":25,"./ripemd160":26,"./sha1":27,"./sha224":28,"./sha256":29,"./sha3":30,"./sha384":31,"./sha512":32,"./tripledes":33,"./x64-core":34}],10:[function(require,module,exports){
;(function (root, factory) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	(function () {
	    // Check if typed arrays are supported
	    if (typeof ArrayBuffer != 'function') {
	        return;
	    }

	    // Shortcuts
	    var C = CryptoJS;
	    var C_lib = C.lib;
	    var WordArray = C_lib.WordArray;

	    // Reference original init
	    var superInit = WordArray.init;

	    // Augment WordArray.init to handle typed arrays
	    var subInit = WordArray.init = function (typedArray) {
	        // Convert buffers to uint8
	        if (typedArray instanceof ArrayBuffer) {
	            typedArray = new Uint8Array(typedArray);
	        }

	        // Convert other array views to uint8
	        if (
	            typedArray instanceof Int8Array ||
	            (typeof Uint8ClampedArray !== "undefined" && typedArray instanceof Uint8ClampedArray) ||
	            typedArray instanceof Int16Array ||
	            typedArray instanceof Uint16Array ||
	            typedArray instanceof Int32Array ||
	            typedArray instanceof Uint32Array ||
	            typedArray instanceof Float32Array ||
	            typedArray instanceof Float64Array
	        ) {
	            typedArray = new Uint8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
	        }

	        // Handle Uint8Array
	        if (typedArray instanceof Uint8Array) {
	            // Shortcut
	            var typedArrayByteLength = typedArray.byteLength;

	            // Extract bytes
	            var words = [];
	            for (var i = 0; i < typedArrayByteLength; i++) {
	                words[i >>> 2] |= typedArray[i] << (24 - (i % 4) * 8);
	            }

	            // Initialize this word array
	            superInit.call(this, words, typedArrayByteLength);
	        } else {
	            // Else call normal init
	            superInit.apply(this, arguments);
	        }
	    };

	    subInit.prototype = WordArray;
	}());


	return CryptoJS.lib.WordArray;

}));
},{"./core":3}],11:[function(require,module,exports){
;(function (root, factory) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	(function (Math) {
	    // Shortcuts
	    var C = CryptoJS;
	    var C_lib = C.lib;
	    var WordArray = C_lib.WordArray;
	    var Hasher = C_lib.Hasher;
	    var C_algo = C.algo;

	    // Constants table
	    var T = [];

	    // Compute constants
	    (function () {
	        for (var i = 0; i < 64; i++) {
	            T[i] = (Math.abs(Math.sin(i + 1)) * 0x100000000) | 0;
	        }
	    }());

	    /**
	     * MD5 hash algorithm.
	     */
	    var MD5 = C_algo.MD5 = Hasher.extend({
	        _doReset: function () {
	            this._hash = new WordArray.init([
	                0x67452301, 0xefcdab89,
	                0x98badcfe, 0x10325476
	            ]);
	        },

	        _doProcessBlock: function (M, offset) {
	            // Swap endian
	            for (var i = 0; i < 16; i++) {
	                // Shortcuts
	                var offset_i = offset + i;
	                var M_offset_i = M[offset_i];

	                M[offset_i] = (
	                    (((M_offset_i << 8)  | (M_offset_i >>> 24)) & 0x00ff00ff) |
	                    (((M_offset_i << 24) | (M_offset_i >>> 8))  & 0xff00ff00)
	                );
	            }

	            // Shortcuts
	            var H = this._hash.words;

	            var M_offset_0  = M[offset + 0];
	            var M_offset_1  = M[offset + 1];
	            var M_offset_2  = M[offset + 2];
	            var M_offset_3  = M[offset + 3];
	            var M_offset_4  = M[offset + 4];
	            var M_offset_5  = M[offset + 5];
	            var M_offset_6  = M[offset + 6];
	            var M_offset_7  = M[offset + 7];
	            var M_offset_8  = M[offset + 8];
	            var M_offset_9  = M[offset + 9];
	            var M_offset_10 = M[offset + 10];
	            var M_offset_11 = M[offset + 11];
	            var M_offset_12 = M[offset + 12];
	            var M_offset_13 = M[offset + 13];
	            var M_offset_14 = M[offset + 14];
	            var M_offset_15 = M[offset + 15];

	            // Working varialbes
	            var a = H[0];
	            var b = H[1];
	            var c = H[2];
	            var d = H[3];

	            // Computation
	            a = FF(a, b, c, d, M_offset_0,  7,  T[0]);
	            d = FF(d, a, b, c, M_offset_1,  12, T[1]);
	            c = FF(c, d, a, b, M_offset_2,  17, T[2]);
	            b = FF(b, c, d, a, M_offset_3,  22, T[3]);
	            a = FF(a, b, c, d, M_offset_4,  7,  T[4]);
	            d = FF(d, a, b, c, M_offset_5,  12, T[5]);
	            c = FF(c, d, a, b, M_offset_6,  17, T[6]);
	            b = FF(b, c, d, a, M_offset_7,  22, T[7]);
	            a = FF(a, b, c, d, M_offset_8,  7,  T[8]);
	            d = FF(d, a, b, c, M_offset_9,  12, T[9]);
	            c = FF(c, d, a, b, M_offset_10, 17, T[10]);
	            b = FF(b, c, d, a, M_offset_11, 22, T[11]);
	            a = FF(a, b, c, d, M_offset_12, 7,  T[12]);
	            d = FF(d, a, b, c, M_offset_13, 12, T[13]);
	            c = FF(c, d, a, b, M_offset_14, 17, T[14]);
	            b = FF(b, c, d, a, M_offset_15, 22, T[15]);

	            a = GG(a, b, c, d, M_offset_1,  5,  T[16]);
	            d = GG(d, a, b, c, M_offset_6,  9,  T[17]);
	            c = GG(c, d, a, b, M_offset_11, 14, T[18]);
	            b = GG(b, c, d, a, M_offset_0,  20, T[19]);
	            a = GG(a, b, c, d, M_offset_5,  5,  T[20]);
	            d = GG(d, a, b, c, M_offset_10, 9,  T[21]);
	            c = GG(c, d, a, b, M_offset_15, 14, T[22]);
	            b = GG(b, c, d, a, M_offset_4,  20, T[23]);
	            a = GG(a, b, c, d, M_offset_9,  5,  T[24]);
	            d = GG(d, a, b, c, M_offset_14, 9,  T[25]);
	            c = GG(c, d, a, b, M_offset_3,  14, T[26]);
	            b = GG(b, c, d, a, M_offset_8,  20, T[27]);
	            a = GG(a, b, c, d, M_offset_13, 5,  T[28]);
	            d = GG(d, a, b, c, M_offset_2,  9,  T[29]);
	            c = GG(c, d, a, b, M_offset_7,  14, T[30]);
	            b = GG(b, c, d, a, M_offset_12, 20, T[31]);

	            a = HH(a, b, c, d, M_offset_5,  4,  T[32]);
	            d = HH(d, a, b, c, M_offset_8,  11, T[33]);
	            c = HH(c, d, a, b, M_offset_11, 16, T[34]);
	            b = HH(b, c, d, a, M_offset_14, 23, T[35]);
	            a = HH(a, b, c, d, M_offset_1,  4,  T[36]);
	            d = HH(d, a, b, c, M_offset_4,  11, T[37]);
	            c = HH(c, d, a, b, M_offset_7,  16, T[38]);
	            b = HH(b, c, d, a, M_offset_10, 23, T[39]);
	            a = HH(a, b, c, d, M_offset_13, 4,  T[40]);
	            d = HH(d, a, b, c, M_offset_0,  11, T[41]);
	            c = HH(c, d, a, b, M_offset_3,  16, T[42]);
	            b = HH(b, c, d, a, M_offset_6,  23, T[43]);
	            a = HH(a, b, c, d, M_offset_9,  4,  T[44]);
	            d = HH(d, a, b, c, M_offset_12, 11, T[45]);
	            c = HH(c, d, a, b, M_offset_15, 16, T[46]);
	            b = HH(b, c, d, a, M_offset_2,  23, T[47]);

	            a = II(a, b, c, d, M_offset_0,  6,  T[48]);
	            d = II(d, a, b, c, M_offset_7,  10, T[49]);
	            c = II(c, d, a, b, M_offset_14, 15, T[50]);
	            b = II(b, c, d, a, M_offset_5,  21, T[51]);
	            a = II(a, b, c, d, M_offset_12, 6,  T[52]);
	            d = II(d, a, b, c, M_offset_3,  10, T[53]);
	            c = II(c, d, a, b, M_offset_10, 15, T[54]);
	            b = II(b, c, d, a, M_offset_1,  21, T[55]);
	            a = II(a, b, c, d, M_offset_8,  6,  T[56]);
	            d = II(d, a, b, c, M_offset_15, 10, T[57]);
	            c = II(c, d, a, b, M_offset_6,  15, T[58]);
	            b = II(b, c, d, a, M_offset_13, 21, T[59]);
	            a = II(a, b, c, d, M_offset_4,  6,  T[60]);
	            d = II(d, a, b, c, M_offset_11, 10, T[61]);
	            c = II(c, d, a, b, M_offset_2,  15, T[62]);
	            b = II(b, c, d, a, M_offset_9,  21, T[63]);

	            // Intermediate hash value
	            H[0] = (H[0] + a) | 0;
	            H[1] = (H[1] + b) | 0;
	            H[2] = (H[2] + c) | 0;
	            H[3] = (H[3] + d) | 0;
	        },

	        _doFinalize: function () {
	            // Shortcuts
	            var data = this._data;
	            var dataWords = data.words;

	            var nBitsTotal = this._nDataBytes * 8;
	            var nBitsLeft = data.sigBytes * 8;

	            // Add padding
	            dataWords[nBitsLeft >>> 5] |= 0x80 << (24 - nBitsLeft % 32);

	            var nBitsTotalH = Math.floor(nBitsTotal / 0x100000000);
	            var nBitsTotalL = nBitsTotal;
	            dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 15] = (
	                (((nBitsTotalH << 8)  | (nBitsTotalH >>> 24)) & 0x00ff00ff) |
	                (((nBitsTotalH << 24) | (nBitsTotalH >>> 8))  & 0xff00ff00)
	            );
	            dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 14] = (
	                (((nBitsTotalL << 8)  | (nBitsTotalL >>> 24)) & 0x00ff00ff) |
	                (((nBitsTotalL << 24) | (nBitsTotalL >>> 8))  & 0xff00ff00)
	            );

	            data.sigBytes = (dataWords.length + 1) * 4;

	            // Hash final blocks
	            this._process();

	            // Shortcuts
	            var hash = this._hash;
	            var H = hash.words;

	            // Swap endian
	            for (var i = 0; i < 4; i++) {
	                // Shortcut
	                var H_i = H[i];

	                H[i] = (((H_i << 8)  | (H_i >>> 24)) & 0x00ff00ff) |
	                       (((H_i << 24) | (H_i >>> 8))  & 0xff00ff00);
	            }

	            // Return final computed hash
	            return hash;
	        },

	        clone: function () {
	            var clone = Hasher.clone.call(this);
	            clone._hash = this._hash.clone();

	            return clone;
	        }
	    });

	    function FF(a, b, c, d, x, s, t) {
	        var n = a + ((b & c) | (~b & d)) + x + t;
	        return ((n << s) | (n >>> (32 - s))) + b;
	    }

	    function GG(a, b, c, d, x, s, t) {
	        var n = a + ((b & d) | (c & ~d)) + x + t;
	        return ((n << s) | (n >>> (32 - s))) + b;
	    }

	    function HH(a, b, c, d, x, s, t) {
	        var n = a + (b ^ c ^ d) + x + t;
	        return ((n << s) | (n >>> (32 - s))) + b;
	    }

	    function II(a, b, c, d, x, s, t) {
	        var n = a + (c ^ (b | ~d)) + x + t;
	        return ((n << s) | (n >>> (32 - s))) + b;
	    }

	    /**
	     * Shortcut function to the hasher's object interface.
	     *
	     * @param {WordArray|string} message The message to hash.
	     *
	     * @return {WordArray} The hash.
	     *
	     * @static
	     *
	     * @example
	     *
	     *     var hash = CryptoJS.MD5('message');
	     *     var hash = CryptoJS.MD5(wordArray);
	     */
	    C.MD5 = Hasher._createHelper(MD5);

	    /**
	     * Shortcut function to the HMAC's object interface.
	     *
	     * @param {WordArray|string} message The message to hash.
	     * @param {WordArray|string} key The secret key.
	     *
	     * @return {WordArray} The HMAC.
	     *
	     * @static
	     *
	     * @example
	     *
	     *     var hmac = CryptoJS.HmacMD5(message, key);
	     */
	    C.HmacMD5 = Hasher._createHmacHelper(MD5);
	}(Math));


	return CryptoJS.MD5;

}));
},{"./core":3}],12:[function(require,module,exports){
;(function (root, factory, undef) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"), require("./cipher-core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core", "./cipher-core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	/**
	 * Cipher Feedback block mode.
	 */
	CryptoJS.mode.CFB = (function () {
	    var CFB = CryptoJS.lib.BlockCipherMode.extend();

	    CFB.Encryptor = CFB.extend({
	        processBlock: function (words, offset) {
	            // Shortcuts
	            var cipher = this._cipher;
	            var blockSize = cipher.blockSize;

	            generateKeystreamAndEncrypt.call(this, words, offset, blockSize, cipher);

	            // Remember this block to use with next block
	            this._prevBlock = words.slice(offset, offset + blockSize);
	        }
	    });

	    CFB.Decryptor = CFB.extend({
	        processBlock: function (words, offset) {
	            // Shortcuts
	            var cipher = this._cipher;
	            var blockSize = cipher.blockSize;

	            // Remember this block to use with next block
	            var thisBlock = words.slice(offset, offset + blockSize);

	            generateKeystreamAndEncrypt.call(this, words, offset, blockSize, cipher);

	            // This block becomes the previous block
	            this._prevBlock = thisBlock;
	        }
	    });

	    function generateKeystreamAndEncrypt(words, offset, blockSize, cipher) {
	        // Shortcut
	        var iv = this._iv;

	        // Generate keystream
	        if (iv) {
	            var keystream = iv.slice(0);

	            // Remove IV for subsequent blocks
	            this._iv = undefined;
	        } else {
	            var keystream = this._prevBlock;
	        }
	        cipher.encryptBlock(keystream, 0);

	        // Encrypt
	        for (var i = 0; i < blockSize; i++) {
	            words[offset + i] ^= keystream[i];
	        }
	    }

	    return CFB;
	}());


	return CryptoJS.mode.CFB;

}));
},{"./cipher-core":2,"./core":3}],13:[function(require,module,exports){
;(function (root, factory, undef) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"), require("./cipher-core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core", "./cipher-core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	/** @preserve
	 * Counter block mode compatible with  Dr Brian Gladman fileenc.c
	 * derived from CryptoJS.mode.CTR
	 * Jan Hruby jhruby.web@gmail.com
	 */
	CryptoJS.mode.CTRGladman = (function () {
	    var CTRGladman = CryptoJS.lib.BlockCipherMode.extend();

		function incWord(word)
		{
			if (((word >> 24) & 0xff) === 0xff) { //overflow
			var b1 = (word >> 16)&0xff;
			var b2 = (word >> 8)&0xff;
			var b3 = word & 0xff;

			if (b1 === 0xff) // overflow b1
			{
			b1 = 0;
			if (b2 === 0xff)
			{
				b2 = 0;
				if (b3 === 0xff)
				{
					b3 = 0;
				}
				else
				{
					++b3;
				}
			}
			else
			{
				++b2;
			}
			}
			else
			{
			++b1;
			}

			word = 0;
			word += (b1 << 16);
			word += (b2 << 8);
			word += b3;
			}
			else
			{
			word += (0x01 << 24);
			}
			return word;
		}

		function incCounter(counter)
		{
			if ((counter[0] = incWord(counter[0])) === 0)
			{
				// encr_data in fileenc.c from  Dr Brian Gladman's counts only with DWORD j < 8
				counter[1] = incWord(counter[1]);
			}
			return counter;
		}

	    var Encryptor = CTRGladman.Encryptor = CTRGladman.extend({
	        processBlock: function (words, offset) {
	            // Shortcuts
	            var cipher = this._cipher
	            var blockSize = cipher.blockSize;
	            var iv = this._iv;
	            var counter = this._counter;

	            // Generate keystream
	            if (iv) {
	                counter = this._counter = iv.slice(0);

	                // Remove IV for subsequent blocks
	                this._iv = undefined;
	            }

				incCounter(counter);

				var keystream = counter.slice(0);
	            cipher.encryptBlock(keystream, 0);

	            // Encrypt
	            for (var i = 0; i < blockSize; i++) {
	                words[offset + i] ^= keystream[i];
	            }
	        }
	    });

	    CTRGladman.Decryptor = Encryptor;

	    return CTRGladman;
	}());




	return CryptoJS.mode.CTRGladman;

}));
},{"./cipher-core":2,"./core":3}],14:[function(require,module,exports){
;(function (root, factory, undef) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"), require("./cipher-core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core", "./cipher-core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	/**
	 * Counter block mode.
	 */
	CryptoJS.mode.CTR = (function () {
	    var CTR = CryptoJS.lib.BlockCipherMode.extend();

	    var Encryptor = CTR.Encryptor = CTR.extend({
	        processBlock: function (words, offset) {
	            // Shortcuts
	            var cipher = this._cipher
	            var blockSize = cipher.blockSize;
	            var iv = this._iv;
	            var counter = this._counter;

	            // Generate keystream
	            if (iv) {
	                counter = this._counter = iv.slice(0);

	                // Remove IV for subsequent blocks
	                this._iv = undefined;
	            }
	            var keystream = counter.slice(0);
	            cipher.encryptBlock(keystream, 0);

	            // Increment counter
	            counter[blockSize - 1] = (counter[blockSize - 1] + 1) | 0

	            // Encrypt
	            for (var i = 0; i < blockSize; i++) {
	                words[offset + i] ^= keystream[i];
	            }
	        }
	    });

	    CTR.Decryptor = Encryptor;

	    return CTR;
	}());


	return CryptoJS.mode.CTR;

}));
},{"./cipher-core":2,"./core":3}],15:[function(require,module,exports){
;(function (root, factory, undef) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"), require("./cipher-core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core", "./cipher-core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	/**
	 * Electronic Codebook block mode.
	 */
	CryptoJS.mode.ECB = (function () {
	    var ECB = CryptoJS.lib.BlockCipherMode.extend();

	    ECB.Encryptor = ECB.extend({
	        processBlock: function (words, offset) {
	            this._cipher.encryptBlock(words, offset);
	        }
	    });

	    ECB.Decryptor = ECB.extend({
	        processBlock: function (words, offset) {
	            this._cipher.decryptBlock(words, offset);
	        }
	    });

	    return ECB;
	}());


	return CryptoJS.mode.ECB;

}));
},{"./cipher-core":2,"./core":3}],16:[function(require,module,exports){
;(function (root, factory, undef) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"), require("./cipher-core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core", "./cipher-core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	/**
	 * Output Feedback block mode.
	 */
	CryptoJS.mode.OFB = (function () {
	    var OFB = CryptoJS.lib.BlockCipherMode.extend();

	    var Encryptor = OFB.Encryptor = OFB.extend({
	        processBlock: function (words, offset) {
	            // Shortcuts
	            var cipher = this._cipher
	            var blockSize = cipher.blockSize;
	            var iv = this._iv;
	            var keystream = this._keystream;

	            // Generate keystream
	            if (iv) {
	                keystream = this._keystream = iv.slice(0);

	                // Remove IV for subsequent blocks
	                this._iv = undefined;
	            }
	            cipher.encryptBlock(keystream, 0);

	            // Encrypt
	            for (var i = 0; i < blockSize; i++) {
	                words[offset + i] ^= keystream[i];
	            }
	        }
	    });

	    OFB.Decryptor = Encryptor;

	    return OFB;
	}());


	return CryptoJS.mode.OFB;

}));
},{"./cipher-core":2,"./core":3}],17:[function(require,module,exports){
;(function (root, factory, undef) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"), require("./cipher-core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core", "./cipher-core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	/**
	 * ANSI X.923 padding strategy.
	 */
	CryptoJS.pad.AnsiX923 = {
	    pad: function (data, blockSize) {
	        // Shortcuts
	        var dataSigBytes = data.sigBytes;
	        var blockSizeBytes = blockSize * 4;

	        // Count padding bytes
	        var nPaddingBytes = blockSizeBytes - dataSigBytes % blockSizeBytes;

	        // Compute last byte position
	        var lastBytePos = dataSigBytes + nPaddingBytes - 1;

	        // Pad
	        data.clamp();
	        data.words[lastBytePos >>> 2] |= nPaddingBytes << (24 - (lastBytePos % 4) * 8);
	        data.sigBytes += nPaddingBytes;
	    },

	    unpad: function (data) {
	        // Get number of padding bytes from last byte
	        var nPaddingBytes = data.words[(data.sigBytes - 1) >>> 2] & 0xff;

	        // Remove padding
	        data.sigBytes -= nPaddingBytes;
	    }
	};


	return CryptoJS.pad.Ansix923;

}));
},{"./cipher-core":2,"./core":3}],18:[function(require,module,exports){
;(function (root, factory, undef) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"), require("./cipher-core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core", "./cipher-core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	/**
	 * ISO 10126 padding strategy.
	 */
	CryptoJS.pad.Iso10126 = {
	    pad: function (data, blockSize) {
	        // Shortcut
	        var blockSizeBytes = blockSize * 4;

	        // Count padding bytes
	        var nPaddingBytes = blockSizeBytes - data.sigBytes % blockSizeBytes;

	        // Pad
	        data.concat(CryptoJS.lib.WordArray.random(nPaddingBytes - 1)).
	             concat(CryptoJS.lib.WordArray.create([nPaddingBytes << 24], 1));
	    },

	    unpad: function (data) {
	        // Get number of padding bytes from last byte
	        var nPaddingBytes = data.words[(data.sigBytes - 1) >>> 2] & 0xff;

	        // Remove padding
	        data.sigBytes -= nPaddingBytes;
	    }
	};


	return CryptoJS.pad.Iso10126;

}));
},{"./cipher-core":2,"./core":3}],19:[function(require,module,exports){
;(function (root, factory, undef) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"), require("./cipher-core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core", "./cipher-core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	/**
	 * ISO/IEC 9797-1 Padding Method 2.
	 */
	CryptoJS.pad.Iso97971 = {
	    pad: function (data, blockSize) {
	        // Add 0x80 byte
	        data.concat(CryptoJS.lib.WordArray.create([0x80000000], 1));

	        // Zero pad the rest
	        CryptoJS.pad.ZeroPadding.pad(data, blockSize);
	    },

	    unpad: function (data) {
	        // Remove zero padding
	        CryptoJS.pad.ZeroPadding.unpad(data);

	        // Remove one more byte -- the 0x80 byte
	        data.sigBytes--;
	    }
	};


	return CryptoJS.pad.Iso97971;

}));
},{"./cipher-core":2,"./core":3}],20:[function(require,module,exports){
;(function (root, factory, undef) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"), require("./cipher-core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core", "./cipher-core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	/**
	 * A noop padding strategy.
	 */
	CryptoJS.pad.NoPadding = {
	    pad: function () {
	    },

	    unpad: function () {
	    }
	};


	return CryptoJS.pad.NoPadding;

}));
},{"./cipher-core":2,"./core":3}],21:[function(require,module,exports){
;(function (root, factory, undef) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"), require("./cipher-core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core", "./cipher-core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	/**
	 * Zero padding strategy.
	 */
	CryptoJS.pad.ZeroPadding = {
	    pad: function (data, blockSize) {
	        // Shortcut
	        var blockSizeBytes = blockSize * 4;

	        // Pad
	        data.clamp();
	        data.sigBytes += blockSizeBytes - ((data.sigBytes % blockSizeBytes) || blockSizeBytes);
	    },

	    unpad: function (data) {
	        // Shortcut
	        var dataWords = data.words;

	        // Unpad
	        var i = data.sigBytes - 1;
	        while (!((dataWords[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff)) {
	            i--;
	        }
	        data.sigBytes = i + 1;
	    }
	};


	return CryptoJS.pad.ZeroPadding;

}));
},{"./cipher-core":2,"./core":3}],22:[function(require,module,exports){
;(function (root, factory, undef) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"), require("./sha1"), require("./hmac"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core", "./sha1", "./hmac"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	(function () {
	    // Shortcuts
	    var C = CryptoJS;
	    var C_lib = C.lib;
	    var Base = C_lib.Base;
	    var WordArray = C_lib.WordArray;
	    var C_algo = C.algo;
	    var SHA1 = C_algo.SHA1;
	    var HMAC = C_algo.HMAC;

	    /**
	     * Password-Based Key Derivation Function 2 algorithm.
	     */
	    var PBKDF2 = C_algo.PBKDF2 = Base.extend({
	        /**
	         * Configuration options.
	         *
	         * @property {number} keySize The key size in words to generate. Default: 4 (128 bits)
	         * @property {Hasher} hasher The hasher to use. Default: SHA1
	         * @property {number} iterations The number of iterations to perform. Default: 1
	         */
	        cfg: Base.extend({
	            keySize: 128/32,
	            hasher: SHA1,
	            iterations: 1
	        }),

	        /**
	         * Initializes a newly created key derivation function.
	         *
	         * @param {Object} cfg (Optional) The configuration options to use for the derivation.
	         *
	         * @example
	         *
	         *     var kdf = CryptoJS.algo.PBKDF2.create();
	         *     var kdf = CryptoJS.algo.PBKDF2.create({ keySize: 8 });
	         *     var kdf = CryptoJS.algo.PBKDF2.create({ keySize: 8, iterations: 1000 });
	         */
	        init: function (cfg) {
	            this.cfg = this.cfg.extend(cfg);
	        },

	        /**
	         * Computes the Password-Based Key Derivation Function 2.
	         *
	         * @param {WordArray|string} password The password.
	         * @param {WordArray|string} salt A salt.
	         *
	         * @return {WordArray} The derived key.
	         *
	         * @example
	         *
	         *     var key = kdf.compute(password, salt);
	         */
	        compute: function (password, salt) {
	            // Shortcut
	            var cfg = this.cfg;

	            // Init HMAC
	            var hmac = HMAC.create(cfg.hasher, password);

	            // Initial values
	            var derivedKey = WordArray.create();
	            var blockIndex = WordArray.create([0x00000001]);

	            // Shortcuts
	            var derivedKeyWords = derivedKey.words;
	            var blockIndexWords = blockIndex.words;
	            var keySize = cfg.keySize;
	            var iterations = cfg.iterations;

	            // Generate key
	            while (derivedKeyWords.length < keySize) {
	                var block = hmac.update(salt).finalize(blockIndex);
	                hmac.reset();

	                // Shortcuts
	                var blockWords = block.words;
	                var blockWordsLength = blockWords.length;

	                // Iterations
	                var intermediate = block;
	                for (var i = 1; i < iterations; i++) {
	                    intermediate = hmac.finalize(intermediate);
	                    hmac.reset();

	                    // Shortcut
	                    var intermediateWords = intermediate.words;

	                    // XOR intermediate with block
	                    for (var j = 0; j < blockWordsLength; j++) {
	                        blockWords[j] ^= intermediateWords[j];
	                    }
	                }

	                derivedKey.concat(block);
	                blockIndexWords[0]++;
	            }
	            derivedKey.sigBytes = keySize * 4;

	            return derivedKey;
	        }
	    });

	    /**
	     * Computes the Password-Based Key Derivation Function 2.
	     *
	     * @param {WordArray|string} password The password.
	     * @param {WordArray|string} salt A salt.
	     * @param {Object} cfg (Optional) The configuration options to use for this computation.
	     *
	     * @return {WordArray} The derived key.
	     *
	     * @static
	     *
	     * @example
	     *
	     *     var key = CryptoJS.PBKDF2(password, salt);
	     *     var key = CryptoJS.PBKDF2(password, salt, { keySize: 8 });
	     *     var key = CryptoJS.PBKDF2(password, salt, { keySize: 8, iterations: 1000 });
	     */
	    C.PBKDF2 = function (password, salt, cfg) {
	        return PBKDF2.create(cfg).compute(password, salt);
	    };
	}());


	return CryptoJS.PBKDF2;

}));
},{"./core":3,"./hmac":8,"./sha1":27}],23:[function(require,module,exports){
;(function (root, factory, undef) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"), require("./enc-base64"), require("./md5"), require("./evpkdf"), require("./cipher-core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core", "./enc-base64", "./md5", "./evpkdf", "./cipher-core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	(function () {
	    // Shortcuts
	    var C = CryptoJS;
	    var C_lib = C.lib;
	    var StreamCipher = C_lib.StreamCipher;
	    var C_algo = C.algo;

	    // Reusable objects
	    var S  = [];
	    var C_ = [];
	    var G  = [];

	    /**
	     * Rabbit stream cipher algorithm.
	     *
	     * This is a legacy version that neglected to convert the key to little-endian.
	     * This error doesn't affect the cipher's security,
	     * but it does affect its compatibility with other implementations.
	     */
	    var RabbitLegacy = C_algo.RabbitLegacy = StreamCipher.extend({
	        _doReset: function () {
	            // Shortcuts
	            var K = this._key.words;
	            var iv = this.cfg.iv;

	            // Generate initial state values
	            var X = this._X = [
	                K[0], (K[3] << 16) | (K[2] >>> 16),
	                K[1], (K[0] << 16) | (K[3] >>> 16),
	                K[2], (K[1] << 16) | (K[0] >>> 16),
	                K[3], (K[2] << 16) | (K[1] >>> 16)
	            ];

	            // Generate initial counter values
	            var C = this._C = [
	                (K[2] << 16) | (K[2] >>> 16), (K[0] & 0xffff0000) | (K[1] & 0x0000ffff),
	                (K[3] << 16) | (K[3] >>> 16), (K[1] & 0xffff0000) | (K[2] & 0x0000ffff),
	                (K[0] << 16) | (K[0] >>> 16), (K[2] & 0xffff0000) | (K[3] & 0x0000ffff),
	                (K[1] << 16) | (K[1] >>> 16), (K[3] & 0xffff0000) | (K[0] & 0x0000ffff)
	            ];

	            // Carry bit
	            this._b = 0;

	            // Iterate the system four times
	            for (var i = 0; i < 4; i++) {
	                nextState.call(this);
	            }

	            // Modify the counters
	            for (var i = 0; i < 8; i++) {
	                C[i] ^= X[(i + 4) & 7];
	            }

	            // IV setup
	            if (iv) {
	                // Shortcuts
	                var IV = iv.words;
	                var IV_0 = IV[0];
	                var IV_1 = IV[1];

	                // Generate four subvectors
	                var i0 = (((IV_0 << 8) | (IV_0 >>> 24)) & 0x00ff00ff) | (((IV_0 << 24) | (IV_0 >>> 8)) & 0xff00ff00);
	                var i2 = (((IV_1 << 8) | (IV_1 >>> 24)) & 0x00ff00ff) | (((IV_1 << 24) | (IV_1 >>> 8)) & 0xff00ff00);
	                var i1 = (i0 >>> 16) | (i2 & 0xffff0000);
	                var i3 = (i2 << 16)  | (i0 & 0x0000ffff);

	                // Modify counter values
	                C[0] ^= i0;
	                C[1] ^= i1;
	                C[2] ^= i2;
	                C[3] ^= i3;
	                C[4] ^= i0;
	                C[5] ^= i1;
	                C[6] ^= i2;
	                C[7] ^= i3;

	                // Iterate the system four times
	                for (var i = 0; i < 4; i++) {
	                    nextState.call(this);
	                }
	            }
	        },

	        _doProcessBlock: function (M, offset) {
	            // Shortcut
	            var X = this._X;

	            // Iterate the system
	            nextState.call(this);

	            // Generate four keystream words
	            S[0] = X[0] ^ (X[5] >>> 16) ^ (X[3] << 16);
	            S[1] = X[2] ^ (X[7] >>> 16) ^ (X[5] << 16);
	            S[2] = X[4] ^ (X[1] >>> 16) ^ (X[7] << 16);
	            S[3] = X[6] ^ (X[3] >>> 16) ^ (X[1] << 16);

	            for (var i = 0; i < 4; i++) {
	                // Swap endian
	                S[i] = (((S[i] << 8)  | (S[i] >>> 24)) & 0x00ff00ff) |
	                       (((S[i] << 24) | (S[i] >>> 8))  & 0xff00ff00);

	                // Encrypt
	                M[offset + i] ^= S[i];
	            }
	        },

	        blockSize: 128/32,

	        ivSize: 64/32
	    });

	    function nextState() {
	        // Shortcuts
	        var X = this._X;
	        var C = this._C;

	        // Save old counter values
	        for (var i = 0; i < 8; i++) {
	            C_[i] = C[i];
	        }

	        // Calculate new counter values
	        C[0] = (C[0] + 0x4d34d34d + this._b) | 0;
	        C[1] = (C[1] + 0xd34d34d3 + ((C[0] >>> 0) < (C_[0] >>> 0) ? 1 : 0)) | 0;
	        C[2] = (C[2] + 0x34d34d34 + ((C[1] >>> 0) < (C_[1] >>> 0) ? 1 : 0)) | 0;
	        C[3] = (C[3] + 0x4d34d34d + ((C[2] >>> 0) < (C_[2] >>> 0) ? 1 : 0)) | 0;
	        C[4] = (C[4] + 0xd34d34d3 + ((C[3] >>> 0) < (C_[3] >>> 0) ? 1 : 0)) | 0;
	        C[5] = (C[5] + 0x34d34d34 + ((C[4] >>> 0) < (C_[4] >>> 0) ? 1 : 0)) | 0;
	        C[6] = (C[6] + 0x4d34d34d + ((C[5] >>> 0) < (C_[5] >>> 0) ? 1 : 0)) | 0;
	        C[7] = (C[7] + 0xd34d34d3 + ((C[6] >>> 0) < (C_[6] >>> 0) ? 1 : 0)) | 0;
	        this._b = (C[7] >>> 0) < (C_[7] >>> 0) ? 1 : 0;

	        // Calculate the g-values
	        for (var i = 0; i < 8; i++) {
	            var gx = X[i] + C[i];

	            // Construct high and low argument for squaring
	            var ga = gx & 0xffff;
	            var gb = gx >>> 16;

	            // Calculate high and low result of squaring
	            var gh = ((((ga * ga) >>> 17) + ga * gb) >>> 15) + gb * gb;
	            var gl = (((gx & 0xffff0000) * gx) | 0) + (((gx & 0x0000ffff) * gx) | 0);

	            // High XOR low
	            G[i] = gh ^ gl;
	        }

	        // Calculate new state values
	        X[0] = (G[0] + ((G[7] << 16) | (G[7] >>> 16)) + ((G[6] << 16) | (G[6] >>> 16))) | 0;
	        X[1] = (G[1] + ((G[0] << 8)  | (G[0] >>> 24)) + G[7]) | 0;
	        X[2] = (G[2] + ((G[1] << 16) | (G[1] >>> 16)) + ((G[0] << 16) | (G[0] >>> 16))) | 0;
	        X[3] = (G[3] + ((G[2] << 8)  | (G[2] >>> 24)) + G[1]) | 0;
	        X[4] = (G[4] + ((G[3] << 16) | (G[3] >>> 16)) + ((G[2] << 16) | (G[2] >>> 16))) | 0;
	        X[5] = (G[5] + ((G[4] << 8)  | (G[4] >>> 24)) + G[3]) | 0;
	        X[6] = (G[6] + ((G[5] << 16) | (G[5] >>> 16)) + ((G[4] << 16) | (G[4] >>> 16))) | 0;
	        X[7] = (G[7] + ((G[6] << 8)  | (G[6] >>> 24)) + G[5]) | 0;
	    }

	    /**
	     * Shortcut functions to the cipher's object interface.
	     *
	     * @example
	     *
	     *     var ciphertext = CryptoJS.RabbitLegacy.encrypt(message, key, cfg);
	     *     var plaintext  = CryptoJS.RabbitLegacy.decrypt(ciphertext, key, cfg);
	     */
	    C.RabbitLegacy = StreamCipher._createHelper(RabbitLegacy);
	}());


	return CryptoJS.RabbitLegacy;

}));
},{"./cipher-core":2,"./core":3,"./enc-base64":4,"./evpkdf":6,"./md5":11}],24:[function(require,module,exports){
;(function (root, factory, undef) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"), require("./enc-base64"), require("./md5"), require("./evpkdf"), require("./cipher-core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core", "./enc-base64", "./md5", "./evpkdf", "./cipher-core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	(function () {
	    // Shortcuts
	    var C = CryptoJS;
	    var C_lib = C.lib;
	    var StreamCipher = C_lib.StreamCipher;
	    var C_algo = C.algo;

	    // Reusable objects
	    var S  = [];
	    var C_ = [];
	    var G  = [];

	    /**
	     * Rabbit stream cipher algorithm
	     */
	    var Rabbit = C_algo.Rabbit = StreamCipher.extend({
	        _doReset: function () {
	            // Shortcuts
	            var K = this._key.words;
	            var iv = this.cfg.iv;

	            // Swap endian
	            for (var i = 0; i < 4; i++) {
	                K[i] = (((K[i] << 8)  | (K[i] >>> 24)) & 0x00ff00ff) |
	                       (((K[i] << 24) | (K[i] >>> 8))  & 0xff00ff00);
	            }

	            // Generate initial state values
	            var X = this._X = [
	                K[0], (K[3] << 16) | (K[2] >>> 16),
	                K[1], (K[0] << 16) | (K[3] >>> 16),
	                K[2], (K[1] << 16) | (K[0] >>> 16),
	                K[3], (K[2] << 16) | (K[1] >>> 16)
	            ];

	            // Generate initial counter values
	            var C = this._C = [
	                (K[2] << 16) | (K[2] >>> 16), (K[0] & 0xffff0000) | (K[1] & 0x0000ffff),
	                (K[3] << 16) | (K[3] >>> 16), (K[1] & 0xffff0000) | (K[2] & 0x0000ffff),
	                (K[0] << 16) | (K[0] >>> 16), (K[2] & 0xffff0000) | (K[3] & 0x0000ffff),
	                (K[1] << 16) | (K[1] >>> 16), (K[3] & 0xffff0000) | (K[0] & 0x0000ffff)
	            ];

	            // Carry bit
	            this._b = 0;

	            // Iterate the system four times
	            for (var i = 0; i < 4; i++) {
	                nextState.call(this);
	            }

	            // Modify the counters
	            for (var i = 0; i < 8; i++) {
	                C[i] ^= X[(i + 4) & 7];
	            }

	            // IV setup
	            if (iv) {
	                // Shortcuts
	                var IV = iv.words;
	                var IV_0 = IV[0];
	                var IV_1 = IV[1];

	                // Generate four subvectors
	                var i0 = (((IV_0 << 8) | (IV_0 >>> 24)) & 0x00ff00ff) | (((IV_0 << 24) | (IV_0 >>> 8)) & 0xff00ff00);
	                var i2 = (((IV_1 << 8) | (IV_1 >>> 24)) & 0x00ff00ff) | (((IV_1 << 24) | (IV_1 >>> 8)) & 0xff00ff00);
	                var i1 = (i0 >>> 16) | (i2 & 0xffff0000);
	                var i3 = (i2 << 16)  | (i0 & 0x0000ffff);

	                // Modify counter values
	                C[0] ^= i0;
	                C[1] ^= i1;
	                C[2] ^= i2;
	                C[3] ^= i3;
	                C[4] ^= i0;
	                C[5] ^= i1;
	                C[6] ^= i2;
	                C[7] ^= i3;

	                // Iterate the system four times
	                for (var i = 0; i < 4; i++) {
	                    nextState.call(this);
	                }
	            }
	        },

	        _doProcessBlock: function (M, offset) {
	            // Shortcut
	            var X = this._X;

	            // Iterate the system
	            nextState.call(this);

	            // Generate four keystream words
	            S[0] = X[0] ^ (X[5] >>> 16) ^ (X[3] << 16);
	            S[1] = X[2] ^ (X[7] >>> 16) ^ (X[5] << 16);
	            S[2] = X[4] ^ (X[1] >>> 16) ^ (X[7] << 16);
	            S[3] = X[6] ^ (X[3] >>> 16) ^ (X[1] << 16);

	            for (var i = 0; i < 4; i++) {
	                // Swap endian
	                S[i] = (((S[i] << 8)  | (S[i] >>> 24)) & 0x00ff00ff) |
	                       (((S[i] << 24) | (S[i] >>> 8))  & 0xff00ff00);

	                // Encrypt
	                M[offset + i] ^= S[i];
	            }
	        },

	        blockSize: 128/32,

	        ivSize: 64/32
	    });

	    function nextState() {
	        // Shortcuts
	        var X = this._X;
	        var C = this._C;

	        // Save old counter values
	        for (var i = 0; i < 8; i++) {
	            C_[i] = C[i];
	        }

	        // Calculate new counter values
	        C[0] = (C[0] + 0x4d34d34d + this._b) | 0;
	        C[1] = (C[1] + 0xd34d34d3 + ((C[0] >>> 0) < (C_[0] >>> 0) ? 1 : 0)) | 0;
	        C[2] = (C[2] + 0x34d34d34 + ((C[1] >>> 0) < (C_[1] >>> 0) ? 1 : 0)) | 0;
	        C[3] = (C[3] + 0x4d34d34d + ((C[2] >>> 0) < (C_[2] >>> 0) ? 1 : 0)) | 0;
	        C[4] = (C[4] + 0xd34d34d3 + ((C[3] >>> 0) < (C_[3] >>> 0) ? 1 : 0)) | 0;
	        C[5] = (C[5] + 0x34d34d34 + ((C[4] >>> 0) < (C_[4] >>> 0) ? 1 : 0)) | 0;
	        C[6] = (C[6] + 0x4d34d34d + ((C[5] >>> 0) < (C_[5] >>> 0) ? 1 : 0)) | 0;
	        C[7] = (C[7] + 0xd34d34d3 + ((C[6] >>> 0) < (C_[6] >>> 0) ? 1 : 0)) | 0;
	        this._b = (C[7] >>> 0) < (C_[7] >>> 0) ? 1 : 0;

	        // Calculate the g-values
	        for (var i = 0; i < 8; i++) {
	            var gx = X[i] + C[i];

	            // Construct high and low argument for squaring
	            var ga = gx & 0xffff;
	            var gb = gx >>> 16;

	            // Calculate high and low result of squaring
	            var gh = ((((ga * ga) >>> 17) + ga * gb) >>> 15) + gb * gb;
	            var gl = (((gx & 0xffff0000) * gx) | 0) + (((gx & 0x0000ffff) * gx) | 0);

	            // High XOR low
	            G[i] = gh ^ gl;
	        }

	        // Calculate new state values
	        X[0] = (G[0] + ((G[7] << 16) | (G[7] >>> 16)) + ((G[6] << 16) | (G[6] >>> 16))) | 0;
	        X[1] = (G[1] + ((G[0] << 8)  | (G[0] >>> 24)) + G[7]) | 0;
	        X[2] = (G[2] + ((G[1] << 16) | (G[1] >>> 16)) + ((G[0] << 16) | (G[0] >>> 16))) | 0;
	        X[3] = (G[3] + ((G[2] << 8)  | (G[2] >>> 24)) + G[1]) | 0;
	        X[4] = (G[4] + ((G[3] << 16) | (G[3] >>> 16)) + ((G[2] << 16) | (G[2] >>> 16))) | 0;
	        X[5] = (G[5] + ((G[4] << 8)  | (G[4] >>> 24)) + G[3]) | 0;
	        X[6] = (G[6] + ((G[5] << 16) | (G[5] >>> 16)) + ((G[4] << 16) | (G[4] >>> 16))) | 0;
	        X[7] = (G[7] + ((G[6] << 8)  | (G[6] >>> 24)) + G[5]) | 0;
	    }

	    /**
	     * Shortcut functions to the cipher's object interface.
	     *
	     * @example
	     *
	     *     var ciphertext = CryptoJS.Rabbit.encrypt(message, key, cfg);
	     *     var plaintext  = CryptoJS.Rabbit.decrypt(ciphertext, key, cfg);
	     */
	    C.Rabbit = StreamCipher._createHelper(Rabbit);
	}());


	return CryptoJS.Rabbit;

}));
},{"./cipher-core":2,"./core":3,"./enc-base64":4,"./evpkdf":6,"./md5":11}],25:[function(require,module,exports){
;(function (root, factory, undef) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"), require("./enc-base64"), require("./md5"), require("./evpkdf"), require("./cipher-core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core", "./enc-base64", "./md5", "./evpkdf", "./cipher-core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	(function () {
	    // Shortcuts
	    var C = CryptoJS;
	    var C_lib = C.lib;
	    var StreamCipher = C_lib.StreamCipher;
	    var C_algo = C.algo;

	    /**
	     * RC4 stream cipher algorithm.
	     */
	    var RC4 = C_algo.RC4 = StreamCipher.extend({
	        _doReset: function () {
	            // Shortcuts
	            var key = this._key;
	            var keyWords = key.words;
	            var keySigBytes = key.sigBytes;

	            // Init sbox
	            var S = this._S = [];
	            for (var i = 0; i < 256; i++) {
	                S[i] = i;
	            }

	            // Key setup
	            for (var i = 0, j = 0; i < 256; i++) {
	                var keyByteIndex = i % keySigBytes;
	                var keyByte = (keyWords[keyByteIndex >>> 2] >>> (24 - (keyByteIndex % 4) * 8)) & 0xff;

	                j = (j + S[i] + keyByte) % 256;

	                // Swap
	                var t = S[i];
	                S[i] = S[j];
	                S[j] = t;
	            }

	            // Counters
	            this._i = this._j = 0;
	        },

	        _doProcessBlock: function (M, offset) {
	            M[offset] ^= generateKeystreamWord.call(this);
	        },

	        keySize: 256/32,

	        ivSize: 0
	    });

	    function generateKeystreamWord() {
	        // Shortcuts
	        var S = this._S;
	        var i = this._i;
	        var j = this._j;

	        // Generate keystream word
	        var keystreamWord = 0;
	        for (var n = 0; n < 4; n++) {
	            i = (i + 1) % 256;
	            j = (j + S[i]) % 256;

	            // Swap
	            var t = S[i];
	            S[i] = S[j];
	            S[j] = t;

	            keystreamWord |= S[(S[i] + S[j]) % 256] << (24 - n * 8);
	        }

	        // Update counters
	        this._i = i;
	        this._j = j;

	        return keystreamWord;
	    }

	    /**
	     * Shortcut functions to the cipher's object interface.
	     *
	     * @example
	     *
	     *     var ciphertext = CryptoJS.RC4.encrypt(message, key, cfg);
	     *     var plaintext  = CryptoJS.RC4.decrypt(ciphertext, key, cfg);
	     */
	    C.RC4 = StreamCipher._createHelper(RC4);

	    /**
	     * Modified RC4 stream cipher algorithm.
	     */
	    var RC4Drop = C_algo.RC4Drop = RC4.extend({
	        /**
	         * Configuration options.
	         *
	         * @property {number} drop The number of keystream words to drop. Default 192
	         */
	        cfg: RC4.cfg.extend({
	            drop: 192
	        }),

	        _doReset: function () {
	            RC4._doReset.call(this);

	            // Drop
	            for (var i = this.cfg.drop; i > 0; i--) {
	                generateKeystreamWord.call(this);
	            }
	        }
	    });

	    /**
	     * Shortcut functions to the cipher's object interface.
	     *
	     * @example
	     *
	     *     var ciphertext = CryptoJS.RC4Drop.encrypt(message, key, cfg);
	     *     var plaintext  = CryptoJS.RC4Drop.decrypt(ciphertext, key, cfg);
	     */
	    C.RC4Drop = StreamCipher._createHelper(RC4Drop);
	}());


	return CryptoJS.RC4;

}));
},{"./cipher-core":2,"./core":3,"./enc-base64":4,"./evpkdf":6,"./md5":11}],26:[function(require,module,exports){
;(function (root, factory) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	/** @preserve
	(c) 2012 by Cédric Mesnil. All rights reserved.

	Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

	    - Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
	    - Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

	THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
	*/

	(function (Math) {
	    // Shortcuts
	    var C = CryptoJS;
	    var C_lib = C.lib;
	    var WordArray = C_lib.WordArray;
	    var Hasher = C_lib.Hasher;
	    var C_algo = C.algo;

	    // Constants table
	    var _zl = WordArray.create([
	        0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14, 15,
	        7,  4, 13,  1, 10,  6, 15,  3, 12,  0,  9,  5,  2, 14, 11,  8,
	        3, 10, 14,  4,  9, 15,  8,  1,  2,  7,  0,  6, 13, 11,  5, 12,
	        1,  9, 11, 10,  0,  8, 12,  4, 13,  3,  7, 15, 14,  5,  6,  2,
	        4,  0,  5,  9,  7, 12,  2, 10, 14,  1,  3,  8, 11,  6, 15, 13]);
	    var _zr = WordArray.create([
	        5, 14,  7,  0,  9,  2, 11,  4, 13,  6, 15,  8,  1, 10,  3, 12,
	        6, 11,  3,  7,  0, 13,  5, 10, 14, 15,  8, 12,  4,  9,  1,  2,
	        15,  5,  1,  3,  7, 14,  6,  9, 11,  8, 12,  2, 10,  0,  4, 13,
	        8,  6,  4,  1,  3, 11, 15,  0,  5, 12,  2, 13,  9,  7, 10, 14,
	        12, 15, 10,  4,  1,  5,  8,  7,  6,  2, 13, 14,  0,  3,  9, 11]);
	    var _sl = WordArray.create([
	         11, 14, 15, 12,  5,  8,  7,  9, 11, 13, 14, 15,  6,  7,  9,  8,
	        7, 6,   8, 13, 11,  9,  7, 15,  7, 12, 15,  9, 11,  7, 13, 12,
	        11, 13,  6,  7, 14,  9, 13, 15, 14,  8, 13,  6,  5, 12,  7,  5,
	          11, 12, 14, 15, 14, 15,  9,  8,  9, 14,  5,  6,  8,  6,  5, 12,
	        9, 15,  5, 11,  6,  8, 13, 12,  5, 12, 13, 14, 11,  8,  5,  6 ]);
	    var _sr = WordArray.create([
	        8,  9,  9, 11, 13, 15, 15,  5,  7,  7,  8, 11, 14, 14, 12,  6,
	        9, 13, 15,  7, 12,  8,  9, 11,  7,  7, 12,  7,  6, 15, 13, 11,
	        9,  7, 15, 11,  8,  6,  6, 14, 12, 13,  5, 14, 13, 13,  7,  5,
	        15,  5,  8, 11, 14, 14,  6, 14,  6,  9, 12,  9, 12,  5, 15,  8,
	        8,  5, 12,  9, 12,  5, 14,  6,  8, 13,  6,  5, 15, 13, 11, 11 ]);

	    var _hl =  WordArray.create([ 0x00000000, 0x5A827999, 0x6ED9EBA1, 0x8F1BBCDC, 0xA953FD4E]);
	    var _hr =  WordArray.create([ 0x50A28BE6, 0x5C4DD124, 0x6D703EF3, 0x7A6D76E9, 0x00000000]);

	    /**
	     * RIPEMD160 hash algorithm.
	     */
	    var RIPEMD160 = C_algo.RIPEMD160 = Hasher.extend({
	        _doReset: function () {
	            this._hash  = WordArray.create([0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0]);
	        },

	        _doProcessBlock: function (M, offset) {

	            // Swap endian
	            for (var i = 0; i < 16; i++) {
	                // Shortcuts
	                var offset_i = offset + i;
	                var M_offset_i = M[offset_i];

	                // Swap
	                M[offset_i] = (
	                    (((M_offset_i << 8)  | (M_offset_i >>> 24)) & 0x00ff00ff) |
	                    (((M_offset_i << 24) | (M_offset_i >>> 8))  & 0xff00ff00)
	                );
	            }
	            // Shortcut
	            var H  = this._hash.words;
	            var hl = _hl.words;
	            var hr = _hr.words;
	            var zl = _zl.words;
	            var zr = _zr.words;
	            var sl = _sl.words;
	            var sr = _sr.words;

	            // Working variables
	            var al, bl, cl, dl, el;
	            var ar, br, cr, dr, er;

	            ar = al = H[0];
	            br = bl = H[1];
	            cr = cl = H[2];
	            dr = dl = H[3];
	            er = el = H[4];
	            // Computation
	            var t;
	            for (var i = 0; i < 80; i += 1) {
	                t = (al +  M[offset+zl[i]])|0;
	                if (i<16){
		            t +=  f1(bl,cl,dl) + hl[0];
	                } else if (i<32) {
		            t +=  f2(bl,cl,dl) + hl[1];
	                } else if (i<48) {
		            t +=  f3(bl,cl,dl) + hl[2];
	                } else if (i<64) {
		            t +=  f4(bl,cl,dl) + hl[3];
	                } else {// if (i<80) {
		            t +=  f5(bl,cl,dl) + hl[4];
	                }
	                t = t|0;
	                t =  rotl(t,sl[i]);
	                t = (t+el)|0;
	                al = el;
	                el = dl;
	                dl = rotl(cl, 10);
	                cl = bl;
	                bl = t;

	                t = (ar + M[offset+zr[i]])|0;
	                if (i<16){
		            t +=  f5(br,cr,dr) + hr[0];
	                } else if (i<32) {
		            t +=  f4(br,cr,dr) + hr[1];
	                } else if (i<48) {
		            t +=  f3(br,cr,dr) + hr[2];
	                } else if (i<64) {
		            t +=  f2(br,cr,dr) + hr[3];
	                } else {// if (i<80) {
		            t +=  f1(br,cr,dr) + hr[4];
	                }
	                t = t|0;
	                t =  rotl(t,sr[i]) ;
	                t = (t+er)|0;
	                ar = er;
	                er = dr;
	                dr = rotl(cr, 10);
	                cr = br;
	                br = t;
	            }
	            // Intermediate hash value
	            t    = (H[1] + cl + dr)|0;
	            H[1] = (H[2] + dl + er)|0;
	            H[2] = (H[3] + el + ar)|0;
	            H[3] = (H[4] + al + br)|0;
	            H[4] = (H[0] + bl + cr)|0;
	            H[0] =  t;
	        },

	        _doFinalize: function () {
	            // Shortcuts
	            var data = this._data;
	            var dataWords = data.words;

	            var nBitsTotal = this._nDataBytes * 8;
	            var nBitsLeft = data.sigBytes * 8;

	            // Add padding
	            dataWords[nBitsLeft >>> 5] |= 0x80 << (24 - nBitsLeft % 32);
	            dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 14] = (
	                (((nBitsTotal << 8)  | (nBitsTotal >>> 24)) & 0x00ff00ff) |
	                (((nBitsTotal << 24) | (nBitsTotal >>> 8))  & 0xff00ff00)
	            );
	            data.sigBytes = (dataWords.length + 1) * 4;

	            // Hash final blocks
	            this._process();

	            // Shortcuts
	            var hash = this._hash;
	            var H = hash.words;

	            // Swap endian
	            for (var i = 0; i < 5; i++) {
	                // Shortcut
	                var H_i = H[i];

	                // Swap
	                H[i] = (((H_i << 8)  | (H_i >>> 24)) & 0x00ff00ff) |
	                       (((H_i << 24) | (H_i >>> 8))  & 0xff00ff00);
	            }

	            // Return final computed hash
	            return hash;
	        },

	        clone: function () {
	            var clone = Hasher.clone.call(this);
	            clone._hash = this._hash.clone();

	            return clone;
	        }
	    });


	    function f1(x, y, z) {
	        return ((x) ^ (y) ^ (z));

	    }

	    function f2(x, y, z) {
	        return (((x)&(y)) | ((~x)&(z)));
	    }

	    function f3(x, y, z) {
	        return (((x) | (~(y))) ^ (z));
	    }

	    function f4(x, y, z) {
	        return (((x) & (z)) | ((y)&(~(z))));
	    }

	    function f5(x, y, z) {
	        return ((x) ^ ((y) |(~(z))));

	    }

	    function rotl(x,n) {
	        return (x<<n) | (x>>>(32-n));
	    }


	    /**
	     * Shortcut function to the hasher's object interface.
	     *
	     * @param {WordArray|string} message The message to hash.
	     *
	     * @return {WordArray} The hash.
	     *
	     * @static
	     *
	     * @example
	     *
	     *     var hash = CryptoJS.RIPEMD160('message');
	     *     var hash = CryptoJS.RIPEMD160(wordArray);
	     */
	    C.RIPEMD160 = Hasher._createHelper(RIPEMD160);

	    /**
	     * Shortcut function to the HMAC's object interface.
	     *
	     * @param {WordArray|string} message The message to hash.
	     * @param {WordArray|string} key The secret key.
	     *
	     * @return {WordArray} The HMAC.
	     *
	     * @static
	     *
	     * @example
	     *
	     *     var hmac = CryptoJS.HmacRIPEMD160(message, key);
	     */
	    C.HmacRIPEMD160 = Hasher._createHmacHelper(RIPEMD160);
	}(Math));


	return CryptoJS.RIPEMD160;

}));
},{"./core":3}],27:[function(require,module,exports){
;(function (root, factory) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	(function () {
	    // Shortcuts
	    var C = CryptoJS;
	    var C_lib = C.lib;
	    var WordArray = C_lib.WordArray;
	    var Hasher = C_lib.Hasher;
	    var C_algo = C.algo;

	    // Reusable object
	    var W = [];

	    /**
	     * SHA-1 hash algorithm.
	     */
	    var SHA1 = C_algo.SHA1 = Hasher.extend({
	        _doReset: function () {
	            this._hash = new WordArray.init([
	                0x67452301, 0xefcdab89,
	                0x98badcfe, 0x10325476,
	                0xc3d2e1f0
	            ]);
	        },

	        _doProcessBlock: function (M, offset) {
	            // Shortcut
	            var H = this._hash.words;

	            // Working variables
	            var a = H[0];
	            var b = H[1];
	            var c = H[2];
	            var d = H[3];
	            var e = H[4];

	            // Computation
	            for (var i = 0; i < 80; i++) {
	                if (i < 16) {
	                    W[i] = M[offset + i] | 0;
	                } else {
	                    var n = W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16];
	                    W[i] = (n << 1) | (n >>> 31);
	                }

	                var t = ((a << 5) | (a >>> 27)) + e + W[i];
	                if (i < 20) {
	                    t += ((b & c) | (~b & d)) + 0x5a827999;
	                } else if (i < 40) {
	                    t += (b ^ c ^ d) + 0x6ed9eba1;
	                } else if (i < 60) {
	                    t += ((b & c) | (b & d) | (c & d)) - 0x70e44324;
	                } else /* if (i < 80) */ {
	                    t += (b ^ c ^ d) - 0x359d3e2a;
	                }

	                e = d;
	                d = c;
	                c = (b << 30) | (b >>> 2);
	                b = a;
	                a = t;
	            }

	            // Intermediate hash value
	            H[0] = (H[0] + a) | 0;
	            H[1] = (H[1] + b) | 0;
	            H[2] = (H[2] + c) | 0;
	            H[3] = (H[3] + d) | 0;
	            H[4] = (H[4] + e) | 0;
	        },

	        _doFinalize: function () {
	            // Shortcuts
	            var data = this._data;
	            var dataWords = data.words;

	            var nBitsTotal = this._nDataBytes * 8;
	            var nBitsLeft = data.sigBytes * 8;

	            // Add padding
	            dataWords[nBitsLeft >>> 5] |= 0x80 << (24 - nBitsLeft % 32);
	            dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 14] = Math.floor(nBitsTotal / 0x100000000);
	            dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 15] = nBitsTotal;
	            data.sigBytes = dataWords.length * 4;

	            // Hash final blocks
	            this._process();

	            // Return final computed hash
	            return this._hash;
	        },

	        clone: function () {
	            var clone = Hasher.clone.call(this);
	            clone._hash = this._hash.clone();

	            return clone;
	        }
	    });

	    /**
	     * Shortcut function to the hasher's object interface.
	     *
	     * @param {WordArray|string} message The message to hash.
	     *
	     * @return {WordArray} The hash.
	     *
	     * @static
	     *
	     * @example
	     *
	     *     var hash = CryptoJS.SHA1('message');
	     *     var hash = CryptoJS.SHA1(wordArray);
	     */
	    C.SHA1 = Hasher._createHelper(SHA1);

	    /**
	     * Shortcut function to the HMAC's object interface.
	     *
	     * @param {WordArray|string} message The message to hash.
	     * @param {WordArray|string} key The secret key.
	     *
	     * @return {WordArray} The HMAC.
	     *
	     * @static
	     *
	     * @example
	     *
	     *     var hmac = CryptoJS.HmacSHA1(message, key);
	     */
	    C.HmacSHA1 = Hasher._createHmacHelper(SHA1);
	}());


	return CryptoJS.SHA1;

}));
},{"./core":3}],28:[function(require,module,exports){
;(function (root, factory, undef) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"), require("./sha256"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core", "./sha256"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	(function () {
	    // Shortcuts
	    var C = CryptoJS;
	    var C_lib = C.lib;
	    var WordArray = C_lib.WordArray;
	    var C_algo = C.algo;
	    var SHA256 = C_algo.SHA256;

	    /**
	     * SHA-224 hash algorithm.
	     */
	    var SHA224 = C_algo.SHA224 = SHA256.extend({
	        _doReset: function () {
	            this._hash = new WordArray.init([
	                0xc1059ed8, 0x367cd507, 0x3070dd17, 0xf70e5939,
	                0xffc00b31, 0x68581511, 0x64f98fa7, 0xbefa4fa4
	            ]);
	        },

	        _doFinalize: function () {
	            var hash = SHA256._doFinalize.call(this);

	            hash.sigBytes -= 4;

	            return hash;
	        }
	    });

	    /**
	     * Shortcut function to the hasher's object interface.
	     *
	     * @param {WordArray|string} message The message to hash.
	     *
	     * @return {WordArray} The hash.
	     *
	     * @static
	     *
	     * @example
	     *
	     *     var hash = CryptoJS.SHA224('message');
	     *     var hash = CryptoJS.SHA224(wordArray);
	     */
	    C.SHA224 = SHA256._createHelper(SHA224);

	    /**
	     * Shortcut function to the HMAC's object interface.
	     *
	     * @param {WordArray|string} message The message to hash.
	     * @param {WordArray|string} key The secret key.
	     *
	     * @return {WordArray} The HMAC.
	     *
	     * @static
	     *
	     * @example
	     *
	     *     var hmac = CryptoJS.HmacSHA224(message, key);
	     */
	    C.HmacSHA224 = SHA256._createHmacHelper(SHA224);
	}());


	return CryptoJS.SHA224;

}));
},{"./core":3,"./sha256":29}],29:[function(require,module,exports){
;(function (root, factory) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	(function (Math) {
	    // Shortcuts
	    var C = CryptoJS;
	    var C_lib = C.lib;
	    var WordArray = C_lib.WordArray;
	    var Hasher = C_lib.Hasher;
	    var C_algo = C.algo;

	    // Initialization and round constants tables
	    var H = [];
	    var K = [];

	    // Compute constants
	    (function () {
	        function isPrime(n) {
	            var sqrtN = Math.sqrt(n);
	            for (var factor = 2; factor <= sqrtN; factor++) {
	                if (!(n % factor)) {
	                    return false;
	                }
	            }

	            return true;
	        }

	        function getFractionalBits(n) {
	            return ((n - (n | 0)) * 0x100000000) | 0;
	        }

	        var n = 2;
	        var nPrime = 0;
	        while (nPrime < 64) {
	            if (isPrime(n)) {
	                if (nPrime < 8) {
	                    H[nPrime] = getFractionalBits(Math.pow(n, 1 / 2));
	                }
	                K[nPrime] = getFractionalBits(Math.pow(n, 1 / 3));

	                nPrime++;
	            }

	            n++;
	        }
	    }());

	    // Reusable object
	    var W = [];

	    /**
	     * SHA-256 hash algorithm.
	     */
	    var SHA256 = C_algo.SHA256 = Hasher.extend({
	        _doReset: function () {
	            this._hash = new WordArray.init(H.slice(0));
	        },

	        _doProcessBlock: function (M, offset) {
	            // Shortcut
	            var H = this._hash.words;

	            // Working variables
	            var a = H[0];
	            var b = H[1];
	            var c = H[2];
	            var d = H[3];
	            var e = H[4];
	            var f = H[5];
	            var g = H[6];
	            var h = H[7];

	            // Computation
	            for (var i = 0; i < 64; i++) {
	                if (i < 16) {
	                    W[i] = M[offset + i] | 0;
	                } else {
	                    var gamma0x = W[i - 15];
	                    var gamma0  = ((gamma0x << 25) | (gamma0x >>> 7))  ^
	                                  ((gamma0x << 14) | (gamma0x >>> 18)) ^
	                                   (gamma0x >>> 3);

	                    var gamma1x = W[i - 2];
	                    var gamma1  = ((gamma1x << 15) | (gamma1x >>> 17)) ^
	                                  ((gamma1x << 13) | (gamma1x >>> 19)) ^
	                                   (gamma1x >>> 10);

	                    W[i] = gamma0 + W[i - 7] + gamma1 + W[i - 16];
	                }

	                var ch  = (e & f) ^ (~e & g);
	                var maj = (a & b) ^ (a & c) ^ (b & c);

	                var sigma0 = ((a << 30) | (a >>> 2)) ^ ((a << 19) | (a >>> 13)) ^ ((a << 10) | (a >>> 22));
	                var sigma1 = ((e << 26) | (e >>> 6)) ^ ((e << 21) | (e >>> 11)) ^ ((e << 7)  | (e >>> 25));

	                var t1 = h + sigma1 + ch + K[i] + W[i];
	                var t2 = sigma0 + maj;

	                h = g;
	                g = f;
	                f = e;
	                e = (d + t1) | 0;
	                d = c;
	                c = b;
	                b = a;
	                a = (t1 + t2) | 0;
	            }

	            // Intermediate hash value
	            H[0] = (H[0] + a) | 0;
	            H[1] = (H[1] + b) | 0;
	            H[2] = (H[2] + c) | 0;
	            H[3] = (H[3] + d) | 0;
	            H[4] = (H[4] + e) | 0;
	            H[5] = (H[5] + f) | 0;
	            H[6] = (H[6] + g) | 0;
	            H[7] = (H[7] + h) | 0;
	        },

	        _doFinalize: function () {
	            // Shortcuts
	            var data = this._data;
	            var dataWords = data.words;

	            var nBitsTotal = this._nDataBytes * 8;
	            var nBitsLeft = data.sigBytes * 8;

	            // Add padding
	            dataWords[nBitsLeft >>> 5] |= 0x80 << (24 - nBitsLeft % 32);
	            dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 14] = Math.floor(nBitsTotal / 0x100000000);
	            dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 15] = nBitsTotal;
	            data.sigBytes = dataWords.length * 4;

	            // Hash final blocks
	            this._process();

	            // Return final computed hash
	            return this._hash;
	        },

	        clone: function () {
	            var clone = Hasher.clone.call(this);
	            clone._hash = this._hash.clone();

	            return clone;
	        }
	    });

	    /**
	     * Shortcut function to the hasher's object interface.
	     *
	     * @param {WordArray|string} message The message to hash.
	     *
	     * @return {WordArray} The hash.
	     *
	     * @static
	     *
	     * @example
	     *
	     *     var hash = CryptoJS.SHA256('message');
	     *     var hash = CryptoJS.SHA256(wordArray);
	     */
	    C.SHA256 = Hasher._createHelper(SHA256);

	    /**
	     * Shortcut function to the HMAC's object interface.
	     *
	     * @param {WordArray|string} message The message to hash.
	     * @param {WordArray|string} key The secret key.
	     *
	     * @return {WordArray} The HMAC.
	     *
	     * @static
	     *
	     * @example
	     *
	     *     var hmac = CryptoJS.HmacSHA256(message, key);
	     */
	    C.HmacSHA256 = Hasher._createHmacHelper(SHA256);
	}(Math));


	return CryptoJS.SHA256;

}));
},{"./core":3}],30:[function(require,module,exports){
;(function (root, factory, undef) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"), require("./x64-core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core", "./x64-core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	(function (Math) {
	    // Shortcuts
	    var C = CryptoJS;
	    var C_lib = C.lib;
	    var WordArray = C_lib.WordArray;
	    var Hasher = C_lib.Hasher;
	    var C_x64 = C.x64;
	    var X64Word = C_x64.Word;
	    var C_algo = C.algo;

	    // Constants tables
	    var RHO_OFFSETS = [];
	    var PI_INDEXES  = [];
	    var ROUND_CONSTANTS = [];

	    // Compute Constants
	    (function () {
	        // Compute rho offset constants
	        var x = 1, y = 0;
	        for (var t = 0; t < 24; t++) {
	            RHO_OFFSETS[x + 5 * y] = ((t + 1) * (t + 2) / 2) % 64;

	            var newX = y % 5;
	            var newY = (2 * x + 3 * y) % 5;
	            x = newX;
	            y = newY;
	        }

	        // Compute pi index constants
	        for (var x = 0; x < 5; x++) {
	            for (var y = 0; y < 5; y++) {
	                PI_INDEXES[x + 5 * y] = y + ((2 * x + 3 * y) % 5) * 5;
	            }
	        }

	        // Compute round constants
	        var LFSR = 0x01;
	        for (var i = 0; i < 24; i++) {
	            var roundConstantMsw = 0;
	            var roundConstantLsw = 0;

	            for (var j = 0; j < 7; j++) {
	                if (LFSR & 0x01) {
	                    var bitPosition = (1 << j) - 1;
	                    if (bitPosition < 32) {
	                        roundConstantLsw ^= 1 << bitPosition;
	                    } else /* if (bitPosition >= 32) */ {
	                        roundConstantMsw ^= 1 << (bitPosition - 32);
	                    }
	                }

	                // Compute next LFSR
	                if (LFSR & 0x80) {
	                    // Primitive polynomial over GF(2): x^8 + x^6 + x^5 + x^4 + 1
	                    LFSR = (LFSR << 1) ^ 0x71;
	                } else {
	                    LFSR <<= 1;
	                }
	            }

	            ROUND_CONSTANTS[i] = X64Word.create(roundConstantMsw, roundConstantLsw);
	        }
	    }());

	    // Reusable objects for temporary values
	    var T = [];
	    (function () {
	        for (var i = 0; i < 25; i++) {
	            T[i] = X64Word.create();
	        }
	    }());

	    /**
	     * SHA-3 hash algorithm.
	     */
	    var SHA3 = C_algo.SHA3 = Hasher.extend({
	        /**
	         * Configuration options.
	         *
	         * @property {number} outputLength
	         *   The desired number of bits in the output hash.
	         *   Only values permitted are: 224, 256, 384, 512.
	         *   Default: 512
	         */
	        cfg: Hasher.cfg.extend({
	            outputLength: 512
	        }),

	        _doReset: function () {
	            var state = this._state = []
	            for (var i = 0; i < 25; i++) {
	                state[i] = new X64Word.init();
	            }

	            this.blockSize = (1600 - 2 * this.cfg.outputLength) / 32;
	        },

	        _doProcessBlock: function (M, offset) {
	            // Shortcuts
	            var state = this._state;
	            var nBlockSizeLanes = this.blockSize / 2;

	            // Absorb
	            for (var i = 0; i < nBlockSizeLanes; i++) {
	                // Shortcuts
	                var M2i  = M[offset + 2 * i];
	                var M2i1 = M[offset + 2 * i + 1];

	                // Swap endian
	                M2i = (
	                    (((M2i << 8)  | (M2i >>> 24)) & 0x00ff00ff) |
	                    (((M2i << 24) | (M2i >>> 8))  & 0xff00ff00)
	                );
	                M2i1 = (
	                    (((M2i1 << 8)  | (M2i1 >>> 24)) & 0x00ff00ff) |
	                    (((M2i1 << 24) | (M2i1 >>> 8))  & 0xff00ff00)
	                );

	                // Absorb message into state
	                var lane = state[i];
	                lane.high ^= M2i1;
	                lane.low  ^= M2i;
	            }

	            // Rounds
	            for (var round = 0; round < 24; round++) {
	                // Theta
	                for (var x = 0; x < 5; x++) {
	                    // Mix column lanes
	                    var tMsw = 0, tLsw = 0;
	                    for (var y = 0; y < 5; y++) {
	                        var lane = state[x + 5 * y];
	                        tMsw ^= lane.high;
	                        tLsw ^= lane.low;
	                    }

	                    // Temporary values
	                    var Tx = T[x];
	                    Tx.high = tMsw;
	                    Tx.low  = tLsw;
	                }
	                for (var x = 0; x < 5; x++) {
	                    // Shortcuts
	                    var Tx4 = T[(x + 4) % 5];
	                    var Tx1 = T[(x + 1) % 5];
	                    var Tx1Msw = Tx1.high;
	                    var Tx1Lsw = Tx1.low;

	                    // Mix surrounding columns
	                    var tMsw = Tx4.high ^ ((Tx1Msw << 1) | (Tx1Lsw >>> 31));
	                    var tLsw = Tx4.low  ^ ((Tx1Lsw << 1) | (Tx1Msw >>> 31));
	                    for (var y = 0; y < 5; y++) {
	                        var lane = state[x + 5 * y];
	                        lane.high ^= tMsw;
	                        lane.low  ^= tLsw;
	                    }
	                }

	                // Rho Pi
	                for (var laneIndex = 1; laneIndex < 25; laneIndex++) {
	                    // Shortcuts
	                    var lane = state[laneIndex];
	                    var laneMsw = lane.high;
	                    var laneLsw = lane.low;
	                    var rhoOffset = RHO_OFFSETS[laneIndex];

	                    // Rotate lanes
	                    if (rhoOffset < 32) {
	                        var tMsw = (laneMsw << rhoOffset) | (laneLsw >>> (32 - rhoOffset));
	                        var tLsw = (laneLsw << rhoOffset) | (laneMsw >>> (32 - rhoOffset));
	                    } else /* if (rhoOffset >= 32) */ {
	                        var tMsw = (laneLsw << (rhoOffset - 32)) | (laneMsw >>> (64 - rhoOffset));
	                        var tLsw = (laneMsw << (rhoOffset - 32)) | (laneLsw >>> (64 - rhoOffset));
	                    }

	                    // Transpose lanes
	                    var TPiLane = T[PI_INDEXES[laneIndex]];
	                    TPiLane.high = tMsw;
	                    TPiLane.low  = tLsw;
	                }

	                // Rho pi at x = y = 0
	                var T0 = T[0];
	                var state0 = state[0];
	                T0.high = state0.high;
	                T0.low  = state0.low;

	                // Chi
	                for (var x = 0; x < 5; x++) {
	                    for (var y = 0; y < 5; y++) {
	                        // Shortcuts
	                        var laneIndex = x + 5 * y;
	                        var lane = state[laneIndex];
	                        var TLane = T[laneIndex];
	                        var Tx1Lane = T[((x + 1) % 5) + 5 * y];
	                        var Tx2Lane = T[((x + 2) % 5) + 5 * y];

	                        // Mix rows
	                        lane.high = TLane.high ^ (~Tx1Lane.high & Tx2Lane.high);
	                        lane.low  = TLane.low  ^ (~Tx1Lane.low  & Tx2Lane.low);
	                    }
	                }

	                // Iota
	                var lane = state[0];
	                var roundConstant = ROUND_CONSTANTS[round];
	                lane.high ^= roundConstant.high;
	                lane.low  ^= roundConstant.low;;
	            }
	        },

	        _doFinalize: function () {
	            // Shortcuts
	            var data = this._data;
	            var dataWords = data.words;
	            var nBitsTotal = this._nDataBytes * 8;
	            var nBitsLeft = data.sigBytes * 8;
	            var blockSizeBits = this.blockSize * 32;

	            // Add padding
	            dataWords[nBitsLeft >>> 5] |= 0x1 << (24 - nBitsLeft % 32);
	            dataWords[((Math.ceil((nBitsLeft + 1) / blockSizeBits) * blockSizeBits) >>> 5) - 1] |= 0x80;
	            data.sigBytes = dataWords.length * 4;

	            // Hash final blocks
	            this._process();

	            // Shortcuts
	            var state = this._state;
	            var outputLengthBytes = this.cfg.outputLength / 8;
	            var outputLengthLanes = outputLengthBytes / 8;

	            // Squeeze
	            var hashWords = [];
	            for (var i = 0; i < outputLengthLanes; i++) {
	                // Shortcuts
	                var lane = state[i];
	                var laneMsw = lane.high;
	                var laneLsw = lane.low;

	                // Swap endian
	                laneMsw = (
	                    (((laneMsw << 8)  | (laneMsw >>> 24)) & 0x00ff00ff) |
	                    (((laneMsw << 24) | (laneMsw >>> 8))  & 0xff00ff00)
	                );
	                laneLsw = (
	                    (((laneLsw << 8)  | (laneLsw >>> 24)) & 0x00ff00ff) |
	                    (((laneLsw << 24) | (laneLsw >>> 8))  & 0xff00ff00)
	                );

	                // Squeeze state to retrieve hash
	                hashWords.push(laneLsw);
	                hashWords.push(laneMsw);
	            }

	            // Return final computed hash
	            return new WordArray.init(hashWords, outputLengthBytes);
	        },

	        clone: function () {
	            var clone = Hasher.clone.call(this);

	            var state = clone._state = this._state.slice(0);
	            for (var i = 0; i < 25; i++) {
	                state[i] = state[i].clone();
	            }

	            return clone;
	        }
	    });

	    /**
	     * Shortcut function to the hasher's object interface.
	     *
	     * @param {WordArray|string} message The message to hash.
	     *
	     * @return {WordArray} The hash.
	     *
	     * @static
	     *
	     * @example
	     *
	     *     var hash = CryptoJS.SHA3('message');
	     *     var hash = CryptoJS.SHA3(wordArray);
	     */
	    C.SHA3 = Hasher._createHelper(SHA3);

	    /**
	     * Shortcut function to the HMAC's object interface.
	     *
	     * @param {WordArray|string} message The message to hash.
	     * @param {WordArray|string} key The secret key.
	     *
	     * @return {WordArray} The HMAC.
	     *
	     * @static
	     *
	     * @example
	     *
	     *     var hmac = CryptoJS.HmacSHA3(message, key);
	     */
	    C.HmacSHA3 = Hasher._createHmacHelper(SHA3);
	}(Math));


	return CryptoJS.SHA3;

}));
},{"./core":3,"./x64-core":34}],31:[function(require,module,exports){
;(function (root, factory, undef) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"), require("./x64-core"), require("./sha512"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core", "./x64-core", "./sha512"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	(function () {
	    // Shortcuts
	    var C = CryptoJS;
	    var C_x64 = C.x64;
	    var X64Word = C_x64.Word;
	    var X64WordArray = C_x64.WordArray;
	    var C_algo = C.algo;
	    var SHA512 = C_algo.SHA512;

	    /**
	     * SHA-384 hash algorithm.
	     */
	    var SHA384 = C_algo.SHA384 = SHA512.extend({
	        _doReset: function () {
	            this._hash = new X64WordArray.init([
	                new X64Word.init(0xcbbb9d5d, 0xc1059ed8), new X64Word.init(0x629a292a, 0x367cd507),
	                new X64Word.init(0x9159015a, 0x3070dd17), new X64Word.init(0x152fecd8, 0xf70e5939),
	                new X64Word.init(0x67332667, 0xffc00b31), new X64Word.init(0x8eb44a87, 0x68581511),
	                new X64Word.init(0xdb0c2e0d, 0x64f98fa7), new X64Word.init(0x47b5481d, 0xbefa4fa4)
	            ]);
	        },

	        _doFinalize: function () {
	            var hash = SHA512._doFinalize.call(this);

	            hash.sigBytes -= 16;

	            return hash;
	        }
	    });

	    /**
	     * Shortcut function to the hasher's object interface.
	     *
	     * @param {WordArray|string} message The message to hash.
	     *
	     * @return {WordArray} The hash.
	     *
	     * @static
	     *
	     * @example
	     *
	     *     var hash = CryptoJS.SHA384('message');
	     *     var hash = CryptoJS.SHA384(wordArray);
	     */
	    C.SHA384 = SHA512._createHelper(SHA384);

	    /**
	     * Shortcut function to the HMAC's object interface.
	     *
	     * @param {WordArray|string} message The message to hash.
	     * @param {WordArray|string} key The secret key.
	     *
	     * @return {WordArray} The HMAC.
	     *
	     * @static
	     *
	     * @example
	     *
	     *     var hmac = CryptoJS.HmacSHA384(message, key);
	     */
	    C.HmacSHA384 = SHA512._createHmacHelper(SHA384);
	}());


	return CryptoJS.SHA384;

}));
},{"./core":3,"./sha512":32,"./x64-core":34}],32:[function(require,module,exports){
;(function (root, factory, undef) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"), require("./x64-core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core", "./x64-core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	(function () {
	    // Shortcuts
	    var C = CryptoJS;
	    var C_lib = C.lib;
	    var Hasher = C_lib.Hasher;
	    var C_x64 = C.x64;
	    var X64Word = C_x64.Word;
	    var X64WordArray = C_x64.WordArray;
	    var C_algo = C.algo;

	    function X64Word_create() {
	        return X64Word.create.apply(X64Word, arguments);
	    }

	    // Constants
	    var K = [
	        X64Word_create(0x428a2f98, 0xd728ae22), X64Word_create(0x71374491, 0x23ef65cd),
	        X64Word_create(0xb5c0fbcf, 0xec4d3b2f), X64Word_create(0xe9b5dba5, 0x8189dbbc),
	        X64Word_create(0x3956c25b, 0xf348b538), X64Word_create(0x59f111f1, 0xb605d019),
	        X64Word_create(0x923f82a4, 0xaf194f9b), X64Word_create(0xab1c5ed5, 0xda6d8118),
	        X64Word_create(0xd807aa98, 0xa3030242), X64Word_create(0x12835b01, 0x45706fbe),
	        X64Word_create(0x243185be, 0x4ee4b28c), X64Word_create(0x550c7dc3, 0xd5ffb4e2),
	        X64Word_create(0x72be5d74, 0xf27b896f), X64Word_create(0x80deb1fe, 0x3b1696b1),
	        X64Word_create(0x9bdc06a7, 0x25c71235), X64Word_create(0xc19bf174, 0xcf692694),
	        X64Word_create(0xe49b69c1, 0x9ef14ad2), X64Word_create(0xefbe4786, 0x384f25e3),
	        X64Word_create(0x0fc19dc6, 0x8b8cd5b5), X64Word_create(0x240ca1cc, 0x77ac9c65),
	        X64Word_create(0x2de92c6f, 0x592b0275), X64Word_create(0x4a7484aa, 0x6ea6e483),
	        X64Word_create(0x5cb0a9dc, 0xbd41fbd4), X64Word_create(0x76f988da, 0x831153b5),
	        X64Word_create(0x983e5152, 0xee66dfab), X64Word_create(0xa831c66d, 0x2db43210),
	        X64Word_create(0xb00327c8, 0x98fb213f), X64Word_create(0xbf597fc7, 0xbeef0ee4),
	        X64Word_create(0xc6e00bf3, 0x3da88fc2), X64Word_create(0xd5a79147, 0x930aa725),
	        X64Word_create(0x06ca6351, 0xe003826f), X64Word_create(0x14292967, 0x0a0e6e70),
	        X64Word_create(0x27b70a85, 0x46d22ffc), X64Word_create(0x2e1b2138, 0x5c26c926),
	        X64Word_create(0x4d2c6dfc, 0x5ac42aed), X64Word_create(0x53380d13, 0x9d95b3df),
	        X64Word_create(0x650a7354, 0x8baf63de), X64Word_create(0x766a0abb, 0x3c77b2a8),
	        X64Word_create(0x81c2c92e, 0x47edaee6), X64Word_create(0x92722c85, 0x1482353b),
	        X64Word_create(0xa2bfe8a1, 0x4cf10364), X64Word_create(0xa81a664b, 0xbc423001),
	        X64Word_create(0xc24b8b70, 0xd0f89791), X64Word_create(0xc76c51a3, 0x0654be30),
	        X64Word_create(0xd192e819, 0xd6ef5218), X64Word_create(0xd6990624, 0x5565a910),
	        X64Word_create(0xf40e3585, 0x5771202a), X64Word_create(0x106aa070, 0x32bbd1b8),
	        X64Word_create(0x19a4c116, 0xb8d2d0c8), X64Word_create(0x1e376c08, 0x5141ab53),
	        X64Word_create(0x2748774c, 0xdf8eeb99), X64Word_create(0x34b0bcb5, 0xe19b48a8),
	        X64Word_create(0x391c0cb3, 0xc5c95a63), X64Word_create(0x4ed8aa4a, 0xe3418acb),
	        X64Word_create(0x5b9cca4f, 0x7763e373), X64Word_create(0x682e6ff3, 0xd6b2b8a3),
	        X64Word_create(0x748f82ee, 0x5defb2fc), X64Word_create(0x78a5636f, 0x43172f60),
	        X64Word_create(0x84c87814, 0xa1f0ab72), X64Word_create(0x8cc70208, 0x1a6439ec),
	        X64Word_create(0x90befffa, 0x23631e28), X64Word_create(0xa4506ceb, 0xde82bde9),
	        X64Word_create(0xbef9a3f7, 0xb2c67915), X64Word_create(0xc67178f2, 0xe372532b),
	        X64Word_create(0xca273ece, 0xea26619c), X64Word_create(0xd186b8c7, 0x21c0c207),
	        X64Word_create(0xeada7dd6, 0xcde0eb1e), X64Word_create(0xf57d4f7f, 0xee6ed178),
	        X64Word_create(0x06f067aa, 0x72176fba), X64Word_create(0x0a637dc5, 0xa2c898a6),
	        X64Word_create(0x113f9804, 0xbef90dae), X64Word_create(0x1b710b35, 0x131c471b),
	        X64Word_create(0x28db77f5, 0x23047d84), X64Word_create(0x32caab7b, 0x40c72493),
	        X64Word_create(0x3c9ebe0a, 0x15c9bebc), X64Word_create(0x431d67c4, 0x9c100d4c),
	        X64Word_create(0x4cc5d4be, 0xcb3e42b6), X64Word_create(0x597f299c, 0xfc657e2a),
	        X64Word_create(0x5fcb6fab, 0x3ad6faec), X64Word_create(0x6c44198c, 0x4a475817)
	    ];

	    // Reusable objects
	    var W = [];
	    (function () {
	        for (var i = 0; i < 80; i++) {
	            W[i] = X64Word_create();
	        }
	    }());

	    /**
	     * SHA-512 hash algorithm.
	     */
	    var SHA512 = C_algo.SHA512 = Hasher.extend({
	        _doReset: function () {
	            this._hash = new X64WordArray.init([
	                new X64Word.init(0x6a09e667, 0xf3bcc908), new X64Word.init(0xbb67ae85, 0x84caa73b),
	                new X64Word.init(0x3c6ef372, 0xfe94f82b), new X64Word.init(0xa54ff53a, 0x5f1d36f1),
	                new X64Word.init(0x510e527f, 0xade682d1), new X64Word.init(0x9b05688c, 0x2b3e6c1f),
	                new X64Word.init(0x1f83d9ab, 0xfb41bd6b), new X64Word.init(0x5be0cd19, 0x137e2179)
	            ]);
	        },

	        _doProcessBlock: function (M, offset) {
	            // Shortcuts
	            var H = this._hash.words;

	            var H0 = H[0];
	            var H1 = H[1];
	            var H2 = H[2];
	            var H3 = H[3];
	            var H4 = H[4];
	            var H5 = H[5];
	            var H6 = H[6];
	            var H7 = H[7];

	            var H0h = H0.high;
	            var H0l = H0.low;
	            var H1h = H1.high;
	            var H1l = H1.low;
	            var H2h = H2.high;
	            var H2l = H2.low;
	            var H3h = H3.high;
	            var H3l = H3.low;
	            var H4h = H4.high;
	            var H4l = H4.low;
	            var H5h = H5.high;
	            var H5l = H5.low;
	            var H6h = H6.high;
	            var H6l = H6.low;
	            var H7h = H7.high;
	            var H7l = H7.low;

	            // Working variables
	            var ah = H0h;
	            var al = H0l;
	            var bh = H1h;
	            var bl = H1l;
	            var ch = H2h;
	            var cl = H2l;
	            var dh = H3h;
	            var dl = H3l;
	            var eh = H4h;
	            var el = H4l;
	            var fh = H5h;
	            var fl = H5l;
	            var gh = H6h;
	            var gl = H6l;
	            var hh = H7h;
	            var hl = H7l;

	            // Rounds
	            for (var i = 0; i < 80; i++) {
	                // Shortcut
	                var Wi = W[i];

	                // Extend message
	                if (i < 16) {
	                    var Wih = Wi.high = M[offset + i * 2]     | 0;
	                    var Wil = Wi.low  = M[offset + i * 2 + 1] | 0;
	                } else {
	                    // Gamma0
	                    var gamma0x  = W[i - 15];
	                    var gamma0xh = gamma0x.high;
	                    var gamma0xl = gamma0x.low;
	                    var gamma0h  = ((gamma0xh >>> 1) | (gamma0xl << 31)) ^ ((gamma0xh >>> 8) | (gamma0xl << 24)) ^ (gamma0xh >>> 7);
	                    var gamma0l  = ((gamma0xl >>> 1) | (gamma0xh << 31)) ^ ((gamma0xl >>> 8) | (gamma0xh << 24)) ^ ((gamma0xl >>> 7) | (gamma0xh << 25));

	                    // Gamma1
	                    var gamma1x  = W[i - 2];
	                    var gamma1xh = gamma1x.high;
	                    var gamma1xl = gamma1x.low;
	                    var gamma1h  = ((gamma1xh >>> 19) | (gamma1xl << 13)) ^ ((gamma1xh << 3) | (gamma1xl >>> 29)) ^ (gamma1xh >>> 6);
	                    var gamma1l  = ((gamma1xl >>> 19) | (gamma1xh << 13)) ^ ((gamma1xl << 3) | (gamma1xh >>> 29)) ^ ((gamma1xl >>> 6) | (gamma1xh << 26));

	                    // W[i] = gamma0 + W[i - 7] + gamma1 + W[i - 16]
	                    var Wi7  = W[i - 7];
	                    var Wi7h = Wi7.high;
	                    var Wi7l = Wi7.low;

	                    var Wi16  = W[i - 16];
	                    var Wi16h = Wi16.high;
	                    var Wi16l = Wi16.low;

	                    var Wil = gamma0l + Wi7l;
	                    var Wih = gamma0h + Wi7h + ((Wil >>> 0) < (gamma0l >>> 0) ? 1 : 0);
	                    var Wil = Wil + gamma1l;
	                    var Wih = Wih + gamma1h + ((Wil >>> 0) < (gamma1l >>> 0) ? 1 : 0);
	                    var Wil = Wil + Wi16l;
	                    var Wih = Wih + Wi16h + ((Wil >>> 0) < (Wi16l >>> 0) ? 1 : 0);

	                    Wi.high = Wih;
	                    Wi.low  = Wil;
	                }

	                var chh  = (eh & fh) ^ (~eh & gh);
	                var chl  = (el & fl) ^ (~el & gl);
	                var majh = (ah & bh) ^ (ah & ch) ^ (bh & ch);
	                var majl = (al & bl) ^ (al & cl) ^ (bl & cl);

	                var sigma0h = ((ah >>> 28) | (al << 4))  ^ ((ah << 30)  | (al >>> 2)) ^ ((ah << 25) | (al >>> 7));
	                var sigma0l = ((al >>> 28) | (ah << 4))  ^ ((al << 30)  | (ah >>> 2)) ^ ((al << 25) | (ah >>> 7));
	                var sigma1h = ((eh >>> 14) | (el << 18)) ^ ((eh >>> 18) | (el << 14)) ^ ((eh << 23) | (el >>> 9));
	                var sigma1l = ((el >>> 14) | (eh << 18)) ^ ((el >>> 18) | (eh << 14)) ^ ((el << 23) | (eh >>> 9));

	                // t1 = h + sigma1 + ch + K[i] + W[i]
	                var Ki  = K[i];
	                var Kih = Ki.high;
	                var Kil = Ki.low;

	                var t1l = hl + sigma1l;
	                var t1h = hh + sigma1h + ((t1l >>> 0) < (hl >>> 0) ? 1 : 0);
	                var t1l = t1l + chl;
	                var t1h = t1h + chh + ((t1l >>> 0) < (chl >>> 0) ? 1 : 0);
	                var t1l = t1l + Kil;
	                var t1h = t1h + Kih + ((t1l >>> 0) < (Kil >>> 0) ? 1 : 0);
	                var t1l = t1l + Wil;
	                var t1h = t1h + Wih + ((t1l >>> 0) < (Wil >>> 0) ? 1 : 0);

	                // t2 = sigma0 + maj
	                var t2l = sigma0l + majl;
	                var t2h = sigma0h + majh + ((t2l >>> 0) < (sigma0l >>> 0) ? 1 : 0);

	                // Update working variables
	                hh = gh;
	                hl = gl;
	                gh = fh;
	                gl = fl;
	                fh = eh;
	                fl = el;
	                el = (dl + t1l) | 0;
	                eh = (dh + t1h + ((el >>> 0) < (dl >>> 0) ? 1 : 0)) | 0;
	                dh = ch;
	                dl = cl;
	                ch = bh;
	                cl = bl;
	                bh = ah;
	                bl = al;
	                al = (t1l + t2l) | 0;
	                ah = (t1h + t2h + ((al >>> 0) < (t1l >>> 0) ? 1 : 0)) | 0;
	            }

	            // Intermediate hash value
	            H0l = H0.low  = (H0l + al);
	            H0.high = (H0h + ah + ((H0l >>> 0) < (al >>> 0) ? 1 : 0));
	            H1l = H1.low  = (H1l + bl);
	            H1.high = (H1h + bh + ((H1l >>> 0) < (bl >>> 0) ? 1 : 0));
	            H2l = H2.low  = (H2l + cl);
	            H2.high = (H2h + ch + ((H2l >>> 0) < (cl >>> 0) ? 1 : 0));
	            H3l = H3.low  = (H3l + dl);
	            H3.high = (H3h + dh + ((H3l >>> 0) < (dl >>> 0) ? 1 : 0));
	            H4l = H4.low  = (H4l + el);
	            H4.high = (H4h + eh + ((H4l >>> 0) < (el >>> 0) ? 1 : 0));
	            H5l = H5.low  = (H5l + fl);
	            H5.high = (H5h + fh + ((H5l >>> 0) < (fl >>> 0) ? 1 : 0));
	            H6l = H6.low  = (H6l + gl);
	            H6.high = (H6h + gh + ((H6l >>> 0) < (gl >>> 0) ? 1 : 0));
	            H7l = H7.low  = (H7l + hl);
	            H7.high = (H7h + hh + ((H7l >>> 0) < (hl >>> 0) ? 1 : 0));
	        },

	        _doFinalize: function () {
	            // Shortcuts
	            var data = this._data;
	            var dataWords = data.words;

	            var nBitsTotal = this._nDataBytes * 8;
	            var nBitsLeft = data.sigBytes * 8;

	            // Add padding
	            dataWords[nBitsLeft >>> 5] |= 0x80 << (24 - nBitsLeft % 32);
	            dataWords[(((nBitsLeft + 128) >>> 10) << 5) + 30] = Math.floor(nBitsTotal / 0x100000000);
	            dataWords[(((nBitsLeft + 128) >>> 10) << 5) + 31] = nBitsTotal;
	            data.sigBytes = dataWords.length * 4;

	            // Hash final blocks
	            this._process();

	            // Convert hash to 32-bit word array before returning
	            var hash = this._hash.toX32();

	            // Return final computed hash
	            return hash;
	        },

	        clone: function () {
	            var clone = Hasher.clone.call(this);
	            clone._hash = this._hash.clone();

	            return clone;
	        },

	        blockSize: 1024/32
	    });

	    /**
	     * Shortcut function to the hasher's object interface.
	     *
	     * @param {WordArray|string} message The message to hash.
	     *
	     * @return {WordArray} The hash.
	     *
	     * @static
	     *
	     * @example
	     *
	     *     var hash = CryptoJS.SHA512('message');
	     *     var hash = CryptoJS.SHA512(wordArray);
	     */
	    C.SHA512 = Hasher._createHelper(SHA512);

	    /**
	     * Shortcut function to the HMAC's object interface.
	     *
	     * @param {WordArray|string} message The message to hash.
	     * @param {WordArray|string} key The secret key.
	     *
	     * @return {WordArray} The HMAC.
	     *
	     * @static
	     *
	     * @example
	     *
	     *     var hmac = CryptoJS.HmacSHA512(message, key);
	     */
	    C.HmacSHA512 = Hasher._createHmacHelper(SHA512);
	}());


	return CryptoJS.SHA512;

}));
},{"./core":3,"./x64-core":34}],33:[function(require,module,exports){
;(function (root, factory, undef) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"), require("./enc-base64"), require("./md5"), require("./evpkdf"), require("./cipher-core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core", "./enc-base64", "./md5", "./evpkdf", "./cipher-core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	(function () {
	    // Shortcuts
	    var C = CryptoJS;
	    var C_lib = C.lib;
	    var WordArray = C_lib.WordArray;
	    var BlockCipher = C_lib.BlockCipher;
	    var C_algo = C.algo;

	    // Permuted Choice 1 constants
	    var PC1 = [
	        57, 49, 41, 33, 25, 17, 9,  1,
	        58, 50, 42, 34, 26, 18, 10, 2,
	        59, 51, 43, 35, 27, 19, 11, 3,
	        60, 52, 44, 36, 63, 55, 47, 39,
	        31, 23, 15, 7,  62, 54, 46, 38,
	        30, 22, 14, 6,  61, 53, 45, 37,
	        29, 21, 13, 5,  28, 20, 12, 4
	    ];

	    // Permuted Choice 2 constants
	    var PC2 = [
	        14, 17, 11, 24, 1,  5,
	        3,  28, 15, 6,  21, 10,
	        23, 19, 12, 4,  26, 8,
	        16, 7,  27, 20, 13, 2,
	        41, 52, 31, 37, 47, 55,
	        30, 40, 51, 45, 33, 48,
	        44, 49, 39, 56, 34, 53,
	        46, 42, 50, 36, 29, 32
	    ];

	    // Cumulative bit shift constants
	    var BIT_SHIFTS = [1,  2,  4,  6,  8,  10, 12, 14, 15, 17, 19, 21, 23, 25, 27, 28];

	    // SBOXes and round permutation constants
	    var SBOX_P = [
	        {
	            0x0: 0x808200,
	            0x10000000: 0x8000,
	            0x20000000: 0x808002,
	            0x30000000: 0x2,
	            0x40000000: 0x200,
	            0x50000000: 0x808202,
	            0x60000000: 0x800202,
	            0x70000000: 0x800000,
	            0x80000000: 0x202,
	            0x90000000: 0x800200,
	            0xa0000000: 0x8200,
	            0xb0000000: 0x808000,
	            0xc0000000: 0x8002,
	            0xd0000000: 0x800002,
	            0xe0000000: 0x0,
	            0xf0000000: 0x8202,
	            0x8000000: 0x0,
	            0x18000000: 0x808202,
	            0x28000000: 0x8202,
	            0x38000000: 0x8000,
	            0x48000000: 0x808200,
	            0x58000000: 0x200,
	            0x68000000: 0x808002,
	            0x78000000: 0x2,
	            0x88000000: 0x800200,
	            0x98000000: 0x8200,
	            0xa8000000: 0x808000,
	            0xb8000000: 0x800202,
	            0xc8000000: 0x800002,
	            0xd8000000: 0x8002,
	            0xe8000000: 0x202,
	            0xf8000000: 0x800000,
	            0x1: 0x8000,
	            0x10000001: 0x2,
	            0x20000001: 0x808200,
	            0x30000001: 0x800000,
	            0x40000001: 0x808002,
	            0x50000001: 0x8200,
	            0x60000001: 0x200,
	            0x70000001: 0x800202,
	            0x80000001: 0x808202,
	            0x90000001: 0x808000,
	            0xa0000001: 0x800002,
	            0xb0000001: 0x8202,
	            0xc0000001: 0x202,
	            0xd0000001: 0x800200,
	            0xe0000001: 0x8002,
	            0xf0000001: 0x0,
	            0x8000001: 0x808202,
	            0x18000001: 0x808000,
	            0x28000001: 0x800000,
	            0x38000001: 0x200,
	            0x48000001: 0x8000,
	            0x58000001: 0x800002,
	            0x68000001: 0x2,
	            0x78000001: 0x8202,
	            0x88000001: 0x8002,
	            0x98000001: 0x800202,
	            0xa8000001: 0x202,
	            0xb8000001: 0x808200,
	            0xc8000001: 0x800200,
	            0xd8000001: 0x0,
	            0xe8000001: 0x8200,
	            0xf8000001: 0x808002
	        },
	        {
	            0x0: 0x40084010,
	            0x1000000: 0x4000,
	            0x2000000: 0x80000,
	            0x3000000: 0x40080010,
	            0x4000000: 0x40000010,
	            0x5000000: 0x40084000,
	            0x6000000: 0x40004000,
	            0x7000000: 0x10,
	            0x8000000: 0x84000,
	            0x9000000: 0x40004010,
	            0xa000000: 0x40000000,
	            0xb000000: 0x84010,
	            0xc000000: 0x80010,
	            0xd000000: 0x0,
	            0xe000000: 0x4010,
	            0xf000000: 0x40080000,
	            0x800000: 0x40004000,
	            0x1800000: 0x84010,
	            0x2800000: 0x10,
	            0x3800000: 0x40004010,
	            0x4800000: 0x40084010,
	            0x5800000: 0x40000000,
	            0x6800000: 0x80000,
	            0x7800000: 0x40080010,
	            0x8800000: 0x80010,
	            0x9800000: 0x0,
	            0xa800000: 0x4000,
	            0xb800000: 0x40080000,
	            0xc800000: 0x40000010,
	            0xd800000: 0x84000,
	            0xe800000: 0x40084000,
	            0xf800000: 0x4010,
	            0x10000000: 0x0,
	            0x11000000: 0x40080010,
	            0x12000000: 0x40004010,
	            0x13000000: 0x40084000,
	            0x14000000: 0x40080000,
	            0x15000000: 0x10,
	            0x16000000: 0x84010,
	            0x17000000: 0x4000,
	            0x18000000: 0x4010,
	            0x19000000: 0x80000,
	            0x1a000000: 0x80010,
	            0x1b000000: 0x40000010,
	            0x1c000000: 0x84000,
	            0x1d000000: 0x40004000,
	            0x1e000000: 0x40000000,
	            0x1f000000: 0x40084010,
	            0x10800000: 0x84010,
	            0x11800000: 0x80000,
	            0x12800000: 0x40080000,
	            0x13800000: 0x4000,
	            0x14800000: 0x40004000,
	            0x15800000: 0x40084010,
	            0x16800000: 0x10,
	            0x17800000: 0x40000000,
	            0x18800000: 0x40084000,
	            0x19800000: 0x40000010,
	            0x1a800000: 0x40004010,
	            0x1b800000: 0x80010,
	            0x1c800000: 0x0,
	            0x1d800000: 0x4010,
	            0x1e800000: 0x40080010,
	            0x1f800000: 0x84000
	        },
	        {
	            0x0: 0x104,
	            0x100000: 0x0,
	            0x200000: 0x4000100,
	            0x300000: 0x10104,
	            0x400000: 0x10004,
	            0x500000: 0x4000004,
	            0x600000: 0x4010104,
	            0x700000: 0x4010000,
	            0x800000: 0x4000000,
	            0x900000: 0x4010100,
	            0xa00000: 0x10100,
	            0xb00000: 0x4010004,
	            0xc00000: 0x4000104,
	            0xd00000: 0x10000,
	            0xe00000: 0x4,
	            0xf00000: 0x100,
	            0x80000: 0x4010100,
	            0x180000: 0x4010004,
	            0x280000: 0x0,
	            0x380000: 0x4000100,
	            0x480000: 0x4000004,
	            0x580000: 0x10000,
	            0x680000: 0x10004,
	            0x780000: 0x104,
	            0x880000: 0x4,
	            0x980000: 0x100,
	            0xa80000: 0x4010000,
	            0xb80000: 0x10104,
	            0xc80000: 0x10100,
	            0xd80000: 0x4000104,
	            0xe80000: 0x4010104,
	            0xf80000: 0x4000000,
	            0x1000000: 0x4010100,
	            0x1100000: 0x10004,
	            0x1200000: 0x10000,
	            0x1300000: 0x4000100,
	            0x1400000: 0x100,
	            0x1500000: 0x4010104,
	            0x1600000: 0x4000004,
	            0x1700000: 0x0,
	            0x1800000: 0x4000104,
	            0x1900000: 0x4000000,
	            0x1a00000: 0x4,
	            0x1b00000: 0x10100,
	            0x1c00000: 0x4010000,
	            0x1d00000: 0x104,
	            0x1e00000: 0x10104,
	            0x1f00000: 0x4010004,
	            0x1080000: 0x4000000,
	            0x1180000: 0x104,
	            0x1280000: 0x4010100,
	            0x1380000: 0x0,
	            0x1480000: 0x10004,
	            0x1580000: 0x4000100,
	            0x1680000: 0x100,
	            0x1780000: 0x4010004,
	            0x1880000: 0x10000,
	            0x1980000: 0x4010104,
	            0x1a80000: 0x10104,
	            0x1b80000: 0x4000004,
	            0x1c80000: 0x4000104,
	            0x1d80000: 0x4010000,
	            0x1e80000: 0x4,
	            0x1f80000: 0x10100
	        },
	        {
	            0x0: 0x80401000,
	            0x10000: 0x80001040,
	            0x20000: 0x401040,
	            0x30000: 0x80400000,
	            0x40000: 0x0,
	            0x50000: 0x401000,
	            0x60000: 0x80000040,
	            0x70000: 0x400040,
	            0x80000: 0x80000000,
	            0x90000: 0x400000,
	            0xa0000: 0x40,
	            0xb0000: 0x80001000,
	            0xc0000: 0x80400040,
	            0xd0000: 0x1040,
	            0xe0000: 0x1000,
	            0xf0000: 0x80401040,
	            0x8000: 0x80001040,
	            0x18000: 0x40,
	            0x28000: 0x80400040,
	            0x38000: 0x80001000,
	            0x48000: 0x401000,
	            0x58000: 0x80401040,
	            0x68000: 0x0,
	            0x78000: 0x80400000,
	            0x88000: 0x1000,
	            0x98000: 0x80401000,
	            0xa8000: 0x400000,
	            0xb8000: 0x1040,
	            0xc8000: 0x80000000,
	            0xd8000: 0x400040,
	            0xe8000: 0x401040,
	            0xf8000: 0x80000040,
	            0x100000: 0x400040,
	            0x110000: 0x401000,
	            0x120000: 0x80000040,
	            0x130000: 0x0,
	            0x140000: 0x1040,
	            0x150000: 0x80400040,
	            0x160000: 0x80401000,
	            0x170000: 0x80001040,
	            0x180000: 0x80401040,
	            0x190000: 0x80000000,
	            0x1a0000: 0x80400000,
	            0x1b0000: 0x401040,
	            0x1c0000: 0x80001000,
	            0x1d0000: 0x400000,
	            0x1e0000: 0x40,
	            0x1f0000: 0x1000,
	            0x108000: 0x80400000,
	            0x118000: 0x80401040,
	            0x128000: 0x0,
	            0x138000: 0x401000,
	            0x148000: 0x400040,
	            0x158000: 0x80000000,
	            0x168000: 0x80001040,
	            0x178000: 0x40,
	            0x188000: 0x80000040,
	            0x198000: 0x1000,
	            0x1a8000: 0x80001000,
	            0x1b8000: 0x80400040,
	            0x1c8000: 0x1040,
	            0x1d8000: 0x80401000,
	            0x1e8000: 0x400000,
	            0x1f8000: 0x401040
	        },
	        {
	            0x0: 0x80,
	            0x1000: 0x1040000,
	            0x2000: 0x40000,
	            0x3000: 0x20000000,
	            0x4000: 0x20040080,
	            0x5000: 0x1000080,
	            0x6000: 0x21000080,
	            0x7000: 0x40080,
	            0x8000: 0x1000000,
	            0x9000: 0x20040000,
	            0xa000: 0x20000080,
	            0xb000: 0x21040080,
	            0xc000: 0x21040000,
	            0xd000: 0x0,
	            0xe000: 0x1040080,
	            0xf000: 0x21000000,
	            0x800: 0x1040080,
	            0x1800: 0x21000080,
	            0x2800: 0x80,
	            0x3800: 0x1040000,
	            0x4800: 0x40000,
	            0x5800: 0x20040080,
	            0x6800: 0x21040000,
	            0x7800: 0x20000000,
	            0x8800: 0x20040000,
	            0x9800: 0x0,
	            0xa800: 0x21040080,
	            0xb800: 0x1000080,
	            0xc800: 0x20000080,
	            0xd800: 0x21000000,
	            0xe800: 0x1000000,
	            0xf800: 0x40080,
	            0x10000: 0x40000,
	            0x11000: 0x80,
	            0x12000: 0x20000000,
	            0x13000: 0x21000080,
	            0x14000: 0x1000080,
	            0x15000: 0x21040000,
	            0x16000: 0x20040080,
	            0x17000: 0x1000000,
	            0x18000: 0x21040080,
	            0x19000: 0x21000000,
	            0x1a000: 0x1040000,
	            0x1b000: 0x20040000,
	            0x1c000: 0x40080,
	            0x1d000: 0x20000080,
	            0x1e000: 0x0,
	            0x1f000: 0x1040080,
	            0x10800: 0x21000080,
	            0x11800: 0x1000000,
	            0x12800: 0x1040000,
	            0x13800: 0x20040080,
	            0x14800: 0x20000000,
	            0x15800: 0x1040080,
	            0x16800: 0x80,
	            0x17800: 0x21040000,
	            0x18800: 0x40080,
	            0x19800: 0x21040080,
	            0x1a800: 0x0,
	            0x1b800: 0x21000000,
	            0x1c800: 0x1000080,
	            0x1d800: 0x40000,
	            0x1e800: 0x20040000,
	            0x1f800: 0x20000080
	        },
	        {
	            0x0: 0x10000008,
	            0x100: 0x2000,
	            0x200: 0x10200000,
	            0x300: 0x10202008,
	            0x400: 0x10002000,
	            0x500: 0x200000,
	            0x600: 0x200008,
	            0x700: 0x10000000,
	            0x800: 0x0,
	            0x900: 0x10002008,
	            0xa00: 0x202000,
	            0xb00: 0x8,
	            0xc00: 0x10200008,
	            0xd00: 0x202008,
	            0xe00: 0x2008,
	            0xf00: 0x10202000,
	            0x80: 0x10200000,
	            0x180: 0x10202008,
	            0x280: 0x8,
	            0x380: 0x200000,
	            0x480: 0x202008,
	            0x580: 0x10000008,
	            0x680: 0x10002000,
	            0x780: 0x2008,
	            0x880: 0x200008,
	            0x980: 0x2000,
	            0xa80: 0x10002008,
	            0xb80: 0x10200008,
	            0xc80: 0x0,
	            0xd80: 0x10202000,
	            0xe80: 0x202000,
	            0xf80: 0x10000000,
	            0x1000: 0x10002000,
	            0x1100: 0x10200008,
	            0x1200: 0x10202008,
	            0x1300: 0x2008,
	            0x1400: 0x200000,
	            0x1500: 0x10000000,
	            0x1600: 0x10000008,
	            0x1700: 0x202000,
	            0x1800: 0x202008,
	            0x1900: 0x0,
	            0x1a00: 0x8,
	            0x1b00: 0x10200000,
	            0x1c00: 0x2000,
	            0x1d00: 0x10002008,
	            0x1e00: 0x10202000,
	            0x1f00: 0x200008,
	            0x1080: 0x8,
	            0x1180: 0x202000,
	            0x1280: 0x200000,
	            0x1380: 0x10000008,
	            0x1480: 0x10002000,
	            0x1580: 0x2008,
	            0x1680: 0x10202008,
	            0x1780: 0x10200000,
	            0x1880: 0x10202000,
	            0x1980: 0x10200008,
	            0x1a80: 0x2000,
	            0x1b80: 0x202008,
	            0x1c80: 0x200008,
	            0x1d80: 0x0,
	            0x1e80: 0x10000000,
	            0x1f80: 0x10002008
	        },
	        {
	            0x0: 0x100000,
	            0x10: 0x2000401,
	            0x20: 0x400,
	            0x30: 0x100401,
	            0x40: 0x2100401,
	            0x50: 0x0,
	            0x60: 0x1,
	            0x70: 0x2100001,
	            0x80: 0x2000400,
	            0x90: 0x100001,
	            0xa0: 0x2000001,
	            0xb0: 0x2100400,
	            0xc0: 0x2100000,
	            0xd0: 0x401,
	            0xe0: 0x100400,
	            0xf0: 0x2000000,
	            0x8: 0x2100001,
	            0x18: 0x0,
	            0x28: 0x2000401,
	            0x38: 0x2100400,
	            0x48: 0x100000,
	            0x58: 0x2000001,
	            0x68: 0x2000000,
	            0x78: 0x401,
	            0x88: 0x100401,
	            0x98: 0x2000400,
	            0xa8: 0x2100000,
	            0xb8: 0x100001,
	            0xc8: 0x400,
	            0xd8: 0x2100401,
	            0xe8: 0x1,
	            0xf8: 0x100400,
	            0x100: 0x2000000,
	            0x110: 0x100000,
	            0x120: 0x2000401,
	            0x130: 0x2100001,
	            0x140: 0x100001,
	            0x150: 0x2000400,
	            0x160: 0x2100400,
	            0x170: 0x100401,
	            0x180: 0x401,
	            0x190: 0x2100401,
	            0x1a0: 0x100400,
	            0x1b0: 0x1,
	            0x1c0: 0x0,
	            0x1d0: 0x2100000,
	            0x1e0: 0x2000001,
	            0x1f0: 0x400,
	            0x108: 0x100400,
	            0x118: 0x2000401,
	            0x128: 0x2100001,
	            0x138: 0x1,
	            0x148: 0x2000000,
	            0x158: 0x100000,
	            0x168: 0x401,
	            0x178: 0x2100400,
	            0x188: 0x2000001,
	            0x198: 0x2100000,
	            0x1a8: 0x0,
	            0x1b8: 0x2100401,
	            0x1c8: 0x100401,
	            0x1d8: 0x400,
	            0x1e8: 0x2000400,
	            0x1f8: 0x100001
	        },
	        {
	            0x0: 0x8000820,
	            0x1: 0x20000,
	            0x2: 0x8000000,
	            0x3: 0x20,
	            0x4: 0x20020,
	            0x5: 0x8020820,
	            0x6: 0x8020800,
	            0x7: 0x800,
	            0x8: 0x8020000,
	            0x9: 0x8000800,
	            0xa: 0x20800,
	            0xb: 0x8020020,
	            0xc: 0x820,
	            0xd: 0x0,
	            0xe: 0x8000020,
	            0xf: 0x20820,
	            0x80000000: 0x800,
	            0x80000001: 0x8020820,
	            0x80000002: 0x8000820,
	            0x80000003: 0x8000000,
	            0x80000004: 0x8020000,
	            0x80000005: 0x20800,
	            0x80000006: 0x20820,
	            0x80000007: 0x20,
	            0x80000008: 0x8000020,
	            0x80000009: 0x820,
	            0x8000000a: 0x20020,
	            0x8000000b: 0x8020800,
	            0x8000000c: 0x0,
	            0x8000000d: 0x8020020,
	            0x8000000e: 0x8000800,
	            0x8000000f: 0x20000,
	            0x10: 0x20820,
	            0x11: 0x8020800,
	            0x12: 0x20,
	            0x13: 0x800,
	            0x14: 0x8000800,
	            0x15: 0x8000020,
	            0x16: 0x8020020,
	            0x17: 0x20000,
	            0x18: 0x0,
	            0x19: 0x20020,
	            0x1a: 0x8020000,
	            0x1b: 0x8000820,
	            0x1c: 0x8020820,
	            0x1d: 0x20800,
	            0x1e: 0x820,
	            0x1f: 0x8000000,
	            0x80000010: 0x20000,
	            0x80000011: 0x800,
	            0x80000012: 0x8020020,
	            0x80000013: 0x20820,
	            0x80000014: 0x20,
	            0x80000015: 0x8020000,
	            0x80000016: 0x8000000,
	            0x80000017: 0x8000820,
	            0x80000018: 0x8020820,
	            0x80000019: 0x8000020,
	            0x8000001a: 0x8000800,
	            0x8000001b: 0x0,
	            0x8000001c: 0x20800,
	            0x8000001d: 0x820,
	            0x8000001e: 0x20020,
	            0x8000001f: 0x8020800
	        }
	    ];

	    // Masks that select the SBOX input
	    var SBOX_MASK = [
	        0xf8000001, 0x1f800000, 0x01f80000, 0x001f8000,
	        0x0001f800, 0x00001f80, 0x000001f8, 0x8000001f
	    ];

	    /**
	     * DES block cipher algorithm.
	     */
	    var DES = C_algo.DES = BlockCipher.extend({
	        _doReset: function () {
	            // Shortcuts
	            var key = this._key;
	            var keyWords = key.words;

	            // Select 56 bits according to PC1
	            var keyBits = [];
	            for (var i = 0; i < 56; i++) {
	                var keyBitPos = PC1[i] - 1;
	                keyBits[i] = (keyWords[keyBitPos >>> 5] >>> (31 - keyBitPos % 32)) & 1;
	            }

	            // Assemble 16 subkeys
	            var subKeys = this._subKeys = [];
	            for (var nSubKey = 0; nSubKey < 16; nSubKey++) {
	                // Create subkey
	                var subKey = subKeys[nSubKey] = [];

	                // Shortcut
	                var bitShift = BIT_SHIFTS[nSubKey];

	                // Select 48 bits according to PC2
	                for (var i = 0; i < 24; i++) {
	                    // Select from the left 28 key bits
	                    subKey[(i / 6) | 0] |= keyBits[((PC2[i] - 1) + bitShift) % 28] << (31 - i % 6);

	                    // Select from the right 28 key bits
	                    subKey[4 + ((i / 6) | 0)] |= keyBits[28 + (((PC2[i + 24] - 1) + bitShift) % 28)] << (31 - i % 6);
	                }

	                // Since each subkey is applied to an expanded 32-bit input,
	                // the subkey can be broken into 8 values scaled to 32-bits,
	                // which allows the key to be used without expansion
	                subKey[0] = (subKey[0] << 1) | (subKey[0] >>> 31);
	                for (var i = 1; i < 7; i++) {
	                    subKey[i] = subKey[i] >>> ((i - 1) * 4 + 3);
	                }
	                subKey[7] = (subKey[7] << 5) | (subKey[7] >>> 27);
	            }

	            // Compute inverse subkeys
	            var invSubKeys = this._invSubKeys = [];
	            for (var i = 0; i < 16; i++) {
	                invSubKeys[i] = subKeys[15 - i];
	            }
	        },

	        encryptBlock: function (M, offset) {
	            this._doCryptBlock(M, offset, this._subKeys);
	        },

	        decryptBlock: function (M, offset) {
	            this._doCryptBlock(M, offset, this._invSubKeys);
	        },

	        _doCryptBlock: function (M, offset, subKeys) {
	            // Get input
	            this._lBlock = M[offset];
	            this._rBlock = M[offset + 1];

	            // Initial permutation
	            exchangeLR.call(this, 4,  0x0f0f0f0f);
	            exchangeLR.call(this, 16, 0x0000ffff);
	            exchangeRL.call(this, 2,  0x33333333);
	            exchangeRL.call(this, 8,  0x00ff00ff);
	            exchangeLR.call(this, 1,  0x55555555);

	            // Rounds
	            for (var round = 0; round < 16; round++) {
	                // Shortcuts
	                var subKey = subKeys[round];
	                var lBlock = this._lBlock;
	                var rBlock = this._rBlock;

	                // Feistel function
	                var f = 0;
	                for (var i = 0; i < 8; i++) {
	                    f |= SBOX_P[i][((rBlock ^ subKey[i]) & SBOX_MASK[i]) >>> 0];
	                }
	                this._lBlock = rBlock;
	                this._rBlock = lBlock ^ f;
	            }

	            // Undo swap from last round
	            var t = this._lBlock;
	            this._lBlock = this._rBlock;
	            this._rBlock = t;

	            // Final permutation
	            exchangeLR.call(this, 1,  0x55555555);
	            exchangeRL.call(this, 8,  0x00ff00ff);
	            exchangeRL.call(this, 2,  0x33333333);
	            exchangeLR.call(this, 16, 0x0000ffff);
	            exchangeLR.call(this, 4,  0x0f0f0f0f);

	            // Set output
	            M[offset] = this._lBlock;
	            M[offset + 1] = this._rBlock;
	        },

	        keySize: 64/32,

	        ivSize: 64/32,

	        blockSize: 64/32
	    });

	    // Swap bits across the left and right words
	    function exchangeLR(offset, mask) {
	        var t = ((this._lBlock >>> offset) ^ this._rBlock) & mask;
	        this._rBlock ^= t;
	        this._lBlock ^= t << offset;
	    }

	    function exchangeRL(offset, mask) {
	        var t = ((this._rBlock >>> offset) ^ this._lBlock) & mask;
	        this._lBlock ^= t;
	        this._rBlock ^= t << offset;
	    }

	    /**
	     * Shortcut functions to the cipher's object interface.
	     *
	     * @example
	     *
	     *     var ciphertext = CryptoJS.DES.encrypt(message, key, cfg);
	     *     var plaintext  = CryptoJS.DES.decrypt(ciphertext, key, cfg);
	     */
	    C.DES = BlockCipher._createHelper(DES);

	    /**
	     * Triple-DES block cipher algorithm.
	     */
	    var TripleDES = C_algo.TripleDES = BlockCipher.extend({
	        _doReset: function () {
	            // Shortcuts
	            var key = this._key;
	            var keyWords = key.words;

	            // Create DES instances
	            this._des1 = DES.createEncryptor(WordArray.create(keyWords.slice(0, 2)));
	            this._des2 = DES.createEncryptor(WordArray.create(keyWords.slice(2, 4)));
	            this._des3 = DES.createEncryptor(WordArray.create(keyWords.slice(4, 6)));
	        },

	        encryptBlock: function (M, offset) {
	            this._des1.encryptBlock(M, offset);
	            this._des2.decryptBlock(M, offset);
	            this._des3.encryptBlock(M, offset);
	        },

	        decryptBlock: function (M, offset) {
	            this._des3.decryptBlock(M, offset);
	            this._des2.encryptBlock(M, offset);
	            this._des1.decryptBlock(M, offset);
	        },

	        keySize: 192/32,

	        ivSize: 64/32,

	        blockSize: 64/32
	    });

	    /**
	     * Shortcut functions to the cipher's object interface.
	     *
	     * @example
	     *
	     *     var ciphertext = CryptoJS.TripleDES.encrypt(message, key, cfg);
	     *     var plaintext  = CryptoJS.TripleDES.decrypt(ciphertext, key, cfg);
	     */
	    C.TripleDES = BlockCipher._createHelper(TripleDES);
	}());


	return CryptoJS.TripleDES;

}));
},{"./cipher-core":2,"./core":3,"./enc-base64":4,"./evpkdf":6,"./md5":11}],34:[function(require,module,exports){
;(function (root, factory) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("./core"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["./core"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	(function (undefined) {
	    // Shortcuts
	    var C = CryptoJS;
	    var C_lib = C.lib;
	    var Base = C_lib.Base;
	    var X32WordArray = C_lib.WordArray;

	    /**
	     * x64 namespace.
	     */
	    var C_x64 = C.x64 = {};

	    /**
	     * A 64-bit word.
	     */
	    var X64Word = C_x64.Word = Base.extend({
	        /**
	         * Initializes a newly created 64-bit word.
	         *
	         * @param {number} high The high 32 bits.
	         * @param {number} low The low 32 bits.
	         *
	         * @example
	         *
	         *     var x64Word = CryptoJS.x64.Word.create(0x00010203, 0x04050607);
	         */
	        init: function (high, low) {
	            this.high = high;
	            this.low = low;
	        }

	        /**
	         * Bitwise NOTs this word.
	         *
	         * @return {X64Word} A new x64-Word object after negating.
	         *
	         * @example
	         *
	         *     var negated = x64Word.not();
	         */
	        // not: function () {
	            // var high = ~this.high;
	            // var low = ~this.low;

	            // return X64Word.create(high, low);
	        // },

	        /**
	         * Bitwise ANDs this word with the passed word.
	         *
	         * @param {X64Word} word The x64-Word to AND with this word.
	         *
	         * @return {X64Word} A new x64-Word object after ANDing.
	         *
	         * @example
	         *
	         *     var anded = x64Word.and(anotherX64Word);
	         */
	        // and: function (word) {
	            // var high = this.high & word.high;
	            // var low = this.low & word.low;

	            // return X64Word.create(high, low);
	        // },

	        /**
	         * Bitwise ORs this word with the passed word.
	         *
	         * @param {X64Word} word The x64-Word to OR with this word.
	         *
	         * @return {X64Word} A new x64-Word object after ORing.
	         *
	         * @example
	         *
	         *     var ored = x64Word.or(anotherX64Word);
	         */
	        // or: function (word) {
	            // var high = this.high | word.high;
	            // var low = this.low | word.low;

	            // return X64Word.create(high, low);
	        // },

	        /**
	         * Bitwise XORs this word with the passed word.
	         *
	         * @param {X64Word} word The x64-Word to XOR with this word.
	         *
	         * @return {X64Word} A new x64-Word object after XORing.
	         *
	         * @example
	         *
	         *     var xored = x64Word.xor(anotherX64Word);
	         */
	        // xor: function (word) {
	            // var high = this.high ^ word.high;
	            // var low = this.low ^ word.low;

	            // return X64Word.create(high, low);
	        // },

	        /**
	         * Shifts this word n bits to the left.
	         *
	         * @param {number} n The number of bits to shift.
	         *
	         * @return {X64Word} A new x64-Word object after shifting.
	         *
	         * @example
	         *
	         *     var shifted = x64Word.shiftL(25);
	         */
	        // shiftL: function (n) {
	            // if (n < 32) {
	                // var high = (this.high << n) | (this.low >>> (32 - n));
	                // var low = this.low << n;
	            // } else {
	                // var high = this.low << (n - 32);
	                // var low = 0;
	            // }

	            // return X64Word.create(high, low);
	        // },

	        /**
	         * Shifts this word n bits to the right.
	         *
	         * @param {number} n The number of bits to shift.
	         *
	         * @return {X64Word} A new x64-Word object after shifting.
	         *
	         * @example
	         *
	         *     var shifted = x64Word.shiftR(7);
	         */
	        // shiftR: function (n) {
	            // if (n < 32) {
	                // var low = (this.low >>> n) | (this.high << (32 - n));
	                // var high = this.high >>> n;
	            // } else {
	                // var low = this.high >>> (n - 32);
	                // var high = 0;
	            // }

	            // return X64Word.create(high, low);
	        // },

	        /**
	         * Rotates this word n bits to the left.
	         *
	         * @param {number} n The number of bits to rotate.
	         *
	         * @return {X64Word} A new x64-Word object after rotating.
	         *
	         * @example
	         *
	         *     var rotated = x64Word.rotL(25);
	         */
	        // rotL: function (n) {
	            // return this.shiftL(n).or(this.shiftR(64 - n));
	        // },

	        /**
	         * Rotates this word n bits to the right.
	         *
	         * @param {number} n The number of bits to rotate.
	         *
	         * @return {X64Word} A new x64-Word object after rotating.
	         *
	         * @example
	         *
	         *     var rotated = x64Word.rotR(7);
	         */
	        // rotR: function (n) {
	            // return this.shiftR(n).or(this.shiftL(64 - n));
	        // },

	        /**
	         * Adds this word with the passed word.
	         *
	         * @param {X64Word} word The x64-Word to add with this word.
	         *
	         * @return {X64Word} A new x64-Word object after adding.
	         *
	         * @example
	         *
	         *     var added = x64Word.add(anotherX64Word);
	         */
	        // add: function (word) {
	            // var low = (this.low + word.low) | 0;
	            // var carry = (low >>> 0) < (this.low >>> 0) ? 1 : 0;
	            // var high = (this.high + word.high + carry) | 0;

	            // return X64Word.create(high, low);
	        // }
	    });

	    /**
	     * An array of 64-bit words.
	     *
	     * @property {Array} words The array of CryptoJS.x64.Word objects.
	     * @property {number} sigBytes The number of significant bytes in this word array.
	     */
	    var X64WordArray = C_x64.WordArray = Base.extend({
	        /**
	         * Initializes a newly created word array.
	         *
	         * @param {Array} words (Optional) An array of CryptoJS.x64.Word objects.
	         * @param {number} sigBytes (Optional) The number of significant bytes in the words.
	         *
	         * @example
	         *
	         *     var wordArray = CryptoJS.x64.WordArray.create();
	         *
	         *     var wordArray = CryptoJS.x64.WordArray.create([
	         *         CryptoJS.x64.Word.create(0x00010203, 0x04050607),
	         *         CryptoJS.x64.Word.create(0x18191a1b, 0x1c1d1e1f)
	         *     ]);
	         *
	         *     var wordArray = CryptoJS.x64.WordArray.create([
	         *         CryptoJS.x64.Word.create(0x00010203, 0x04050607),
	         *         CryptoJS.x64.Word.create(0x18191a1b, 0x1c1d1e1f)
	         *     ], 10);
	         */
	        init: function (words, sigBytes) {
	            words = this.words = words || [];

	            if (sigBytes != undefined) {
	                this.sigBytes = sigBytes;
	            } else {
	                this.sigBytes = words.length * 8;
	            }
	        },

	        /**
	         * Converts this 64-bit word array to a 32-bit word array.
	         *
	         * @return {CryptoJS.lib.WordArray} This word array's data as a 32-bit word array.
	         *
	         * @example
	         *
	         *     var x32WordArray = x64WordArray.toX32();
	         */
	        toX32: function () {
	            // Shortcuts
	            var x64Words = this.words;
	            var x64WordsLength = x64Words.length;

	            // Convert
	            var x32Words = [];
	            for (var i = 0; i < x64WordsLength; i++) {
	                var x64Word = x64Words[i];
	                x32Words.push(x64Word.high);
	                x32Words.push(x64Word.low);
	            }

	            return X32WordArray.create(x32Words, this.sigBytes);
	        },

	        /**
	         * Creates a copy of this word array.
	         *
	         * @return {X64WordArray} The clone.
	         *
	         * @example
	         *
	         *     var clone = x64WordArray.clone();
	         */
	        clone: function () {
	            var clone = Base.clone.call(this);

	            // Clone "words" array
	            var words = clone.words = this.words.slice(0);

	            // Clone each X64Word object
	            var wordsLength = words.length;
	            for (var i = 0; i < wordsLength; i++) {
	                words[i] = words[i].clone();
	            }

	            return clone;
	        }
	    });
	}());


	return CryptoJS;

}));
},{"./core":3}],35:[function(require,module,exports){
function GlobalFunctions(){
    let CryptoJS = require("crypto-js");
    let global = {};

    global.db = null;
    global.debug_mode = true;
    global.secret = "";
    global.osname = "web";
    global.appVersion = "1.0.0";
    global.correctionTime = 0;

    global.NotiHandle = null;

    global.lastmsginfo = {};

    global.removereadcnt = 0;
    global.lastreadkey = null;

    let lastSeqID = {};

    global.CONST = {
        //log_msg.transferStatus

        CHAT_TRANSFER_NONE:     'none',
        CHAT_TRANSFER_SUCCESS:  'success',
        CHAT_TRANSFER_FAILED:   'failed',
        CHAT_TRANSFER_SENDING:  'sending',

        //log_msg.replyDeliveredStatus, msg_to_member.DeliveredStatus
        CHAT_DELIVERY_NONE: 0,

        CHAT_DELIVERY_DISPLAYED: 1,
        //log_msg.MsgType
        CHAT_TYPE_NONE:         'none',
        CHAT_TYPE_TEXT:         'text',
        CHAT_TYPE_IMAGE:        'image',
        CHAT_TYPE_VIDEO:        'video',
        CHAT_TYPE_DOC:          'doc',
        CHAT_TYPE_NOTE:         'note',

        CHAT_TYPE_MUSIC:        'music',
        CHAT_TYPE_VOICE:        'voice',
        CHAT_TYPE_MAP:          'map',
        CHAT_TYPE_CONTACTS:     'contacts',

        CHAT_TYPE_INVITE:       'invite',
        CHAT_TYPE_EXIT:         'exit',
        CHAT_TYPE_KICK:         'kick',

        CHAT_TYPE_CONF:   		'vconf',

        CHAT_TYPE_INFO:         'info',
        CHAT_TYPE_GROUP_NOTICE: 'group-notice',




        //favorite.dataType
        FAVORITE_MEMBER_TYPE:	'M',   //member
        FAVORITE_GROUP_TYPE:	'G',    //group
        FAVORITE_AVAIL_TYPE:	'A',    //항당 가능 상태.
        FAVORITE_NONE_TYPE:		'N',     //할당 불가능. 추후 slot 나누기 기능이 들어가는 경우 A로 변경가능하도록 수정예정.

        //uc_group.groupType
        GROUP_TYPE_TENANT:	'T',
        GROUP_TYPE_USER:	'U',
        GROUP_TYPE_HIDDEN:	'H',
    };

    ////////////////////////////////////////////////////////////////////////////
    /// main peerconnection info
    global.mainpeerconnection = null;
    global.mainlocalstream = null;
    global.mainremotestream = null;
    global.peerIM = null;
    global.confid = null;

    global.setPeerconnection = function(handle){
        global.mainpeerconnection = handle;
    };

    global.getPeerconnection = function(){
        return global.mainpeerconnection;
    };

    global.setMainLocalStream = function(stream){
        global.mainlocalstream = stream;
    };

    global.getMainLocalStream = function(){
        return global.mainlocalstream;
    };

    global.setMainRemoteStream = function(stream){
        global.mainremotestream = stream;
    };

    global.getMainRemoteStream = function(){
        return global.mainremotestream;
    };

    global.setPeerIM = function(peerIM){
        global.peerIM = peerIM;
    }

    global.getPeerIM = function(){
        return global.peerIM;
    }

    global.setConfID = function(confid){
        global.confid = confid;
    }

    global.getConfID = function(){
        return global.confid;
    }

    ////////////////////////////////////////////////////////////////////////////
    /// property info
    global.getMyID = function(){
        return global.getEncData('myProfile.id');
    };

    global.setMyID = function(id){
        if ( id !== undefined){
    		global.setEncData('myProfile.id', id);
            let myID = id;
            if(id.indexOf('@')>0){
            	global.setEncData('myProfile.domain', id.split('@')[1]);
            }
    	}
    };

    global.getMyName = function(){
        let myName = global.getEncData('myProfile.name');
        return myName;
    };
    global.setMyName = function(name){
		//encrypt
		global.setEncData('myProfile.name', name);
    };

    global.getOsname = function(){
        return global.osname;
    };

    global.setOsname = function(osname){
        global.osname = osname;
    };

    global.getVersion = function(){
        return global.appVersion;
    };

    global.setVersion = function(version){
        global.version = version;
    };

    global.setLastSeqID = function(cmdClassName, seqID){
        if(seqID===0){
            seqID = '';
        }
        lastSeqID[cmdClassName] = seqID;
        GLOBAL.setEncData(cmdClassName, seqID);
    };

    global.getLastSeqID = function(cmdClassName){
        let seqID = '';
        seqID = lastSeqID[cmdClassName];
        if(seqID===undefined||seqID===null){
            seqID = GLOBAL.getEncData(cmdClassName);
            lastSeqID[cmdClassName] = seqID;
        }

        return seqID;
    };

    ////////////////////////////////////////////////////////////////////////////
    /// ID Generator
    global.genGroupID = function(){
        return 'G' + global.md5HexDigest(global.getMyID() + global.createUUID());
    };

    global.genListID = function(){
        return 'L' + global.md5HexDigest(global.getMyID() + global.createUUID());
    };

    global.genMsgID = function(){
        return 'M' + global.md5HexDigest(global.getMyID() + global.createUUID());
    };

    global.genUniqueID = function(){
        return 'U' + global.md5HexDigest(global.getMyID() + global.createUUID());
    };

    global.genConferenceID = function(){
        return 'C' + global.md5HexDigest(global.getMyID() + global.createUUID());
    };

    global.genBoardID = function(){
        return 'B' + global.md5HexDigest(global.getMyID() + global.createUUID());
    };

    global.genBoardMsgID = function(){
        return 'P' + global.md5HexDigest(global.getMyID() + global.createUUID());
    };

    global.genContentID = function(){
        return 'T' + global.md5HexDigest(global.getMyID() + global.createUUID());
    };

    global.genReplyID = function(){
        return 'R' + global.md5HexDigest(global.getMyID() + global.createUUID());
    };

    global.genMinutesID = function(){
        return 'K' + global.md5HexDigest(global.getMyID() + global.createUUID());
    };

    global.genNotesID = function(){
        return 'N' + global.md5HexDigest(global.getMyID() + global.createUUID());
    };

    global.genConferenceMode = function(){
        return 'xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
            return v.toString(16);
        });
    };
    ////////////////////////////////////////////////////////////////////////////
    /// LOG
    global.debug = function(s){
        if(global.debug_mode){
            var timeString = new Date(new Date() - global.correctionTime).toISOString();
            console.debug("[" + timeString +"] " + s);
            timeString = null;
        }
    };

    global.info = function(s){
        if(global.debug_mode){
            var timeString = new Date(new Date() - global.correctionTime).toISOString();
            console.info("[" + timeString +"] " + s);
            timeString = null;
        }
    };

    global.error = function(s){
        if(global.debug_mode){
            var timeString = new Date(new Date() - global.correctionTime).toISOString();
            console.error("[" + timeString +"] " + s);
            timeString = null;
        }
    };

    global.warning = function(s){
        if(global.debug_mode){
            var timeString = new Date(new Date() - global.correctionTime).toISOString();
            console.warn("[" + timeString +"] " + s);
            timeString = null;
        }
    };

    ////////////////////////////////////////////////////////////////////////////
    /// time util function
    global.getTimeString = function() {
        return new Date().toISOString();
    };

    global.setCorrectionTime = function(value){
        global.correctionTime = value;
    };

    global.getCorrectionTime = function(){
        return global.correctionTime;
    };

    ////////////////////////////////////////////////////////////////////////////
    /// util function
    global.decimalToHex = function(decimal, padding){
        var hex = Number(decimal).toString(16);
        padding = typeof (padding) === "undefined" || padding === null ? padding = 2 : padding;

        while (hex.length < padding) {
            hex = '0' + hex;
        }

        return hex;
    };

    global.clone = function(o) {
        if(!o || 'object' !== typeof o){
            return o;
        }
        var c = 'function' === typeof o.pop ? [] : {};

        var p, v;
        for(p in o) {
            if(o.hasOwnProperty(p)) {
                v = o[p];
                if(v && 'object' === typeof v) {
                    c[p] = global.clone(v);
                }
                else {
                    c[p] = v;
                }
            }
        }
        return c;
    };

    global.objectMerge = function(a, b) {
        var o = global.clone(a);

        var keys = Object.keys(b);
        var vals = [];
        keys.forEach(function (item) {
            o[item] = b[item];
        });

        return o;
    };

    global.compareObject = function(a, b) {
        if((!a || 'object' !== typeof a)||(!b || 'object' !== typeof b)){
            return false;
        }

        var keys = Object.keys(a);
        for(var i=0, n=keys.length ; i<n ; i++){
            if(a[keys[i]] != b[keys[i]]){
                if('object' === typeof a[keys[i]]){
                    if(global.compareObject(a[keys[i]], b[keys[i]])){
                        continue;
                    }
                }
                return false;
            }
        }

        return true;
    };

    global.objectIntersection = function(a, b) {
        var o = {};

        var keys = Object.keys(b);
        var vals = [];
        keys.forEach(function (item) {
            if(a[item] !== undefined){
                 o[item] = a[item];
            }
        });

        return o;
    };


    global.copyArray = function(a, b) {
        for(var i=0, n=b.length ; i<n ; i++){
            a.push(b[i]);
        }

        return a;
    };

    global.transStrToObj = function(str){
        var object = {};
        try{
            if(typeof str == 'string'){
                object = JSON.parse(str.replace(/'/g, '\"'));
            }
            else{
                object = str;
            }
        }
        catch(error){
            global.error('transStrToObj error=' + error);
        }

        return object;
    };
    global.transObjToStr = function(obj){
        if(obj!=null){
            try{
            if(typeof obj == 'object'){
                var value = JSON.stringify(obj);
                value = value.replace(/"/g, '\'');
                return value;
            }
            else{
                return obj;
            }
            }
            catch(error){
                global.error('transObjToStr error=' + error);
                return '';
            }
        }
        return '';
    };

    ////////////////////////////////////////////////////////////////////////////
    /// Security
    global.getEncData = function(key){
        var result = sessionStorage.getItem(key);
		if(result!==undefined&&result!==null){
			result = global.decryptString(result, 'efY6sccR0eQBEgq0E6XKtyTJ5qXZHGR7JKsLH');
		}
        return result;
    };

    global.getAutoComplete = function(key, data){
        var result = localStorage.getItem(key);
		if(result!==undefined&&result!==null){
			result = global.decryptString(result, 'efY6sccR0eQBEgq0E6XKtyTJ5qXZHGR7JKsLH');
		}
        return result;
    };

    global.setEncData = function(key, data){
        var enc_data = global.encryptString(data, 'efY6sccR0eQBEgq0E6XKtyTJ5qXZHGR7JKsLH');
		sessionStorage.setItem(key, enc_data);
    };

    global.setAutoComplete = function(key, data){
        var enc_data = global.encryptString(data, 'efY6sccR0eQBEgq0E6XKtyTJ5qXZHGR7JKsLH');
		localStorage.setItem(key, enc_data);
    };

    global.encryptString = function(text, secret){
        if(secret==undefined){
            secret = global.getEncData('HA1'); //global.secret;
        }
        var encrypted = CryptoJS.AES.encrypt(text, secret);
        return encrypted.toString();
    };

    global.decryptString = function(cipher, secret){
        if(secret==undefined){
            secret = global.getEncData('HA1'); //global.secret;
        }

        var message;
        try{
            var decryptString = CryptoJS.AES.decrypt(cipher, secret);
            message = decryptString.toString(CryptoJS.enc.Utf8);
        }
        catch(error){
            global.warning('decryptString cipher=' + cipher + ', error=' + error);
            message = cipher;
        }

        return message;
    };

    global.encryptString2 = function(text, saltOrg){
        var key = CryptoJS.PBKDF2('nablecomm:BeeUC', CryptoJS.MD5(saltOrg), { keySize: 128/32, iterations: 100 });
        var encrypted = CryptoJS.AES.encrypt(text, key,{ iv: CryptoJS.MD5('roundee.com')});
        return encrypted.ciphertext.toString(CryptoJS.enc.Base64);
    };

    global.decryptString2 = function(cipher, saltOrg){
        var key = CryptoJS.PBKDF2('nablecomm:BeeUC', CryptoJS.MD5(saltOrg), { keySize: 128/32, iterations: 100 });
        var cipherParams = CryptoJS.lib.CipherParams.create({
            ciphertext: CryptoJS.enc.Base64.parse(cipher)
        });
        var decrypted = CryptoJS.AES.decrypt(cipherParams, key, { iv: CryptoJS.MD5('roundee.com') });
        return decrypted.toString(CryptoJS.enc.Utf8);
    };

    global.base64encode = function(str){
		var words = CryptoJS.enc.Utf8.parse(str); // WordArray object
		return CryptoJS.enc.Base64.stringify(words); // string: 'SGVsbG8gd29ybGQ='
	};

	global.base64decode = function(str){
		var words = CryptoJS.enc.Base64.parse(str);
		return CryptoJS.enc.Utf8.stringify(words);
	};

	global.md5HexDigest = function(str){
		return CryptoJS.MD5(str);
	};

    global.createUUID = function(){
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
            return v.toString(16);
        });
    };

    global.secret = global.getEncData('HA1');

    global.base64 = {
        /**
        * Converts a word array to a Base64 string.
        *
        * @param {WordArray} wordArray The word array.
        *
        * @return {string} The Base64 string.
        *
        * @static
        *
        * @example
        *
        *     var base64String = CryptoJS.enc.Base64.stringify(wordArray);
        */
        stringify: function (wordArray) {
            // Shortcuts
            var words = wordArray.words;
            var sigBytes = wordArray.sigBytes;
            var map = this._map;

            // Clamp excess bits
            wordArray.clamp();

            // Convert
            var base64Chars = [];
            for (var i = 0; i < sigBytes; i += 3) {
                var byte1 = (words[i >>> 2]       >>> (24 - (i % 4) * 8))       & 0xff;
                var byte2 = (words[(i + 1) >>> 2] >>> (24 - ((i + 1) % 4) * 8)) & 0xff;
                var byte3 = (words[(i + 2) >>> 2] >>> (24 - ((i + 2) % 4) * 8)) & 0xff;

                var triplet = (byte1 << 16) | (byte2 << 8) | byte3;

                for (var j = 0; (j < 4) && (i + j * 0.75 < sigBytes); j++) {
                    base64Chars.push(map.charAt((triplet >>> (6 * (3 - j))) & 0x3f));
                }
            }

            // Add padding
            var paddingChar = map.charAt(64);
            if (paddingChar) {
                while (base64Chars.length % 4) {
                    base64Chars.push(paddingChar);
                }
            }

            return base64Chars.join('');
        },

        /**
        * Converts a Base64 string to a word array.
        *
        * @param {string} base64Str The Base64 string.
        *
        * @return {WordArray} The word array.
        *
        * @static
        *
        * @example
        *
        *     var wordArray = CryptoJS.enc.Base64.parse(base64String);
        */
        parse: function (base64Str) {
            // Shortcuts
            var base64StrLength = base64Str.length;
            var map = this._map;

            // Ignore padding
            var paddingChar = map.charAt(64);
            if (paddingChar) {
                var paddingIndex = base64Str.indexOf(paddingChar);
                if (paddingIndex != -1) {
                    base64StrLength = paddingIndex;
                }
            }

            // Convert
            var words = [];
            var nBytes = 0;
            for (var i = 0; i < base64StrLength; i++) {
                if (i % 4) {
                    var bits1 = map.indexOf(base64Str.charAt(i - 1)) << ((i % 4) * 2);
                    var bits2 = map.indexOf(base64Str.charAt(i)) >>> (6 - (i % 4) * 2);
                    words[nBytes >>> 2] |= (bits1 | bits2) << (24 - (nBytes % 4) * 8);
                    nBytes++;
                }
            }

            return CryptoJS.lib.WordArray.create(words, nBytes).toString();
        },

        // _map: '+-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz|'
        _map: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz~.'
    };

    global.getTableIDForWeb = function(_id){
        var id = "";
        try{
            id = _id.replace(/\@|\.|\-|\:/g, "_");
            return id;
        }
        catch(error){
            GLOBAL.error("Transfer Error for ID = " + error);
        }
        return null;
    };

    return global;
}

module.exports = GlobalFunctions;

},{"crypto-js":9}],36:[function(require,module,exports){
function UcText(currentLanguage, appName) {

      //주의사항: text가 무분별하게 겹치지 않도록 잘 관리할 것.

      //kr or en or etc...
      var index = 0;
      switch(currentLanguage){
            case 'en': case 'en-US':  index = 0;  break;
            case 'ko': case 'ko-KR': case 'ko-kr': index = 1;  break;
            case 'zh-CN': 			 	index = 2;  break;	//간체
            case 'zh-TW': case 'zh-HK':	index = 3;  break;	//번체
            default: 	index = 0;  break;
      }

      var localeText = {
            title: {
                  favorites: ['Favorites', '즐겨찾기'],
                  favoritesEdit: ['Edit Favorites', '즐겨찾기 편집'],
                  chats: ['Chats', '대화'],
                  editChats: ['Edit Chats', '대화 편집'],
                  searchChats: ['Search Chats', '대화 검색'],
                  contacts: ['Contacts', '연락처'],
                  groups: ['Groups', '그룹'],
                  addToNewGroup: ['Add to New Group', '새 그룹 생성'],  /* yj*/
                  groupsByYou: ['Groups by you', '내가 만든 그룹'],  /* yj*/
                  createNewChannel: ['Create a New Board', '새 보드 만들기'],  /* yj web:modified*/
                  searchPublicBoard: ['Search a Public Board', '공개보드 검색하기'],
                  createNewConference: ['Create New Conference', '새 영상회의 생성'],  /* yj*/
                  scheduleConference: ['Schedule a Conference', '영상회의 시작하기'],
                  editConference: ['Edit a Conference', '영상회의 편집'],  /* yj web:modified*/
                  more: ['More', '설정'],
                  websearch: ['Search', '직원검색'],
                  websearchUser: ['Search', '사용자검색'],
                  security: ['Security','보안카메라'],

                  channel: ['Board', '보드'],  /* yj*/
                  myChannel: ['My Board', '내 보드'],  /* yj*/
                  allChannel: ['All Board', '모든 보드'],  /* yj*/
                  board: ['Board', '보드'],
                  post: ['Post', '게시물'],
                  searchBoard: ['Search Board', '보드 검색'],
                  choose: ['Choose', '선택'],
                  chooseInvite: ['Choose For Invite', '초대할 상대 선택'],
                  chooseChat: ['Choose For Chat', '대화 상대 선택'],
                  chooseMember: ['Choose For Add', '추가할 멤버 선택'],
                  chooseForward: ['Choose For Forward', '전달할 상대 선택'],
                  chooseForwardToRoom: ['Choose For Forward', '전달할 대화방 선택'],

                  /* board create */
                  purpose: ['Purpose', '목적'],
                  sendInviteTo: ['Send invites to', '초대 할 사람'],
                  optional: ['Optional', '옵션'],

                  /* new chat */
                  createNewChat: ['Create a new chat', '새로운 대화 시작하기'],
                  chatRoomName: ['Group chat name', '그룹 대화방 이름'],

                  chooseNewChat: ['New Chat', '새 대화'],
                  chooseSendNote: ['Send Note', '쪽지 전송'],
                  conference: ['Conference', '영상회의'], /* yj*/
                  general: ['General', '일반'],  /* yj*/
                  delete: ['Delete', '삭제'],  /* yj*/
                  email: ['E-Mail', '이메일'], /* yj*/
                  phone: ['Phone', ' 휴대전화'], /* yj*/
                  workTel: ['Work Tel', '회사전화'], /* yj*/
                  leaveConference : ['Are you sure to leave this conference?','영상통화 종료'],

                  info: ['Info', '연락처 정보'],
                  usrPrtInfo: ['User Group Info', '사용자 그룹 정보'],
                  depPrtInfo: ['Company Group Info', '조직도 그룹 정보'],

                  notification: ['Notification', '알림'],
                  profile: ['Profile', '프로필'],
                  people: ['People', '연락처'],
                  setTheme: ['Set Theme', '테마 설정'],
                  setChatFont: ['Set Chat Font', '대화방 폰트 설정'],
                  setNotification: ['Set Notification', '알림 설정'],
                  setPasscodeLock: ['Set Passcode Lock', '암호 잠금 설정'],
                  photos: ['Photos', '사진'],
                  videos: ['Videos', '동영상'],
                  allFileType: ['All File Type', '파일 형태'],/* yj*/
                  images: ['Images', '이미지'],/* yj*/
                  image: ['Image', '이미지'],/* yj*/
                  audios: ['Audios', '오디오'],/* yj*/
                  pdf: ['PDF', 'PDF'],/* yj*/
                  doc: ['DOC', 'DOC'],/* yj*/
                  etc: ['ETC', 'ETC'],/* yj*/

                  addToFavorites: ['Add to Favorites', '즐겨찾기 추가'],
                  bookmarkList: ['Bookmark List', '북마크 리스트'],
                  channelList: ['Board List', '보드 목록'],

                  addToNewGroup: ['Add to New Group', '그룹 추가'],
                  viewImageVideo: ['View Image/Video', '이미지/동영상'],
                  checkReceiveMessage: ['Check Receive Message', '메세지 수신 확인'],

                  bookmark: ['Bookmark', '북마크'],
                  logout: ['Logout', '로그아웃'],
                  inviteFriens: ['Invite Friends', '친구 초대'],
                  checkUnreadMessage: ['Unread Message', '안 읽은 메시지'],

                  members:['Members', '구성원'],
                  newVersion:['Download New Version', '새 버전 받기'],
                  confirmUseApp:['Usage agreement', '프로그램 사용 동의'],
                  signUp:['Sign up', '회원가입'],
                  signOut:['Sign out', '로그아웃'],

                  error: ['Error', '오류발생'],
                  dialUp: ['Dial Up', '전화걸기'],

                  moreConfiguration: ['Configuration', '설정'],
                  setting: ['Setting', '설정'], /* yj*/
                  moreTool: ['Tool', '기능'],
                  moreAbout: ['About', '정보'],
                  sendMail: ['Send E-mail', '이메일 전송'],
                  imageSendMail: ['Send image to E-mail', '사진 이메일 전송'],
                  videoSendMail: ['Send video to E-mail', '동영상 이메일 전송'],

                  alwayson: ['Always-on mode', '상시접속모드'],
                  noticeAlwayson: ['Usage agreement of Always-On', '상시접속모드 사용동의'],

                  integratedAlbum: ['Image album', '통합 앨범'],
                  cameraAlbum: ['Camera album', '촬영 앨범'],
                  chatRoomAlbum: ['Chatting album', '대화방 앨범'],
                  searchResults: ['Search Results', '검색 결과'],  /* yj*/
                  hideOff: ['Hide Off', '숨기기해제'],
                  hideOn: ['Hide On', '숨기기설정'],
                  forgetPassword: ['Forget Password', '패스워드 분실'],/* yj*/

                  name: ['Name', '이름'], /* yj*/
                  access: ['Access', '접근방법'], /* yj*/
                  public: ['Public', '공개'], /* yj*/
                  private: ['Private', '비공개'], /* yj*/
                  deleteThisChannel: ['Delete This Board', '보드 삭제'], /* yj*/
                  leaveThisChannel: ['Leave this Board', '보드 구독 해지'], /* yj*/
                  deleteThisConference: ['Delete This conference', '영상회의 삭제'], /* yj*/
                  end: ['END', 'END'], /* yj*/
                  on: ['ON', 'ON'], /* yj*/
                  scheduled: ['Scheduled', 'Scheduled'], /* yj*/
                  recordThisConference :  ['Record this conference?', '영상회의를 녹화 하시겠습니까?'],/* yj */
                  description :  ['Description', '설명'],/* yj */
                  title :  ['Title', '제목'],/* yj */
                  time :  ['Time', '시간'],/* yj */
                  attachment :  ['Attachment', '첨부파일'],/* yj */
                  addAttachment :  ['Add attachment', '첨부파일'],
                  record :  ['Record', '녹화'],/* yj */
                  deletePicture : ['Delete this profile picture?', '프로필 사진 삭제 하시겠습니가?'],/* yj */
                  account : ['Account', '계정정보'],/* yj */
                  about : ['About', '정보'],/* yj */
                  version : ['Version','버전'],/* yj */
                  privacyPolicy : ['Privacy Policy','개인정보보호정책'],/* yj */
                  termsofuse : ['Terms of Use', '이용약관'],/* yj */
                  department : ['Department','부서'],/* yj */
                  name : ['Name','이름'],/* yj */
                  picture : ['Picture','사진'],/* yj */
                  jobTitle : ['Job title','직위'],/* yj */
                  password : ['Password','비밀번호'],/* yj */
                  current : ['Current','현재비밀번호'],/* yj */
                  new: ['New','신규비밀번호'],/* yj */
                  reTypeNew: ['Re-Type New','신규비밀번호확인'],/* yj */
                  work: ['Work','회사'],/* yj */
                  allowNotifications : ['Allow Notifications','메세지 알림 허용'],/* yj */
                  groupChatNotification : ['Group Chat Notification','그룹방 메세지 알림 허용'],/* yj */
                  pushOption : ['Enable this option to receive push notifications from a new group chat.','신규 생성된 그룹의 메세지에 대한 알림을 수신 할 수 있습니다.'],  /* yj */

                  readAll: ['Read all', '모두 읽음'],
                  titleLaboratory : ['You can discuss and communicate over specific topic or issue in BOARD.','보드는 프로젝트와 같은 특정 주제를 중심으로 동료간에 공유할 수 있는 커뮤니티 입니다.'],
                  descriptionLaboratory : ['To start using BOARD, first set BOARD ON and refresh webpage.', '보드 사용을 원하시면 켜짐을 선택 후, 웹 페이지를 새로고침 하셔야 합니다.'],


                  file: ['File', '파일'],
                  filename:['File Name: ', '파일 이름: '],
                  fileUpload:['File Upload', '파일 업로드'],
                  addToNewConf: ['Add Conference', '영상회의 추가'],
                  newConfReservationName : ['Title','회의 제목'],
                  newConfReservationDesc : ['Description','상세 설명'],
                  newConfReservationDate : ['Date','회의 날짜'],
                  newConfReservationDuringT : ['Duration','회의 시간'],
                  newConfReservationTimeZone : ['Timezone','시간대 선택'],

                  LocalTime:['Local Time', '사용자기준 시간'],
                  TimeZone:['Time Zone', '현지시간 기준'],

                  unknownUser : ['Unknown User','사용자정보없음'],
                  warning: ['Warning', '경고'],

                  sendImage: ['Send Image', '사진 전송'],
                  sendVideo: ['Send Video', '동영상 전송'],

                  deleteContact: ['Delete Contact', '연락처 삭제'],

                  pushAnyKind: ['Activity of Any Kind', '모든 활동'],
                  pushOnlyPost: ['Only Post', '게시글만'],
                  pushInvolvedComments: ['Involved Comments', '게시글과 댓글까지'],
                  pushNothing: ['Nothing (Push Notification Off)', '푸시알림 없음'],
                  pushBoardChat: ['Chat Push Notifications', '보드 대화방 알림'],

                  inviteFromRoundee: ['Invite from Roundee', 'roundee 친구 초대하기'],
                  inviteFromAddress: ['Invite from Address Book', '주소록에서 초대하기'],
                  leaveBoard: ['Leave the Board', '보드에서 나가기'],
                  type: ['type', '종류'],
                  publicBoardDesc: ['Anyone can join this Board and invite others.', '누구든지 이 방에 참여할 수 있습니다.'],
                  privateBoardDesc: ['Only people invited to this Board may join.', '초대된 친구만 참여할 수 있습니다.'],
                  createBoard: ['Create a Board', '보드 생성'],
                  writePost: ['Write Post', '게시글 쓰기'],
                  whatWorking: ['what are you working on?', '게시글을 작성하세요.'],

                  news: ['News', '새소식'],

                  laboratory: ['Laboratory', '실험실'],
                  participant: ['Participant', '참여자'],

                  groupName: ['Group Name', "그룹 이름"],
            },

            data:{
                  mobile:['Mobile', '휴대전화'],
                  tel:['Tel', '지정번호'],
                  ext:['Ext', '내선번호'],
                  corpTel:['CorpTel', '회사번호'],
                  fax:['Fax', '팩스'],
            },

            button: {
                  contacts: ['Contacts', '연락처'],
                  groups: ['Groups', '그룹'],
                  chats: ['Chats', '대화'],
                  addPeople: ['Add People', '사용자 추가'],/* yj*/
                  addToFavorites: ['Add to Favorites', '즐겨찾기 추가'],/* yj*/
                  removeFromFavorites: ['Remove From Favorites', '즐겨찾기 삭제'],/* yj*/
                  ok: ['OK', '확인'],
                  cancel: ['Cancel', '취소'],
                  next: ['Next', '다음'],
                  end :['End','종료'],
                  use: ['Use', '사용'],
                  notUse: ['Not use', '사용안함'],

                  back: ['Back', '이전'],
                  edit: ['Edit', '편집'],
                  newChat: ['New', '새 대화'],
                  newGroup: ['New', '새 그룹'],
                  newChat_Web: ['New Chat', '새 대화'],
                  newGroup_Web: ['New Group', '새 그룹'],


                  newChannel: ['New Board', '새 보드'],  /* yj*/
                  newConference: ['New Conference', '새 영상회의'],  /* yj*/
                  deleteChannel: ['Delete Board', '보드 삭제'],  /* yj*/
                  subscribeChannel: ['Subscribe Board', '보드 구독'],  /* yj*/
                  leaveChannel: ['Leave Board', '보드 구독 해지'],  /* yj*/
                  subscribe: ['Subscribe', '구독합니다.'],  /* yj*/
                  noSubscribe: ['No', '구독하지 않습니다.'],  /* yj*/
                  comment:['Comment', '댓글'],  /* yj*/
                  comments:['Comments', '댓글'],  /* yj*/
                  newboardstories:['new stories', '새로운 소식'],  /* yj*/

                  new: ['New', '추가'],
                  add: ['Add', '추가'],
                  create: ['Create', '생성'],  /* yj*/
                  delete: ['Delete', '삭제'],  /* yj*/
                  fileName: ['File name', '파일명'],  /* yj*/
                  files: ['Files', '파일'],  /* yj*/
                  post: ['Post', 'Post'],  /* yj*/
                  time: ['Time', '시간'],  /* yj*/
                  allFileTypes: ['All File Types', '모든 파일 형태'],  /* yj web:modified*/
                  all: ['All', '전체'], /* web */
                  sentIn: ['Sent In', '작성된 곳'], /* web */
                  sentBy: ['Sent By', '작성자'], /* web */
                  postIn: ['Post In', '작성된 곳'], /* web */
                  postBy: ['Post By', '작성자'], /* web */
                  sharedIn: ['Shared In', '공유된 곳'], /* web */
                  sharedBy: ['Shared By', '공유한 사람'], /* web */

                  done: ['Done', '완료'],
                  leave: ['Leave', '나가기'],
                  send: ['Send', '보내기'],
                  login: ['Log In', '접속'],
                  signin: ['Sign in', '접속'],
                  logout: ['Log Out', '접속해제'],
                  chat: ['Chat', '대화시작'],
                  chat2: ['Chat', '대화'],
                  download: ['Download', '다운로드'],  /* yj*/
                  startConference: ['Start Conference', '영상통화 시작'],  /* yj*/
                  email: ['E-Mail', '이메일'],
                  sendAnEmail: ['Send an email', '이메일 보내기'],  /* yj*/
                  tempMember: ['Extra Features', '추가기능'],
                  addMember: ['Add Member', '멤버 추가'],
                  deleteMember: ['Delete Member', '멤버 삭제'],
                  deleteGroup: ['Delete Group', '그룹 삭제'],
                  deleteConversation: ['Delete Conversation', '대화 삭제'], /* yj*/
                  deleteMessage: ['Delete Message', '메시지 삭제'], /* yj*/
                  profile: ['Profile', '프로필보기'],  /* yj*/
                  call: ['Call', '전화걸기'],
                  fullScreen: ['Full Screen', '전체화면'],  /* yj*/
                  messages: ['Messages', '메시지'], /* yj*/
                  notification: ['Alarm', '알림'],
                  notification_Web: ['Notifiaction', '알림'],
                  bookmark: ['Bookmark', '북마크'],
                  bookmarkOff: ['Bookmark Off', '북마크 해제'],
                  websearch: ['Search', '직원검색'],
                  search: ['Search', '검색'],
                  invite: ['Invitation', '초대'],
                  hideOn: ['Hide on', '숨기기'],
                  hideOff: ['Hide off', '숨기기해제'],
                  hiddenChat: ['Hidden Chat', '숨김방설정'],  /* yj*/
                  move: ['Move', '이동'],  /* yj*/
                  profile: ['Profile', '프로필보기'],  /* yj*/
                  topOn: ['Top on', '고정방'],
                  topOff: ['Top off', '고정방해제'],
                  viewAll: ['View All', '모아보기'],
                  setChatRoomName: ['Set Chat Room Name', '대화방 이름 설정'],
                  setChatRoomName2: ['Set Chat Room\nName', '대화방\n이름 설정'],

                  select: ['Select', '선택'],
                  share: ['Share', '공유'],
                  album: ['Album', '앨범'],
                  changeTheme: ['Change Theme', '테마변경'],

                  copy: ['Copy', '복사'],
                  forward: ['Forward', '전달'],
                  forwardToRoom: ['Forward To Room', '대화방으로 전달'],
                  delete: ['Delete', '삭제'],
                  resend: ['Resend', '재전송'],
                  checkReceive: ['Check Receive', '수신 확인'],
                  groupNotice: ['Notice', '공지'],

                  imageAlbum: ['Image album', '사진앨범'],
                  capturePhoto: ['Capture photo', '사진찍기'],
                  videoAlbum: ['Video album', '동영상앨범'],
                  captureVideo: ['Capture video', '동영상촬영'],
                  agree:['Agree', '동의'],
                  viewEntireText:['View all', '전체보기'],

                  selectOne: ['Select One', '선택'],  /* yj*/
                  invitation: ['Invitation', '초대'],  /* yj*/
                  deleteConversation : ['Delete this Entire Conversation', '대화 삭제'],  /* yj*/
                  conferenceList: ['Conference List', '영상회의 목록'],  /* yj*/
                  noExtension: ['No extension', 'No extension'],  /* yj*/
                  after30Min : ['after 30 min', 'after 30 min'],  /* yj*/
                  startRecording : ['Start Recording', '녹화 시작'],  /* yj*/
                  stopRecording : ['Stop Recording', '녹화 종료'],  /* yj*/
                  addAttachment : ['Add Files', '파일 추가'],  /* yj*/
                  timeZone : ['Time zone', 'Time zone'],  /* yj*/
                  startNow: ['START NOW', '바로 시작'],

                  noticeDelete:['Delete', '삭제'],
                  noticeCollapse:['Collapse', '접기'],

                  loadingMore:['Loading more', '더 가져오기'],
                  markingRead:['Marking Read', '읽음 처리'],

                  close:['Close', '닫기'],
                  open:['Open', '열기'],

                  ConferenceEnd:['End','종료'],
                  ConferenceSchedule:['Scheduled', '예약중'],
                  ConferenceInProgress:['InProgress', '진행중'],
                  ConferenceEnter:['Join', '참여'],

                  ConferenceCreateImmediately:['Create Now', '즉시 생성'],

                  view : ['View', '보기'],
                  save : ['Save', '저장'],

                  addProfile: ['Add Profile Picture', '프로파일 사진 추가'],
                  selectFromAlbum: ['Select From Image Album', '사진 앨범에서 선택'],
                  //takePicture: ['Take Picture', '사진 촬영'],
                  deleteProfile: ['Delete Profile', '프로필 삭제'],

                  applyAll: ['Apply All', '일괄적용'],
                  batchApply: ['Batch Apply', '일괄 적용'],


                  fileHistory:['File History', '관련 파일 보기'],
            },

            message:{
                  externalUser: ['External user', '외부사용자'],

                  termsOfUse: ['Terms of Use', '이용약관'],
                  privacyPolicy: ['Privacy Policy', '개인정보 보호정책'],
                  selectedMembers: ['Selected Members', '선택된 친구'],
                  groupMembers: ['Group Members', '그룹 친구'],
                  forgetYourPassword: ['Forget your password', '비밀번호 찾기'],
                  signUpUc: ['Sign up for UC', '가입하기'],
                  signUpRoundee: ['Sign up for Roundee', '가입하기'],

                  enterPasscode: ['Enter Passcode', '암호'],
                  shakeYourPhoneForHideChatRoom: ['The chat will disappear when enter password.\nShake the phone to see again.', '암호 입력 시 대화방이 목록에서 사라집니다.\n다시 보시려면 휴대폰을 흔들어주세요.'],
                  shakeYourPhoneForShowChatRoom: ['When enter your password, it appears in the list.', '암호 입력 시, 대화방이 목록에 나타납니다.'],
                  passcodeAlreadyDefine:['You have passcode already.\nPlease input your the passcode.','기존에 사용중인 암호가 있습니다.\n기존에 사용중인 암호를 입력해주세요.'],
                  revertHiddenChatroom: ['Revert hidden Chat\nwhen you enter passcode', '암호 입력 시, 대화방의 숨기기가 해제됩니다.'],
                  confirmPasscode:['Confirm Passcode', '암호 확인'],
                  FirstEnterYourPasscode:['Please enter the password you want.', '설정하실 암호를 입력해 주세요.'],
                  reEnterYourPasscode:['Re-enter your passcode.', '확인을 위해 암호를 재입력해 주세요.'],
                  incorrectPasscode: ['Incorrect Passcode', '입력한 비밀번호가 틀립니다.'],
                  incorrectPasscodeTryAgain: ['Incorrect Passcode.\nPlease try again.', '입력한 비밀번호가 틀립니다.\n다시 입력해 주세요.'],
                  LockOn: ['Set up passcode lock.', '암호잠금을 설정합니다.'],
                  LockOff: ['Enter your passcode', '암호를 입력해주세요.'],
                  LockPass: ['Enter your passcode, then you can use the app.', '암호를 입력해야 앱을 사용할 수 있습니다.'],

                  appLockPasscodeViewGuideWithHidden: ['IMPORTANT:\nUse passcode same with hidden chatroom\'s passcode. If you change passcode, also change hidden chatroom\'s passcode.', '주의:\n숨김방 비밀번호와 동일한 비밀번호를 사용합니다. 그러므로 변경시 숨김방 비밀번호가 같이 변경됩니다.'],
                  appLockPasscodeViewGuideNormal: ['IMPORTANT:\nIf you lost a passcode, please reinstall application after deleting. (In Android, you should sign in after deleting data of application.)', '주의:\n비밀번호를 잊어버리면, 앱을 삭제 후 재설치를 하거나, 안드로이드의 경우, 앱의 데이터를 삭제 후 재로그인을 하셔야 합니다.'],
                  // appLockOnPasscodeViewGuide: ['', ''],
                  // appLockOffPasscodeViewGuide: ['', ''],

                  daysAgo: [' days ago', ' 일전'],
                  monthsAgo: [' months ago', ' 달전'],
                  yearsAgo: [' years ago', ' 년전'],

                  pushNotification: ['Push Notification', '알림설정'],
                  pushNotificationMessage: ['Receive push notifications for new messages.', '대화 도착 알림 설정을 합니다.'],
                  showPreview: ['Show Preview', '알림내용 표시'],
                  showPreviewMessage: ['Enable this option to include a preview of the message when a push notification arrives.',
                  '대화 도착 알림시 대화내용을 미리보도록 설정합니다.'],
                  sounds: ['Sounds', '소리설정'],
                  vibrate: ['Vibrate', '진동설정'],
                  soundsVibrateMessage: ['Enable this option to receive a sound / vibration alert when a new message arrives.',
                        '대화 도착 알림 방법을 설정합니다.'],
                  soundsVibrateMessageForiOS: ['Enable this option to receive a sound / vibration alert when a new message arrives while the app is running.',
                        '실행중 대화 도착 알림 방법을 설정합니다.'],
                  groupChatNotification: ['New Group Chat Alerts', '새로운 그룹채팅방 알림'],//['Group Chat Notification', '그룹대화 알림'],
					groupChatNotificationMessage: ['Receive push notifications from a new group chat.',
					   '새로 초대된 그룹채팅방의 대화 도착알림을 받습니다.'],
                  dndTime: ['Do not disturb', '방해금지 시간설정'],
                  startTime: ['Start Time', '시작 시간'],
                  endTime: ['End Time', '종료 시간'],
                  remainConfTime: ['Time remaining', '남은시간'],

                  changeThemeMessage: ['Do you want change theme?', '테마를 변경하시겠습니까?'],
                  logoutMessage: ['All personal settings will be rmoved.\nAre you sure you want to log out?', '개인설정이 모두 지워집니다.\n접속해제 하시겠습니까?'],
                  logoutMessageWeb: ['Are you sure you want to log out?', '접속해제 하시겠습니까?'],
                  loggedoutMessage: ['You have been logged out', '접속해제되었습니다.'],
                  loggedoutFailedMessage: ['log out Failed.\nPlease try again after app restart.', '접속해제 실패하였습니다.\n앱을 재시작한 후 재시도해주세요.'],
                  leaveMessage: ['Are you sure want to leave this chat room?\nIf you leave, this chat room and message history will be deleted.',
                        '나가기를 하시겠습니까?\n대화이력이 삭제됩니다.'],
                  groupNotice: ['You can register only one notice.\nWould you like to register a notice?',
                        '공지는 1개만 등록할 수 있습니다.\n공지로 등록하시겠습니까?'],

                  photosPickMessage: ['Choose up to five images! Long click image for preview.',
                        '5장까지 선택할 수 있습니다. 길게 누르면 미리보기 됩니다.'],
                  videosPickMessage: ['Choose up to five images! Long click image for preview.',
                        '5장까지 선택할 수 있습니다. 길게 누르면 미리보기 됩니다.'],
                  startGroupChatMessage: [' did start group chat.', '님이 그룹대화를 시작했습니다.'],
                  imageString: ['[image]', '[사진]'],
                  videoString: ['[video]', '[동영상]'],
                  musicString: ['[music]', '[음악]'],
                  voiceString: ['[voice]', '[음성]'],
                  documentString: ['[document]', '[문서]'],
                  mapString: ['[map]', '[지도]'],
                  newVersionMessage: ['There is a new version. Would you like to update?',
                        '새 버전이 있습니다. 업데이트 하시겠습니까?'],
                  unReadMessage: ['Unread message', '읽지 않음'],
                  emailHintMessage: ['Please Input your email.', '이메일을 입력하세요.'],
                  idHintMessage: ['Please Input your employee number.', '사원번호를 입력하세요.'],
                  passwordHintMessage: ['Please Input your password.', '비밀번호를 입력하세요.'],
                  arrivedNewMessage: ['Arrived New Message.', '새 메세지가 왔습니다.'],
                  sendNoteHintMessage: ['Please input your note message.\nbatch sent to the message.', '쪽지 메시지를 입력하세요.\n1:1 메시지로 일괄 발송됩니다.'],

                  inputGroupName: ['Input group name.', '그룹이름을 입력하세요.'],
                  guideSearchContactFromWebLabelText: ['Input word to search.', '검색어를 입력하세요.'],
                  guideSearchContactFromWebLabelText2: ['Input word to search at least two characters.\nAnd you can add contacts.',
                        '두 글자부터 검색되며\n연락처 추가를 할 수 있습니다.'],

                  searchContactFromWebCase401: ['Authentication failed.', '인증실패(ID or Password)'],
                  searchContactFromWebCase403: ['The empty string is the item.', '필수 항목의 누락'],
                  searchContactFromWebCase601: ['Json standard creation failed.', 'Json 규격 생성 실패'],
                  searchContactFromWebCase607: ['Search Keyword length failed.', '검색 키워드의 길이가 짧음.'],
                  searchContactFromWebCase608: ['No Data.', '검색된 데이터가 없습니다.'],
                  searchContactFromWebCase999: ['Provision Server Fail.', '인증 실패'],

                  thisIsLeaveRoom: ['This room has been removed.\nUnable to open the chat room.',
                        '이 방은 삭제되었습니다.\n대화방을 열 수 없습니다.'],

                  cancelMessage: ['Are you sure you want to cancel?', '취소하시겠습니까?'],
                  searchInContacts: ['      Search in contacts', '      연락처 검색'],
                  searchInChats: ['      Search in Conversation', '      대화 검색'],
                  searchInGroups: ['      Search in Group', '      그룹 검색'],
                  searchInSearchs: ['      Search in Server', '      직원 검색'],

                  noRoomMember: ['No contacts', '대화상대 없음'],
                  noGroups: ['No Groups', '그룹 없음'], /* yj */
                  noChatroomList: ['No ChatRoom List', '대화 목록 없음'], /* yj */
                  noFavorites: ['No Favorites', '즐겨찾기 없음'], /* yj */
                  createYourOwnGroup: ['Create your own group', '그룹을 만드세요.'], /* yj */

                  deleteThisGroup: ['Delete this group.', '이 그룹을 삭제합니다.'],
                  deleteChannelSuccess :  ['Delete a Board successfully.', '보드가 삭제되었습니다.'],
                  deleteSelectedMember: ['Delete selected members.', '선택된 멤버들을 삭제합니다.'],
                  confirmUseAppSubject: ['• Please read the user agreement/terms of use below.', '• 본 프로그램을 사용하시기 전에 아래의 조건을 반드시 읽어 주십시오.'],
                  confirmUseAppConfirm: ['• User cannot use the program unless he/she agrees with this user agreement.', '• 본 사용동의서 내용에 동의하지 않으면 접속이 진행되지 않으며 프로그램을 사용할 수 없습니다.'],
                  confirmUseAppText: [
                        '1. Scope of usage and matters requiring attention\n\n1.1 The program is provided only for company’s related matters and prohibited for individual use.\n\n1.2 By installing and using the program, users must obey the law such as not texting while driving. User who violates the law is responsible to the fine.\n\n1.3 Some functions such as file transmission and conversation record might be limited due to the security policy.\n\n1.4 According to the security related policy, user must prevent information leakage.\n\n\n2. Agreement for using saving personal information and usage records\n\n2.1 User agrees that terminal related personal information such as hand phone number, country name, Wifi MAC address, IMSI and UDID will be collected, used, and examined.\n\n2.2 Usage record and transmitted file will be inspected and analyzed. If a user violates any regulation, he/she and the team will be proceed and investigated according to the security violation policy.\n\n\n3. Agreement for frequency of product usage\n\n3.1 Personal records such as program average using time and file transmission will be collected and used to improve the program.\n\n\n4. Other\n\n4.1 This program is provided for Hyundai Motor Group employees and registered outsiders only. Other contents might be included according to each company security policy.\n\n',
                        '1. 프로그램의 활용 범위 및 사용상 주의 사항\n\n1.1 본 프로그램은 회사 업무를 지원하기 위해 제공되는 것으로, 개인적인 용도로 사용할 수 없습니다.\n\n1.2 본 프로그램 설치·이용 시 운전 중 사용금지 등 관련 제반 법령을 준수하여야 하고, 그 위반에 따른 일체의 책임은 사용자 개인이 부담해야 합니다.\n\n1.3 파일 및 대화내용의 저장, 전달 기능은 당사의 보안정책에 따라 해당기능이 제한될 수 있습니다.\n\n1.4 본 프로그램 상의 제반 정보가 유출되지 않도록 보안을 철저히 유지하여야 합니다.\n\n\n2. 고유정보, 사용기록의 저장 및 활용\n\n2.1 휴대폰 번호, 사용국가, Wifi MAC 주소, IMSI, UDID 등 단말기 고유정보의 수집·이용·조회 등의 처리에 동의한 것으로 간주됩니다.\n\n2.2 사용기록 및 저장된 파일은 정기/부정기 감사에서 분석/조회되며 당사 규정위반 사항이 있는 경우 해당자 및 해당 팀은 보안 위규자 처리규정에 의해 조치됩니다.\n\n\n3. 프로그램 사용통계 활용\n\n3.1 본 프로그램의 접속내역 및 사용 시간, 파일 송수신 등의 기록은 개인 단위로 수집되며, 프로그램 개선을 위한 통계목적으로 활용됩니다.\n\n\n4. 기타\n\n4.1 본 프로그램은 현대자동차그룹 임직원 또는 등록된 외부인이 사용할 수 있으며, 본 동의서에 없는 내용은 당사 보안규정을 따릅니다.\n\n'
                  ],
                  confirmDeleteThisFile: ['Are you sure you want to delete this file, it cannot be undone.', '이 파일을 삭제하시겠습니까? \n삭제 후 취소할 수 없습니다.'], /* yj */


                  FontBiggist: ['Biggest Font', '아주 크게'],
                  FontBig: ['Big Font', '크게'],
                  FontNormal: ['Normal Font', '보통'],
                  FontSmall: ['Small Font', '작게'],
                  setChatFontText: ['Set the font size of the Chatroom.', '채팅방의 글자 크기를 설정합니다.'],
                  viewEntireTextRetry: ['An error occurred while to get the message.\n Please try again in a few minutes.', '메세지를 가져오는 중 오류가 발생했습니다.\n 잠시 후 다시 시도해주세요.'],
                  viewEntireTextSender: ['did send message.', '님이 보내신 메세지.'],
                  viewEntireTextByMe: ['I sent message.', '내가 보낸 메세지.'],

                  loginProgressStart: ['Start a Verifying.', '인증을 시작합니다.'],
                  loginProgressAuthentification: ['Verifying the user.', '인증 처리 중입니다.'],
                  loginProgressContacts: ['The synchronization of contacts.', '주소록 동기화 중입니다.'],
                  loginProgressChatting: ['The synchronization of the conversation.', '대화 동기화 중입니다.'],
                  loginProgressComplete: ['Run the application.', '응용 프로그램을 실행합니다.'],

                  newMemberInvite: ['There is a new group members.\nWould you like to invite them to talk?', '새로운 그룹멤버가 있습니다.\n대화에 초대하시겠습니까?'],
                  checkUnreadMessage: ['You have unread message.\nmarking as read or loading more message', '안 읽은 메시지가 있습니다.\n모두 읽음처리하거나 더 가져올 수 있습니다.'],

                  removeFromFavoriteSuccess : ['Remove from Favorites successfully.', '즐겨찾기가 삭제되었습니다.'], /* yj */
                  //passwordReset : ['Please input your E-mail.\nIf you click OK button, ~~~', '가입 시 입력하신 회사 E-mail 주소를 입력해주세요.\n전송 버튼을 클릭하시면 입력하신 주소로  비밀번호 재설정 E-mail이 발송됩니다.'], /* yj */

                  enterIdAndPwd: ['Please enter your ID and password to sign in.', '로그인을 위해 아이디와 패스워드를 입력해주세요.'], /* yj */
                  rememberMe: ['Remember me', '로그인 유지하기'],/* yj */
                  rememberMe_Web: ['Remember ID', 'ID 기억하기'],/* yj */
                  isInvited: ['is invited', '님이 초대 되었습니다.'],/* yj */
                  isEntered: ['is entered', '님이 입장 하였습니다.'],/* yj */
                  wentOut: ['went out', '님이 나가셨습니다.'],/* yj */
                  Exited: ['Exit', '퇴장 했습니다.'],
                  Entered: ['Entered', '입장 하였습니다.'],

                  publicChannel: ['Anyone can join this Board and invite others.', '누구나 가입할 수 있으며, 초대할 수 있습니다.'],/* yj */
                  privateChannel: ['Only people invited to this Board may join.', '초대된 사람만 가입할 수 있으며, 검색 시 표시가 안 됩니다.'],/* yj */
                  enterNameOrEmail: ['Search user in roundee or type e-mail address to invite', '라운디 사용자 검색 또는 이메일 주소 입력해서 사용자 초대'],/* yj */
                  createdChannel: ['Your board was created.', '보드가 생성되었습니다.'],/* yj */
                  confirmDeleteContents : ['Are you sure you want to delete this contents, it cannot be undone.', '이 컨텐츠를 삭제하시겠습니까? \n삭제 후 취소할 수 없습니다.'], /* yj */
                  confirmDeleteMessage : ['Are you sure you want to delete this message, it cannot be undone.', '이 메시지를 삭제하시겠습니까? \n삭제 후 취소할 수 없습니다.'], /* yj */


                  confirmDeleteGroup : ['Once you delete this group, it cannot be undone.', '이 그룹을 삭제하시겠습니까? \n삭제 후 취소할 수 없습니다.'], /* yj */

                  deleteConversation : ['Are you sure to delete this conference?', '이 대화를 삭제하시겠습니까?'], /* yj */
                  confirmdeleteConversation : ['Once you delete this conversation, it cannot be undone.', '이 대화를 삭제하시겠습니까? \n삭제 후 취소할 수 없습니다.'], /* yj */
                  deleteChannelSuccess : ['Delete a board successfully.', '보드가 삭제되었습니다.'], /* yj */
                  leaveChannelSuccess : ['Leave a board successfully.', '보드 구독이 해제되었습니다.'], /* yj */
                  leaveThisChannel : ['Leave this Board?', '보드 구독을 해지하시겠습니까? '], /* yj */
                  selectDelegateOwner : ['Please select one to delegate owner.', '권한을 위임할 사람을 선택해주세요.'], /* yj */
                  wasDeletedBy : ['was deleted by', '는 삭제되었습니다.'], /* yj */

                  deleteThisPost: ['Are you sure want to permanently remove this post?', '선택한 게시물을 삭제하시겠습니까? \n삭제 후 취소할 수 없습니다.'],/* yj */
                  deleteThisChannel: ['Are you want to delete this Board?', '이 보드를 삭제하시겠습니까?'],/* yj */
                  leaveThisChannel: ['Are you want to leave this Board?', '이 보드의 구독을 해지하시겠습니까?'],/* yj */
                  //inviteYouTo: ['invite you to', '이 당신을 초대합니다.'],/* yj */
                  subscribeBoardIt: ['Are you sure you want to join the Board?', '선택하신 보드에 가입하시겠습니까?'],/* yj */
                  SendAInvitation: ['Send a invitation successfully.', '초대메시지를 보냈습니다.'],/* yj */
                  TryIt :  ['Cannot send a file. Try it again.', '다시 시도하세요.'],/* yj */

                  HideOnConversationSuccess :  ['Hide On the conversation successfully.', '숨김방으로 설정했습니다.'],/* yj */
                  NotHaveAnyHiddenChat :  ['You do not have any hidden chat yet.', '숨김방이 없습니다.'],/* yj */
                  TopOnConversationSuccess :  ['Top On the conversation successfully.', '고정방으로 설정했습니다.'],/* yj */

                  deleteThisConference :  ['Delete this conference?', '선택한 영상회의를 삭제 하시겠습니까?'],/* yj */

                  endConference :  ['End this conference', '영상회의 종료'],/* yj */
                  sureEndThisConference :  ['Are you sure to end this conference?', '영상회의를 종료하시겠습니까?'],/* yj */



                  AddUsers :  ['Add users(Search or Drag & Drop from contacts and groups list)', '채팅멤버 추가'],/* yj */
                  webIviteMemberToChatRoom: ['+ Invite People (Search or type email)', "+ 사용자 추가 (멤버 검색 또는 E-mail 주소 입력)"],
                  //NotHaveAnyHiddenChat :  ['You do not have any hidden chat yet.', ''],/* yj */
                  //TopOnConversationSuccess :  ['Top On the conversation successfully.', ''],/* yj */
                  //EnterYourPasscode :  ['Want to see hide chat, enter your passcode. (4 digits)', ''],/* yj */
                  //incorrectPasscode :  ['Incorrect Passcode.', ''],/* yj */
                  //hideConversation :  ['Once you hide this conversation, you should enter passcode to see it.', ''],/* yj */
                  //passcodeAlready :  ['You have passcode already.', ''],/* yj */
                  //enterPasscode :  ['Enter Passcode.(4 digits)', ''],/* yj */
                  //resultsFor :  ['results for', ''],/* yj */

                  //addFavoriteSuccess :  ['Add to Favorites successfully.', ''],/* yj */
                  searchResultAre :  ['the search results are', ' 로 검색한 결과는 '],/* yj */
                  searchResultCnt :  ['cases.', '건 입니다.'],

                  //enterConferenceBeforeStarting :  ['You can enter the conference about 5 minutes before starting.', ''],/* yj */
                  //conferenceAdded :  ['Your conference was added.', ''],/* yj */
                  //eventUpdated :  ['Your event was updated.', ''],/* yj */

                  //createConferenceBy30 :  ['You can run your web conference for up to 30 min during our beta test.\nYou can create, edit or delete a conference before 5 minutes.', ''],/* yj */
                  createConferenceBy40 :  ['You can run your web conference for up to 40 min during our beta test.\nYou can create, edit or delete a conference before 5 minutes.', '최대 40분 영상회의를 생성할 수 있으며, 영상회의 수정은 컨퍼런스 시작 5분 전 까지 수정할 수 있습니다.'],/* yj */
                  //conferenceAutomatically :  ['The conference call automatically be recorded in the meeting when you select this option.', 'The conference call automatically be recorded in the meeting when you select this option.'],/* yj */
                  //enterColleague :  ['Enter colleague or external user’s name or e-mail address..', ''],/* yj */

                  leaveConference :  ['Which do you want to leave or end this conference?', 'Which do you want to leave or end this conference?'],/* yj */

                  //endOfThe :  ['End of the', ''],/* yj */
                  //extend :  ['Extend', ''],/* yj */
                  //beforeStarting5Min :  ['You can enter the conference about 5 minutes before starting.', ''],/* yj */
                  //automaticallyClose :  ['This page will close automatically after 15 seconds.', ''],/* yj */
                  //leaveAfter10Min :  ['Leave this conference after 10min?', ''],/* yj */
                  //youWillLeave :  ['You will leave', ''],/* yj */
                  //in10Min  :  ['in 10 min.', ''],/* yj */
                  //keepThisConference  :  ['If you want to keep this conference, please select after 30 min.', ''],/* yj */
                  //sureToStopRecording :  ['Are you sure to stop recording?', ''],/* yj */

                  passcodeLock: ['Passcode Lock', '암호 잠금'],
                  passcodeChange: ['Change Passcode', '암호 변경'],
                  passcodeChange: ['Change Passcode', '암호 변경'],

                  readThisFar: ['Read this far', '여기까지 읽었습니다.'],

                  imageSendMailToMe: ['Would you like to send a photo as an attachment to your e-mail account?', '본인의 이메일계정으로 사진을 첨부하여 보내시겠습니까?'],
                  videoSendMailToMe: ['Would you like to send a video as an attachment to your e-mail account?', '본인의 이메일계정으로 동영상을 첨부하여 보내시겠습니까?'],

                  noticeAlwayson: ['Since your mobile can not use android push notification service(GCM), you have to use another access function in order to receive Mtalk notifications.\n\n' +
                  	'Using this function\n may increase your mobile power consumption.\n' +
                  	'You will still receive notifications\n although you are not running the mTalk application.\n\n' +
                  	'When you do not use the access function,\n your mobile power consumption will not increase.\n' +
                  	'You can receive notifications\n only while using mTalk.\n\n' +
                        '※ There is no other difference beside this notification access function.',
                        '현재 사용하시는 단말기는 안드로이드 푸시알림기능(GCM) 사용이 불가하여 mTalk 메시지 수신알림을 위해 상시접속기능이 필요합니다.\n\n'+
                        '[상시접속모드 사용하는경우]\n'+
                        '대기전력소모 일부증가.\n'+
                        'mTalk미사용 시에도 \n메시지 수신알림 가능.\n\n'+
                        '[상시접속모드 사용하지 않는경우]\n'+
                        '대기전력소모 증가없음.\n'+
                        'mTalk사용중에만 \n메시지 수신 알림 가능.\n\n'+
                        '※그외, 모든 기능은 동일하게 동작합니다.'],
                  noticeAlwayson2: ['This function is provided for Mtalk message notification in some areas such as China (or for some mobiles), where Google Service has been blocked.\n\n' +
                  	'Using this function\n may increase your mobile power consumption.\n' +
                  	'You will still receive notifications\n although you are not running the mTalk application.\n\n' +
                  	'When you do not use the access function,\n your mobile power consumption will not increase.\n' +
                  	'You can receive notifications\n only while using mTalk.\n\n' +
                  	'※ If you do not live in the area where Google Service has been blocked, using this function is strongly not recommended.',
                        '본 상시접속모드는 중국과 같이 구글서비스가 차단된 지역(혹은 차단된 단말)에서의 mTalk 메시지 수신일림을 위해 선택하는 기능입니다.\n\n'+
                        '[상시접속모드 사용하는경우]\n'+
                        '대기전력소모 일부증가.\n'+
                        'mTalk미사용 시에도 \n메시지 수신알림 가능.\n\n'+
                        '[상시접속모드 사용하지 않는경우]\n'+
                        '대기전력소모 증가없음.\n'+
                        'mTalk사용중에만 \n메시지 수신 알림 가능.\n\n'+
                        '※ 구글서비스가 차단된 지역(혹은 단말)이 아니라면 본 기능은 사용이 불필요합니다.'],


                  deletePicture : ['Once you delete this picture, it cannot be undone.', '삭제한 사진은 다시 복구 할 수 없습니다.'],
                  makePublic : ['Make Public','공개'],
                  pushOption : ['Enable this option to receive push notifications from a new group chat.','신규 생성된 그룹의 메세지에 대한 알림을 수신 할 수 있습니다.'],
                  passwordIncorrect : ['Your password was incorrect.','비밀번호 오류입니다'],
                  tooShort : ['Too short','비밀번호의 길이는 8~20자여야 합니다.'],
                  matchPasswordTooShort : ['Match password too short','비밀번호의 길이는 8~20자여야 합니다.'],
                  passwordsNotMatch : ['Passwords do not match','비밀번호가 일치 하지 않습니다.'],
                  passwordsMatch : ['Passwords match','비밀번호가 확인 되었습니다.'],
                  accountUpdate : ['Your account has been updated.','사용자 정보가 변경 되었습니다.'],

                  newConfReservationSetGuide : ['Enter','입력'],
                  newConfReservationHours : ['hour(s)','시간'],

                  startConference: ['Start Conference', '영상통화 시작'],  /* yj*/
                  recFile:['Recording File.mp4', '녹화파일.mp4'],

                  invitemessage:['Invite %memberlist% by %sender%', '%sender% 님이 %memberlist% 님을 초대 하였습니다.'],
                  exitmessage:['%member% left this chatroom.', '%member% 님이 나갔습니다.'],

                  searchValueCondition:['This character set( + - && || ! ( ) { } [ ] ^ " ~ * ? : \\ ) is not allowed on searching.', '검색 조건에 + - && || ! ( ) { } [ ] ^ " ~ * ? : \\ 는 허용되지 않습니다.'],
                  uploadingFile:['Uploading File...', '파일을 업로드하고 있습니다...'],
                  warnUploadFile:['Processing uploaded file...\nPlease upload new file after previous file is complete.', '파일이 업로드 중입니다.\n이전 파일 업로드가 완료되면 시도해주세요.'],

                  warnApplyAll:['Are you sure want to Apply All?', '일괄적용을 하시겠습니까?'],

                  inputMessage:['Enter your message here(press Shift+Enter for multiple lines)','메시지 입력 후 Enter키를 눌러 전송하세요. (줄바꿈은 Shift+Enter)'],

                  pleaseCheckPush: ['If push notifications set NO, you can\'t use this function.',
                        '대화 도착 알림이 꺼져있다면 사용하실 수 없는 기능입니다.'],

                  bannerForCameraAlbum: ['An album containing of photo/video shooting with camera button below. It will be automatically erased(Schedule marks at the Photo bottom)',
                  '오른쪽 하단의 보안카메라 버튼을 통해 촬영된 사진/동영상이 임시 보관되는 앨범입니다. 30일 보관 후 자동 삭제 됩니다.(삭제일 사진 하단 표시)'],
                  bannerForChatRoomAlbum: ['An album containing of photo/video exchanged in chatting room. It will be automatically erased(Schedule marks at the Photo bottom)',
                  '대화방을 통해 주고 받은 사진/동영상이 보관되는 앨범입니다. 30일 보관 후 자동 삭제 됩니다(삭제일 사진 하단 표시)'],
                  warningMessage: ['Set on \'do not disturb\', but times are not set. If you want to set times, select \'back\' or want to cancel the setting, select \'leave\'.',
                  	'방해금지를 사용하도록 설정되어 있으나 시간이 설정되어 있지 않습니다. 시간을 설정하시려면 \'이전\', 설정을 취소하시려면 \'나가기\'를 선택하세요.'],

                  showBackgroundPreview: ['Show Notification Preview', '알림 미리보기 표시'],
                  showBackgroundPreviewMessage: ['Enable this option to preview of the message popup when notification arrives on background or screen off.',
                  '앱이 실행중이지 않거나 화면 꺼짐, 잠금상태에서도 대화 도착 알림 팝업이 보이도록 설정합니다.'],
                  noSearchResult: ['No search results', '검색결과 없음'],
                  writeComment: ['Write a comment...', '댓글을 입력하세요...'],
                  writeDescription: ['Write a description...', '설명을 입력하세요...'],
                  writeTitle: ['Write a title...', '제목을 입력하세요...'],
                  photoPostedBy: ['Photo posted by', '님이 게시한 사진'],
                  searchGuide: [
                        '1. 복합 검색: 합집합\n 단어의 나열\n ex: 제안서 발표\n' +
                        '2. 복합검색: 교집합\n 단어 사이의 comma(,) 로 구분\n ex: 제안서, 발표\n 제안 발표, 결과 => 제안 발표 like 검색 & 결과 like 검색으로 진행\n'+
                        '3. type 검색\n colon(:)뒤에 type 입력\n :image => image 에서 검색. :video => video 모두 검색\n'+
                        '4. 발신자 검색\n @로 시작하는 경우\n ex: @hscho\n'+
                        '5. 일치 검색\n \"로 문장을 감싸는 경우 사이의 빈칸이나 comma 등 특수기호등을 문자로 취급한다.',

                        '1. 복합 검색: 합집합\n 단어의 나열\n ex: 제안서 발표\n' +
                        '2. 복합검색: 교집합\n 단어 사이의 comma(,) 로 구분\n ex: 제안서, 발표\n 제안 발표, 결과 => 제안 발표 like 검색 & 결과 like 검색으로 진행\n'+
                        '3. type 검색\n colon(:)뒤에 type 입력\n :image => image 에서 검색. :video => video 모두 검색\n'+
                        '4. 발신자 검색\n @로 시작하는 경우\n ex: @hscho\n'+
                        '5. 일치 검색\n \"로 문장을 감싸는 경우 사이의 빈칸이나 comma 등 특수기호등을 문자로 취급한다.\n'
                  ],
                  descriptionLaboratory : ['You can discuss and communicate over specific topic or issue in BOARD.\nTo start using BOARD, set BOARD switch ON.',
                        '보드는 프로젝트와 같은 특정 주제를 중심으로 동료간에 공유할 수 있는 커뮤니티 입니다.\n보드 사용을 원하시면 켜짐을 선택하세요.'],

                  hintBoardNameInput: ['Board Name','보드 이름'],
                  hintBoardPurposeInput: ['Briefly describe the purpose of this board', '이 보드에 대한 설명을 간략하게 적어주세요.'],
                  hindBoardSearch: ['Search all of public board', '공개 보드에 대한 모든 검색'],
                  hintPopupInvite: ['Search user in roundee or type e-mail address to invite', '라운디 사용자 검색 또는 이메일 주소 입력해서 사용자 초대'],
                  hintChatroomName: ['Chat room name', '대화방 이름'],
                  hintPopupInviteUsecase: ['Please separate multiple addresses with commas(,).', '여러 명 입력 시, 콤마(,)로 구분해주세요.'],
                  hintConferenceName: ['Conference title', '영상회의 이름'],
                  hintConferenceDesc: ['Briefly describe the conference(optional)', '영상회의에 대한 설명을 간략하게 적어주세요.(옵션)'],

                  hintJoinBoard: ['Join Board', '보드 가입하기'],

                  changeChatRoomName: ['Change room name', '대화방명 변경'],
                  makeYourOwnGroup: ['You can make your own group to click the button.', '본인만의 그룹을 만들어보세요!'],
                  makeBoardHere: ['Create a new board or search a public board', '새 보드 만들기 또는 공개 보드 검색하기'],
                  makeConferenceHere: ['Start your conference here and now.', '지금 여기서 바로 영상회의를 시작해보세요!'],

                  boardJoinComplete: ['You joined the board successfully.', '보드에 가입되었습니다.'],
            },

            alert:{
                  wrongStartConferenceTime: ['Please check your conference time.\n(Conference start time must be set 5 minutes after the current time.)', '영상회의 시간은 현재 시간보다 5분 후로만 설정이 가능합니다.'],
                  wrongEndConferenceTime: ['Please check your conference time.\n(Conference end time can not be earlier than the start time.)', '영상회의 종료 시간은 시작 시간 보다 이전 일 수 없습니다.'],
                  wrongEditConference: ['5 minutes before the start videoconferencing can not be edited', '영상회의 시작 5분전에는 편집을 할 수 없습니다.'],
                  wrongConferenceMaxTime: ['You can create conference by 40 minutes.', '영상회의 시간은 최대 40분 까지 입니다.'],

                  reMainConferenceTime: ['You have %time% minutes left.', '%time%분 남았습니다.'],


                  noResponse: ['There is no server response.\nPlease retry in a few minutes.', '서버응답이 없습니다.\n잠시 후 재시도 바랍니다.'],
                  emptyName: ['Please input name.', '이름을 입력하세요.'],
                  tooLongName: ['Please set fewer name than 20 characters.', '이름을 20자 이하로 입력하세요.'],
                  emptyMember: ['Please select member over 1 person.', '1명 이상의 멤버를 선택하세요.'],
                  emptyGroupMember: ['Please select Group include 1 person.', '선택한 그룹은 구성원이 존재 하지 않습니다.'],
                  oemSetForUseImage: ['Settings > photos to access the photos in the Privacy Policy.', '설정 > 개인 정보 보호 정책에서 사진에 액세스 할 수 있도록 하세요.'],
                  errorVideoLoading: ['Error on loading Video.', '비디오를 불러오는 중 에러가 발생했습니다.'],
                  displayOrginalImage: ['Display original image.', '원본 이미지 출력'],
                  errorAddFavorite: ['Fail to add favorites.\nPlease check max count.', '즐겨찾기 등록에 실패했습니다.\n최대 허용 갯수를 초과했는지 확인해주세요.'],
                  emptyEmail: ['Please input your email.', '이메일을 입력하세요.'],
                  emptyPassword: ['Please input your password.', '비밀번호를 입력하세요.'],
                  imageSelectMaxNumber: ['Already selected images maximum number.', '선택할 수 있는 이미지 갯수를 초과했습니다.'],
                  duplicateName: ['Already exists same name.', '같은 이름이 존재합니다.'],
                  enterTwoCharacters: ['Enter at least two characters.', '두 글자 이상 입력해야 합니다.'],
                  needAgree: ['You are required to agree to the terms of program use.', '프로그램 사용 동의가 필요합니다.'],

                  provisionClientError: ['Failed authentication attempts.', '인증시도하지 못했습니다.'],
                  provisionUserError: ['Please check your user email or password.', '이메일 또는 비밀번호를 확인해 주세요.'],
                  provisionUserDisabledError: ['This account has been disabled.', '사용이 중지된 계정입니다.'],

                  provisionServerError: ['An error occurred during the authentication process.', '인증처리시 오류가 발생하였습니다.'],
                  provisionErrorUserLock: ['User has been locked due to failed login attempts set.\nPlease retry after 60 minutes.', '로그인 5회 실패로 인해 계정잠금되었습니다.\n60분 후 재시도 해주세요.'],
                  provisionErrorLongTerm: ['Users do not have a long-term connection is not connected locks.', '장기간 미접속으로 인한 잠금되었습니다.'],
                  provisionErrorDeletedUser: ['User is deleted user. The user can not use.', '삭제된 사용자 입니다.'],

                  multipleDeviceError: ['The duplicate device is registered.\nPlease use the terminal \nafter the registration in the Personal WEB.',
                  '중복 단말이 등록되었습니다.\n개인WEB에서\n단말등록 후 사용하세요.'],
                  multipleDeviceErrorForHK: ['The duplicate device is registered.\nPlease use the terminal \nafter the registration in the Personal WEB\n(https://mtalkportal.hmckmc.co.kr/).',
                  '이미 등록된 기기가 존재합니다.\n단말 관리 웹(https://mtalkportal.hmckmc.co.kr/)에서 기기변경 등록 후 사용하세요.'],
                  multipleDeviceErrorForHK2: ['The duplicate device is registered.\nPlease use the terminal \nafter the registration in the External Registration WEB\n(https://mtalk.hyundai.com/).',
                  '이미 등록된 기기가 존재합니다.\n외부사용자 웹(https://mtalk.hyundai.com/)에서 기기변경 등록 후 사용하세요.'],

                  apLoginServerError: ['Authentication failed.\nPlease contact the system administrator.',
                  '인증실패 하였습니다.\n시스템 관리자에 연락바랍니다.'],
                  apVersionNotSupported: ['The version can not access.\nPlease download the new version.',
                  '접속할 수 없는 버전입니다.\n새 버전을 다운받으세요.'],
                  //appstore 등록 후 정리
                  apDownloadDescForiOS: ['\n\nYou may also be downloaded\nfrom the link below.', '아래 링크에서 다운 받으실 수 있습니다.'],
                  // apDownloadDescForiOS: ['\n\nYou may also be downloaded\nfrom the AppStore.', 'AppStore에서 다운 받으실 수 있습니다.'],
                  //
                  apDownloadDescForAndroid: ['\n\nYou may also be downloaded\nfrom the PlayStore.', 'PlayStore에서 다운 받으실 수 있습니다.'],
                  apDeclineError: ['The unregistered client.\nPlease use the client after registration.', '등록되지 않은 단말입니다.\n단말등록 후 사용바랍니다.'],
                  apNotConnected: ['Unable to connect.\nPlease check your network.', '접속할 수 없습니다.\n네트워크를 확인해 주세요.'],
                  apInvalidCommand: ['Invalid command.', '잘못된 명령입니다.'],
                  apInvalidUserInfo: ['Invalid user info.', '사용자정보가 없습니다.'],

                  apInternalServerError: ['Internal Server Error', '시스템 에러입니다.'],
                  maxLimitChat: ['You can transfer up to a maximum size of 12K.', '최대크기 12K 까지 전송할 수 있습니다.'],
                  maxChatMember: ['You can do up to 150 people group conversation.', '150명까지 그룹대화를 할 수 있습니다.'],
                  maxGroupMember: ['You can create a group of up to 150 people.', '150명까지 그룹으로 만들 수 있습니다.'],
                  maxChooseMember: ['You can create a group of up to 150 people.', '본인을 포함하여 150명까지 선택할 수 있습니다.'],

                  maxLimitBoardPost: ['The maximum size for a text is 1000bytes.', '최대 1000byte까지 입력할 수 있습니다.'],
                  maxLimitBoardPostFile: ['You can only add 10 files to a post.', '게시물에는 최대 10개의 파일만 추가할 수 있습니다.'],

                  noNetwork: ['There is no network.\nYou can not login',
                        '연결된 네트워크가 없습니다. 로그인 할 수 없습니다.'],
                  noNetworkAlarm: ['There is no network.\nYou can not transfer the conversation',
                        '연결된 네트워크가 없습니다. 대화를 전송할 수 없습니다.'],
                  notChatYourself: ['Can not chat to yourself', '자신에게 채팅을 할 수 없습니다'],
                  downloadFail: ['Download fail.\nPlease check your network connection.', '다운로드 실패하였습니다.\n네트워크 연결을 확인해 주세요.'],
                  msgForSearching: ['Searching...', '검색중...'],

                  msgForLoading: ['Loading...', '가져오는 중...'],
                  setPWMsg: ['Please Set Password.', '암호를 설정해주세요.'],
                  successSendMail: ['Email sent successfully.', '이메일을 전송했습니다.'],
                  errorSendMail: ['Email transfer failed.', '이메일 전송에 실패했습니다.'],
                  eMailAccountInvalid: ['Failed to get registered e-mail account information.', '등록된 이메일 계정정보를 가져오지 못했습니다.'],
                  doNotUnlock: ['You cannot unlock for security reasons.', '보안 정책상 해제하실 수 없습니다.'],
                  allowPushForIphone: ['Please check device\'s \[Settings -> Notifications -> ' + appName + '\] \"Allow Notifications\" is on.\n Please turn on and restart app.',
                  	'디바이스의 \[설정 -> 알림 -> ' + appName + '\]의 \"알림허용\"이 켜져있는지 확인해주세요.\n 설정 후 App을 재시작해주세요.'],
                  allowPushForAndroid: ['Please check device\'s \[Settings -> More -> Application manager -> ' + appName + '\] \"Show Notifications\" is ckecked.\n Please check the checkbox and restart app.',
                        '디바이스의 \[설정 -> 어플리케이션 관리자 -> ' + appName + '\]의 \"알림표시\"가 체크되어 있는지 확인해주세요.\n 체크 후 App을 재시작해주세요.'],

                  convertErrorNotExistBefore: ['Source file is not exist.', '변환할 파일을 찾을 수 없습니다.'],
                  convertErrorNotExistAfter: ['Source file is not exist after save.', '저장한 파일을 찾을 수 없습니다.'],
                  convertErrorSaveBackup: ['Fail to save backup file.', '백업파일 저장에 실패했습니다.'],
                  convertErrorLoadData: ['Fail to load data of Source file.', '변환할 파일을 읽기에 실패했습니다.'],

                  SuccessImageUpload: ['The image is uploaded to the server has been completed.', '서버에 사진 업로드가 완료되었습니다.'],
                  SuccessVideoUpload: ['The video is uploaded to the server has been completed.', '서버에 동영상 업로드가 완료되었습니다.'],
                  FailImageUpload: ['The image uploaded to the server failed. Please try again later.', '서버에 사진 업로드가 실패했습니다. 잠시후 다시 시도해주세요'],

                  ConferenceAlertMsgBeta: ['You can use only 40 minutes during BETA period.', '베타기간 동안은 40분만 사용하실 수 있습니다.'],
                  ConferenceDuringTBeta: ['40 Min', '40 분'],
                  donotdisturbWarning: ['Please set on \'Do not disturb\'', '방해금지 시간설정 스위치를 켜주세요.'],

                  checkCameraRecordPermissionForIphone: ['Please check device\'s \[Settings -> ' + appName + ' -> Camera \] switch is on.\n Please turn on and try again.',
                  	'디바이스의 \[설정 -> ' + appName + ' -> 카메라 \]의 스위치가 켜져 있는지 확인해주세요.\n 설정 후 재시도 해주세요.'],
                  checkCameraRecordPermissionForAndroid: ['Please check device\'s \[Settings -> Application manager -> ' + appName + ' -> Permissions -> Camera \] switch is on.\n Please turn on and try again.',
                  	'디바이스의 \[설정 -> 어플리케이션 관리자 -> ' + appName + ' -> 권한 -> 카메라 \]의 스위치가 켜져 있는지 확인해주세요.\n 설정 후 재시도 해주세요.'],

                  createNewRoomWhenGroupChat: ['If invited in a group chat rooms,\ncreate into a new room.', '그룹대화방에서 초대 시\n새로운 방을 생성합니다.'],
                  confirmNewOrMoveRoom: ['There is the chat room of same members.\nMove to the room? or create a new room?', '동일 구성원의 대화방이 있습니다.\n이 방으로 이동하시겠습니까? 새로운 방을 생성하시겠습니까?'],

                  confirmDeleteContact: ['Are you sure you want to delete the contact?', '연락처를 삭제하시겠습니까?'],
                  alertNotDeleteOrg: ['He is an organization member. Can not be deleted.', '조직도 멤버입니다. 삭제할 수 없습니다.'],
                  alertNotDeleteGroup: ['He is a group member. Can not be deleted.', '그룹 멤버입니다. 삭제할 수 없습니다.'],
                  alertNotDeleteChat: ['There is chat history with him. Can not be deleted.', '대화이력이 있습니다. 삭제할 수 없습니다.'],
                  alertCanNotUseMedia: ['Media files you have selected is unsupported format or size.', '선택하신 미디어 파일은 지원하지 않는 형식이나 사이즈를 가지고 있습니다.'],

                  wrongEmail: ['Wrong E-mail Format', '잘못된 이메일 형식입니다.'],
                  duplicatedEmail: ['Following E-mail was duplicated', '아래 이메일은 중복 입력되었습니다.'],
                  emptyConfMember: ['please select Conference member over 1 person.', '1명 이상의 영상회의 멤버를 선택하세요.'],
                  emptyConfTitle: ['please Input Conference Title.', '영상회의 제목을 입력하세요.'],

                  failCreateConfRoom: ['Fail create Conference Room', '영상회의 생성에 실패 하였습니다.'],
                  failEditConfRoom: ['Fail edit Conference Room', '영상회의 정보 수정에 실패 하였습니다.'],
                  failDeleteConfRoom: ['Fail delete Conference Room', '영상회의 삭제에 실패 하였습니다.'],

                  alreadyFileExist: ['This file is Already Exist', '이미 존재하는 파일입니다.'],
                  NotSupportExt: [' extension is not supported.', '지원 하지 않는 File Type 입니다.'],

                  alreadyMemberExist: ['This Member is Already Exist in This Chat Room.', '참여된 멤버입니다.'],

                  alertInvalidTypeChar: ['Special character is not allowed.','특수문자는 허용되지 않습니다.'], /* web: not using this */

                  alreadyMemberRegister: ['This Member is Already Regist.', '이미 등록된 멤버입니다.'],
                  alreadyGroupRegister: ['This Group is Already Regist.', '이미 등록된 그룹입니다.'],
                  wrongMember: ['This User is not Regist.', '등록되지 않은 사용자입니다.'],
            }
      };

      var categoryKeys = Object.keys(localeText);
      for(var c=0, cn=categoryKeys.length ; c<cn ; c++){
            var categoryKey = categoryKeys[c];
            var categoryObject = localeText[categoryKey];

            var propertyKeys = Object.keys(categoryObject);
            for(var p=0, pn=propertyKeys.length ; p<pn ; p++){
                  var propertyKey = propertyKeys[p];
                  var propertyObject = categoryObject[propertyKey];

                  if(propertyObject[index]==undefined){
                        localeText[categoryKey][propertyKey] = propertyObject[0];
                  }
                  else{
                        localeText[categoryKey][propertyKey] = propertyObject[index];
                  }
            }
      }

      return localeText;
};

module.exports = UcText;

},{}],37:[function(require,module,exports){
// Copyright (c) 2013 Pieroxy <pieroxy@pieroxy.net>
// This work is free. You can redistribute it and/or modify it
// under the terms of the WTFPL, Version 2
// For more information see LICENSE.txt or http://www.wtfpl.net/
//
// For more information, the home page:
// http://pieroxy.net/blog/pages/lz-string/testing.html
//
// LZ-based compression algorithm, version 1.4.2
var LZString = {

  // private property
  _f : String.fromCharCode,
  _keyStrBase64 : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
  _keyStrUriSafe : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$",
  _getBaseValue : function(alphabet, character) {
    if (!LZString._baseReverseDic) LZString._baseReverseDic = {};
    if (!LZString._baseReverseDic[alphabet]) {
      LZString._baseReverseDic[alphabet] = {};
      for (var i=0 ; i<alphabet.length ; i++) {
        LZString._baseReverseDic[alphabet][alphabet[i]] = i;
      }
    }
    return LZString._baseReverseDic[alphabet][character];
  },

  compressToBase64 : function (input) {
    if (input == null) return "";
    var res = LZString._compress(input, 6, function(a){return LZString._keyStrBase64.charAt(a);});
    switch (res.length % 4) { // To produce valid Base64
    default: // When could this happen ?
    case 0 : return res;
    case 1 : return res+"===";
    case 2 : return res+"==";
    case 3 : return res+"=";
    }
  },

  decompressFromBase64 : function (input) {
    if (input == null) return "";
    if (input == "") return null;
    return LZString._decompress(input.length, 32, function(index) { return LZString._getBaseValue(LZString._keyStrBase64, input.charAt(index)); });
  },

  compressToUTF16 : function (input) {
    if (input == null) return "";
    return LZString._compress(input, 15, function(a){return String.fromCharCode(a+32);}) + " ";
  },

  decompressFromUTF16: function (compressed) {
    if (compressed == null) return "";
    if (compressed == "") return null;
    return LZString._decompress(compressed.length, 16384, function(index) { return compressed.charCodeAt(index) - 32; });
  },

  //compress into uint8array (UCS-2 big endian format)
  compressToUint8Array: function (uncompressed) {
    var compressed = LZString.compress(uncompressed);
    var buf=new Uint8Array(compressed.length*2); // 2 bytes per character

    for (var i=0, TotalLen=compressed.length; i<TotalLen; i++) {
      var current_value = compressed.charCodeAt(i);
      buf[i*2] = current_value >>> 8;
      buf[i*2+1] = current_value % 256;
    }
    return buf;
  },

  //decompress from uint8array (UCS-2 big endian format)
  decompressFromUint8Array:function (compressed) {
    if (compressed===null || compressed===undefined){
        return LZString.decompress(compressed);
    } else {
        var buf=new Array(compressed.length/2); // 2 bytes per character
        for (var i=0, TotalLen=buf.length; i<TotalLen; i++) {
          buf[i]=compressed[i*2]*256+compressed[i*2+1];
        }

        var result = [];
        buf.forEach(function (c) {
	  result.push(String.fromCharCode(c));
	});
        return LZString.decompress(result.join(''));

    }

  },


  //compress into a string that is already URI encoded
  compressToEncodedURIComponent: function (input) {
    if (input == null) return "";
    return LZString._compress(input, 6, function(a){return LZString._keyStrUriSafe.charAt(a);});
  },

  //decompress from an output of compressToEncodedURIComponent
  decompressFromEncodedURIComponent:function (input) {
    if (input == null) return "";
    if (input == "") return null;
    input = input.replace(/ /g, "+");
    return LZString._decompress(input.length, 32, function(index) { return LZString._getBaseValue(LZString._keyStrUriSafe, input.charAt(index)); });
  },

  compress: function (uncompressed) {
    return LZString._compress(uncompressed, 16, function(a){return String.fromCharCode(a);});
  },
  _compress: function (uncompressed, bitsPerChar, getCharFromInt) {
    if (uncompressed == null) return "";
    var i, value,
        context_dictionary= {},
        context_dictionaryToCreate= {},
        context_c="",
        context_wc="",
        context_w="",
        context_enlargeIn= 2, // Compensate for the first entry which should not count
        context_dictSize= 3,
        context_numBits= 2,
        context_data=[],
        context_data_val=0,
        context_data_position=0,
        ii,
        f=LZString._f;

    for (ii = 0; ii < uncompressed.length; ii += 1) {
      context_c = uncompressed[ii];
      if (!Object.prototype.hasOwnProperty.call(context_dictionary,context_c)) {
        context_dictionary[context_c] = context_dictSize++;
        context_dictionaryToCreate[context_c] = true;
      }

      context_wc = context_w + context_c;
      if (Object.prototype.hasOwnProperty.call(context_dictionary,context_wc)) {
        context_w = context_wc;
      } else {
        if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate,context_w)) {
          if (context_w.charCodeAt(0)<256) {
            for (i=0 ; i<context_numBits ; i++) {
              context_data_val = (context_data_val << 1);
              if (context_data_position == bitsPerChar-1) {
                context_data_position = 0;
                context_data.push(getCharFromInt(context_data_val));
                context_data_val = 0;
              } else {
                context_data_position++;
              }
            }
            value = context_w.charCodeAt(0);
            for (i=0 ; i<8 ; i++) {
              context_data_val = (context_data_val << 1) | (value&1);
              if (context_data_position == bitsPerChar-1) {
                context_data_position = 0;
                context_data.push(getCharFromInt(context_data_val));
                context_data_val = 0;
              } else {
                context_data_position++;
              }
              value = value >> 1;
            }
          } else {
            value = 1;
            for (i=0 ; i<context_numBits ; i++) {
              context_data_val = (context_data_val << 1) | value;
              if (context_data_position ==bitsPerChar-1) {
                context_data_position = 0;
                context_data.push(getCharFromInt(context_data_val));
                context_data_val = 0;
              } else {
                context_data_position++;
              }
              value = 0;
            }
            value = context_w.charCodeAt(0);
            for (i=0 ; i<16 ; i++) {
              context_data_val = (context_data_val << 1) | (value&1);
              if (context_data_position == bitsPerChar-1) {
                context_data_position = 0;
                context_data.push(getCharFromInt(context_data_val));
                context_data_val = 0;
              } else {
                context_data_position++;
              }
              value = value >> 1;
            }
          }
          context_enlargeIn--;
          if (context_enlargeIn == 0) {
            context_enlargeIn = Math.pow(2, context_numBits);
            context_numBits++;
          }
          delete context_dictionaryToCreate[context_w];
        } else {
          value = context_dictionary[context_w];
          for (i=0 ; i<context_numBits ; i++) {
            context_data_val = (context_data_val << 1) | (value&1);
            if (context_data_position == bitsPerChar-1) {
              context_data_position = 0;
              context_data.push(getCharFromInt(context_data_val));
              context_data_val = 0;
            } else {
              context_data_position++;
            }
            value = value >> 1;
          }


        }
        context_enlargeIn--;
        if (context_enlargeIn == 0) {
          context_enlargeIn = Math.pow(2, context_numBits);
          context_numBits++;
        }
        // Add wc to the dictionary.
        context_dictionary[context_wc] = context_dictSize++;
        context_w = String(context_c);
      }
    }

    // Output the code for w.
    if (context_w !== "") {
      if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate,context_w)) {
        if (context_w.charCodeAt(0)<256) {
          for (i=0 ; i<context_numBits ; i++) {
            context_data_val = (context_data_val << 1);
            if (context_data_position == bitsPerChar-1) {
              context_data_position = 0;
              context_data.push(getCharFromInt(context_data_val));
              context_data_val = 0;
            } else {
              context_data_position++;
            }
          }
          value = context_w.charCodeAt(0);
          for (i=0 ; i<8 ; i++) {
            context_data_val = (context_data_val << 1) | (value&1);
            if (context_data_position == bitsPerChar-1) {
              context_data_position = 0;
              context_data.push(getCharFromInt(context_data_val));
              context_data_val = 0;
            } else {
              context_data_position++;
            }
            value = value >> 1;
          }
        } else {
          value = 1;
          for (i=0 ; i<context_numBits ; i++) {
            context_data_val = (context_data_val << 1) | value;
            if (context_data_position == bitsPerChar-1) {
              context_data_position = 0;
              context_data.push(getCharFromInt(context_data_val));
              context_data_val = 0;
            } else {
              context_data_position++;
            }
            value = 0;
          }
          value = context_w.charCodeAt(0);
          for (i=0 ; i<16 ; i++) {
            context_data_val = (context_data_val << 1) | (value&1);
            if (context_data_position == bitsPerChar-1) {
              context_data_position = 0;
              context_data.push(getCharFromInt(context_data_val));
              context_data_val = 0;
            } else {
              context_data_position++;
            }
            value = value >> 1;
          }
        }
        context_enlargeIn--;
        if (context_enlargeIn == 0) {
          context_enlargeIn = Math.pow(2, context_numBits);
          context_numBits++;
        }
        delete context_dictionaryToCreate[context_w];
      } else {
        value = context_dictionary[context_w];
        for (i=0 ; i<context_numBits ; i++) {
          context_data_val = (context_data_val << 1) | (value&1);
          if (context_data_position == bitsPerChar-1) {
            context_data_position = 0;
            context_data.push(getCharFromInt(context_data_val));
            context_data_val = 0;
          } else {
            context_data_position++;
          }
          value = value >> 1;
        }


      }
      context_enlargeIn--;
      if (context_enlargeIn == 0) {
        context_enlargeIn = Math.pow(2, context_numBits);
        context_numBits++;
      }
    }

    // Mark the end of the stream
    value = 2;
    for (i=0 ; i<context_numBits ; i++) {
      context_data_val = (context_data_val << 1) | (value&1);
      if (context_data_position == bitsPerChar-1) {
        context_data_position = 0;
        context_data.push(getCharFromInt(context_data_val));
        context_data_val = 0;
      } else {
        context_data_position++;
      }
      value = value >> 1;
    }

    // Flush the last char
    while (true) {
      context_data_val = (context_data_val << 1);
      if (context_data_position == bitsPerChar-1) {
        context_data.push(getCharFromInt(context_data_val));
        break;
      }
      else context_data_position++;
    }
    return context_data.join('');
  },

  decompress: function (compressed) {
    if (compressed == null) return "";
    if (compressed == "") return null;
    return LZString._decompress(compressed.length, 32768, function(index) { return compressed.charCodeAt(index); });
  },

  _decompress: function (length, resetValue, getNextValue) {
    var dictionary = [],
        next,
        enlargeIn = 4,
        dictSize = 4,
        numBits = 3,
        entry = "",
        result = [],
        i,
        w,
        bits, resb, maxpower, power,
        c,
        f = LZString._f,
        data = {val:getNextValue(0), position:resetValue, index:1};

    for (i = 0; i < 3; i += 1) {
      dictionary[i] = i;
    }

    bits = 0;
    maxpower = Math.pow(2,2);
    power=1;
    while (power!=maxpower) {
      resb = data.val & data.position;
      data.position >>= 1;
      if (data.position == 0) {
        data.position = resetValue;
        data.val = getNextValue(data.index++);
      }
      bits |= (resb>0 ? 1 : 0) * power;
      power <<= 1;
    }

    switch (next = bits) {
      case 0:
          bits = 0;
          maxpower = Math.pow(2,8);
          power=1;
          while (power!=maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position == 0) {
              data.position = resetValue;
              data.val = getNextValue(data.index++);
            }
            bits |= (resb>0 ? 1 : 0) * power;
            power <<= 1;
          }
        c = f(bits);
        break;
      case 1:
          bits = 0;
          maxpower = Math.pow(2,16);
          power=1;
          while (power!=maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position == 0) {
              data.position = resetValue;
              data.val = getNextValue(data.index++);
            }
            bits |= (resb>0 ? 1 : 0) * power;
            power <<= 1;
          }
        c = f(bits);
        break;
      case 2:
        return "";
    }
    dictionary[3] = c;
    w = c;
    result.push(c);
    while (true) {
      if (data.index > length) {
        return "";
      }

      bits = 0;
      maxpower = Math.pow(2,numBits);
      power=1;
      while (power!=maxpower) {
        resb = data.val & data.position;
        data.position >>= 1;
        if (data.position == 0) {
          data.position = resetValue;
          data.val = getNextValue(data.index++);
        }
        bits |= (resb>0 ? 1 : 0) * power;
        power <<= 1;
      }

      switch (c = bits) {
        case 0:
          bits = 0;
          maxpower = Math.pow(2,8);
          power=1;
          while (power!=maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position == 0) {
              data.position = resetValue;
              data.val = getNextValue(data.index++);
            }
            bits |= (resb>0 ? 1 : 0) * power;
            power <<= 1;
          }

          dictionary[dictSize++] = f(bits);
          c = dictSize-1;
          enlargeIn--;
          break;
        case 1:
          bits = 0;
          maxpower = Math.pow(2,16);
          power=1;
          while (power!=maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position == 0) {
              data.position = resetValue;
              data.val = getNextValue(data.index++);
            }
            bits |= (resb>0 ? 1 : 0) * power;
            power <<= 1;
          }
          dictionary[dictSize++] = f(bits);
          c = dictSize-1;
          enlargeIn--;
          break;
        case 2:
          return result.join('');
      }

      if (enlargeIn == 0) {
        enlargeIn = Math.pow(2, numBits);
        numBits++;
      }

      if (dictionary[c]) {
        entry = dictionary[c];
      } else {
        if (c === dictSize) {
          entry = w + w[0];
        } else {
          return null;
        }
      }
      result.push(entry);

      // Add w+entry[0] to the dictionary.
      dictionary[dictSize++] = w + entry[0];
      enlargeIn--;

      w = entry;

      if (enlargeIn == 0) {
        enlargeIn = Math.pow(2, numBits);
        numBits++;
      }

    }
  }
};

if( typeof module !== 'undefined' && module != null ) {
  module.exports = LZString
}

},{}],38:[function(require,module,exports){
'use strict';

function UcSocket(){

    let websocket = null;

    let address = "";
    let _isConnected = false;

    function createSocket(params){
        websocket = new WebSocket(address);

        if(params){
            websocket.onopen = params.onOpen;
            websocket.onmessage = params.onMessage;
            websocket.onerror = params.onError;
            websocket.onclose = params.onClose;
        }
        else{
            websocket.onopen = function(ev){
                _isConnected = true;
            };

            websocket.onclose = function(ev){
                GLOBAL.error('websocket closed. code=' + ev.code + ', reason=' + ev.reason);
                _isConnected = false;
                websocket = null;
            };

            websocket.onerror = function(ev){
                GLOBAL.error('websocket error = ' +  ev.error);
                _isConnected = false;
                websocket = null;
            };

            websocket.onmessage = function(ev){
                GLOBAL.info('websocket recv:' + ev.data);
            };
        }
    };

    this.open = function(addr , params){
        GLOBAL.info('websocket open addr=' + addr);
        if(addr!==undefined&&addr!==null){
            _isConnected = false;
            address = addr;
            createSocket(params);
        }
    };

    this.close = function(tag){
        GLOBAL.info('websocket close tag = ' + tag + ' addr=' + address);
        if(websocket!==null){
            websocket.close();
            websocket = null;
        }
    };

    this.send = function(arg){
        try{
            if(websocket!=null){
                GLOBAL.info('websocket send:' + arg);
                websocket.send(arg);
                return true;
            }
        }
        catch(error){
            GLOBAL.error('send error=' + error);
            _isConnected = false;
            if(websocket!=null){
                websocket.close();
                return false;
            }
        }
    };

    return this;
}

module.exports = UcSocket;

},{}],39:[function(require,module,exports){
(function (global){
/*
* Determines the global context. This should be either window (in the)
* case where we are in a browser) or global (in the case where we are in
* node)
*/
var globalContext;

if(typeof window == 'undefined') {
    globalContext = global;
}
else {
    globalContext = window;
}

if (!globalContext) {
    var error = new Error('Unable to set the global context to either window or global.');
    throw error;
    error = null;
}

module.exports = globalContext;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],40:[function(require,module,exports){
var globalcontext = require('./global-context');
var GLOBAL = new (require('./GlobalFunctions'));    globalcontext.GLOBAL = GLOBAL; globalcontext.CONST = GLOBAL.CONST;

var language = '';
if( navigator.language!==undefined){
    language = navigator.language;
}
else{
    if(navigator.languages!==undefined){
        language = navigator.languages[0];
    }
    else{
        language = navigator.browserLanguage;
    }
}

var confid = '#vconf3@linearhub.com';
if(window.location.hostname.indexOf('roundee.io')!==-1||window.location.hostname.indexOf('dev0.roundee.com')!==-1){
    confid = '#vconf2@linearhub.com';
}

// var UcText = new (require('./UcText'))(language, 'Roundee');    globalcontext.LOCALE = UcText;
var UcText = new (require('./UcText'))('en', 'Roundee');    globalcontext.LOCALE = UcText;
var StringZip = require('./common/lz-string'); globalcontext.StringZip = StringZip;
var UcEngine = new (require('./ucEngine/UcEngine'))(confid);   globalcontext.ucEngine = UcEngine;

},{"./GlobalFunctions":35,"./UcText":36,"./common/lz-string":37,"./global-context":39,"./ucEngine/UcEngine":44}],41:[function(require,module,exports){
function ChatEngine(){
    this._engineName = 'chats';

    this.start = function(){
        // Get All sing and group room, but it's Unnecessary for roundee io
        // ucEngine.sendRequestGets('usr.sxr');
        // ucEngine.sendRequestGets('usr.gxr');
    };


    this.getChatRoomInfo = function(istype, roomid, reqParam){
        if(istype===0){             // single room
            if(reqParam!==undefined&&reqParam.requestType!==undefined){
                ucEngine.webSocketSend(['xget.sys.sxr', {key: roomid, scanByKey: true}], null, reqParam);
            }
            else{
                ucEngine.webSocketSend(['xget.usr.sxr', {key: roomid, scanByKey: true}], null, reqParam);
            }
        }
        else{                           // group room
            if(reqParam!==undefined&&reqParam.requestType!==undefined){
                ucEngine.webSocketSend(['xget.sys.gxr', {key: roomid, scanByKey: true}], null, reqParam);
            }
            else{
                ucEngine.webSocketSend(['xget.usr.gxr', {key: roomid, scanByKey: true}], null, reqParam);
            }
        }
    };

    this.getChatMsgData = function(istype, roomid, reqParam){
        if(istype===0){
            ucEngine.webSocketSend(['xscan.sys.sxd', {fk0: roomid, scanByKey: true}], null, reqParam);
        }
        else{
            ucEngine.webSocketSend(['xscan.sys.gxd', {fk0: roomid, scanByKey: true}], null, reqParam);
        }
    };

    this.getChatMsgDataY = function(istype, roomid, reqParam){
        if(istype===0){
            ucEngine.webSocketSend(['yscan.sys.sxd', {fk0: roomid, scanByKey: true}], null, reqParam);
        }
        else{
            ucEngine.webSocketSend(['yscan.sys.gxd', {fk0: roomid, scanByKey: true}], null, reqParam);
        }
    };

    this.updateChatRoom = function(istype, roomid, updatedata, requestParam){
        if(istype===0){
            ucEngine.webSocketSend(['xfset.sys.sxr', {key:roomid}], updatedata, requestParam);
        }
        else{
            ucEngine.webSocketSend(['xfset.sys.gxr', {key:roomid}], updatedata, requestParam);
        }
    };

    this.sendMsgData = function(roomid, isConference, body){
        let requestCmd;
        let msgID = body.msgID;
        let cmdType = '';

        let headerParam = {fk0: roomid};
        if(body.msgType == CONST.CHAT_TYPE_INVITE){
            if(isConference==1){
            	requestCmd = 'xinv.sys.gxd';
                headerParam.mid = msgID;
                headerParam.memb = 'member';
				let member = body.msgData.split(',');
                body.type = 'invite';
                body.member = member;
            }
        }
        else if(body.msgType == CONST.CHAT_TYPE_KICK){
            if(isConference==1){
                requestCmd = 'kick.sys.gxd';
                headerParam.mid = msgID;
                headerParam.memb = 'member';
                let member = body.msgData.split(',');
                body.type = 'kick';
                body.member = member;
            }
        }
        else{
            if(isConference==1){
        		requestCmd = 'xsend.sys.gxd';
            }
            else{
        		requestCmd = 'xsend.sys.sxd';
            }

            switch(body.msgType){
                case CONST.CHAT_TYPE_TEXT: case CONST.CHAT_TYPE_NOTE:{
                    cmdType = body.msgType;
                    // if(body.msgData.length > 2*1024){
                    //     cmdType = 'large-text';
                    //     let orginalData = body.msgData;
                    //     let compressedData = StringZip.compressToEncodedURIComponent(orginalData);
                    //     if ( compressedData != undefined && compressedData != null ){
                    //     	body.msgData = orginalData.substring(0, 40);
                    //     	body.zip = compressedData;
                    //     }
                    // }
                }
                break;
                case CONST.CHAT_TYPE_IMAGE:
                case CONST.CHAT_TYPE_VIDEO:
                case CONST.CHAT_TYPE_VOICE:
                case CONST.CHAT_TYPE_MUSIC:
                case CONST.CHAT_TYPE_DOC:{
                    cmdType = body.msgType;
                    let msgObject = GLOBAL.transStrToObj(body.msgData);
                    delete msgObject.originalPath;
                    delete msgObject.thumbnailPath;
                    body.msgData = msgObject;
                }
                break;
                case CONST.CHAT_TYPE_MAP:           cmdType = 'map';            break;
                case CONST.CHAT_TYPE_GROUP_NOTICE:  cmdType = 'group-notice';            break;
                default:                            cmdType = 'post';   break;
            }

    		let pushParam = [];
    		let solrObj = {content: ['$msgData'], msgID_s: '$msgID', msgDateTime_s: '$msgDateTime', recordtimer_s: '$recordtimer'};
    		let searchField = [];
    		if(body.msgType==CONST.CHAT_TYPE_TEXT || body.msgType==CONST.CHAT_TYPE_NOTE){
    			pushParam.push('msgData');
    			pushParam.push(GLOBAL.getMyName());
    			searchField.push('$msgData');
    		}
            else if(body.msgType==CONST.CHAT_TYPE_IMAGE || body.msgType==CONST.CHAT_TYPE_VIDEO
                || body.msgType==CONST.CHAT_TYPE_DOC || body.msgType==CONST.CHAT_TYPE_MUSIC){
    			pushParam.push('msgType');
    			pushParam.push(GLOBAL.getMyName());

                if(body.msgData.name!=undefined){
                    searchField.push('$msgData.name');
                    solrObj.fileName_s = '$msgData.name';
                }
                if(body.msgData.title!=undefined){
                    searchField.push('$msgData.title');
                    solrObj.fileTitle_t = '$msgData.title';
                }

                if(body.msgData.description!=undefined){
                    searchField.push('$msgData.description');
                    solrObj.fileDesc_t = '$msgData.description';
                }
    			solrObj.expireTime_dt = body.msgData.expireTime;
    		}
    		headerParam.solr = solrObj;
    		headerParam.push = pushParam;

			if(searchField.length > 0 ){
				solrObj.search_txt = searchField;
			}

    		body.type = cmdType;
        }
        delete body.transferStatus;

        // if(body.msgData.length > 6*1024){
        //     ucDB.updateData({table: 'log_msg', needSync: false, isEventFire: true,
        //         data: {transferStatus: CONST.CHAT_TRANSFER_FAILED}, selection: 'msgID=?', selectionArgs: msgID,
        //         eventParam: {listID: listID, msgID: msgID}
        //     });
        //     return;
        // }

        delete body.uniqueHash;
        delete body.rowid;
        delete body.keyState;

        //UcEngine에서 만들어 준다.
        //body.msgDateTime = GLOBAL.getTimeString();

        ucEngine.webSocketSend([requestCmd, headerParam], body, {listID: roomid, msgID: msgID, cmdType: cmdType});
    };

    this.updateMsgItem = function(roomID, keyID, updatedata, requestParam){
        ucEngine.webSocketSend(['xfset.sys.gxd', {fk0: roomID, key: keyID}], updatedata, requestParam)
    };

    this.deleteMsgItem = function(roomID, keyID, requestParam){
        ucEngine.webSocketSend(['xfdel.sys.gxd', {fk0: roomID, key: keyID}], null, requestParam);
    };

    this.sendReadData = function(roomid, keyID, msgID, roomType){
        let readcmd = 'xread.sys.sxs';
        if(roomType===1){
            readcmd = 'xread.sys.gxs';
        }
        GLOBAL.removereadcnt = 0;
        ucEngine.webSocketSend([readcmd, {fk0: roomid, key: keyID}], {readTime: GLOBAL.getTimeString()}, {listID: roomid, msgID: msgID, cmdType:'read'});
    };

    this._messageHandler = function(e){
        let responseCmd = e.header[1];
        switch(e.requestParam.requestCmd){
            case 'xget.usr.sxr': case 'xget.usr.gxr': case 'xget.sys.gxr': {
                switch(responseCmd){
                    case 200: {
                        let meta = GLOBAL.clone(e.body['.meta']);
                        delete e.body['.meta'];
                        let serverRecord = GLOBAL.clone(e.body);

                        let cud = meta['!cud'];
                        let roomid = meta['!key'];

                        serverRecord.keyID = roomid;
                        serverRecord.seqID = meta['!seq'];
                        // serverRecord.unreadcnt = meta['.unread'] - GLOBAL.removereadcnt;
                        serverRecord.unreadcnt = meta['.unread'];

                        if(cud==='d' ){
                            // let record = GLOBAL.db.peekRecord('conferenceroom', roomid);
                            // if(record){
                            //     GLOBAL.db.unload(record);
                            // }
                            GLOBAL.db.unloadAll('conferenceroom');
                            GLOBAL.db.unloadAll('member');
                            GLOBAL.db.unloadAll('recording');
                        }
                        else{
                            let members = [];
                            // for(let i=0, n=serverRecord.members.length; i<n; i++){
                            //     let memberid = serverRecord.members[i];
                            //     let email = serverRecord.emails[i];
                            //     let info = null;
                            //     for(let j=0, m=serverRecord.cmembers.length; j<m; j++){
                            //         if(serverRecord.cmembers[j].userid===memberid){
                            //             info = GLOBAL.clone(serverRecord.cmembers[j]);
                            //             break;
                            //         }
                            //     }
                            //     if(info!==null){
                            //         info.email = email;
                            //     }
                            //     else{
                            //         info = {userid: memberid, email: email};
                            //     }
                            //     members.push({id: info.userid, type: 'member', attributes:info});
                            // }
                            if(serverRecord.name!==undefined&&serverRecord.name!==null){
                                GLOBAL.lastreadkey = meta['.keyRW'];
                                if(serverRecord.cmembers!==undefined){
                                    for(let i=0, n=serverRecord.cmembers.length; i<n; i++){
                                        info = GLOBAL.clone(serverRecord.cmembers[i]);
                                        members.push({id: info.userid, type: 'member', attributes:info});

                                        if(info.userid===GLOBAL.getMyID()){
                                            GLOBAL.setMyName(info.displayname);
                                        }

                                        let msgs = GLOBAL.db.peekAll('logmsg').toArray();
                                        for(let j=0, m=msgs.length; j<m; j++){
                                            if(msgs[j].get('sender')===info.userid&&msgs[j].get('senderName')!==info.displayname){
                                                msgs[j].set('senderName', info.displayname);
                                            }
                                        }
                                    }

                                    if(members.length>0){
                                        GLOBAL.db.push({data:members});
                                    }
                                }

                                let recordings = [];
                                if(serverRecord.recordings!==undefined){
                                    let recording = serverRecord.recordings;
                                    for(let i=0, n=recording.length; i<n; i++){
                                        recordings.push({id: recording[i].start_time, type: 'recording', attributes:  recording[i]});
                                    }

                                    if(recordings.length>0){
                                        GLOBAL.db.push({data:recordings});
                                    }
                                }
                                GLOBAL.db.push({data: {id: roomid, type: 'conferenceroom', attributes: serverRecord}});
                            }
                            else{
                                sessionStorage.clear();
                                window.location.replace('https://www.roundee.io/result_page_expired.html');
                                return;
                            }
                        }

                        if(e.requestParam.onComplete){
                            e.requestParam.onComplete();
                        }
                    }
                    break;
                    default: {
                        if(e.requestParam.onError){
                            e.requestParam.onError(e.requestParam.requestCmd);
                        }
                    }
                    break;
                }
            }
            break;
            case 'xscan.sys.sxd': case 'xscan.sys.gxd': case 'yscan.sys.sxd': case 'yscan.sys.gxd':{
                switch(responseCmd){
                    case 200:{
                        let param = e.requestParam;
                        let roomid = e.requestParam.requestSubCmd;

						if(param.datas==undefined){
							param.datas = [];
							param.keys = [];
							param.dataIndex = {};
						}

                        let storedata = [];
                        let notedatas = [];
                        let dataIndex = param.datas.length;
				        param.datas = param.datas.concat(e.body);

                        for(let i=0, n=e.body.length ; i<n ; i++){
                            if(e.body[i][".meta"]["!cud"]==='d'){
                                continue;
                            }
                            let key = e.body[i]['.meta']['!key'];
                            param.keys.push(key);
                            param.dataIndex[key] = dataIndex + i;

                            e.body[i]['seqID'] = e.body[i]['.meta']['!seq'];
                            if(e.body[i]['sender']==undefined){
                                e.body[i]['sender'] = e.body[i]['.meta']['.sender'];
                            }
                            if(e.body[i]['msgType']==undefined){
                                e.body[i]['msgType'] = e.body[i]['type'];
                            }

                            let sendername = e.body[i]['sender'].split('@')[0];
                            if(e.body[i]['senderName']){
                                sendername = e.body[i]['senderName'];
                            }

                            let senderinfo = GLOBAL.db.peekRecord('member', e.body[i]['sender']);
                            if(senderinfo){
                                sendername = senderinfo.get('displayname');
                            }
                            else{
                                sendername = undefined;
                            }

                            // if(e.body[i]['msgType']===CONST.CHAT_TYPE_TEXT){
                            //     storedata.push({id: e.body[i]['msgID'], type: 'logmsg', attributes: {
                            //         keyID: key,
                            //         seqID: e.body[i]['seqID'],
                            //         roomID: roomid,
                            //         msgID: e.body[i]['msgID'],
                            //         sender: e.body[i]['sender'],
                            //         senderName: sendername,
                            //         isMyMsg: e.body[i]['sender']===GLOBAL.getMyID()?1:0,
                            //         msgDateTime: e.body[i]['msgDateTime'],
                            //         msgType: e.body[i]['msgType'],
                            //         msgData: e.body[i]['msgData'],
                            //     }});
                            // }
                            // else if(e.body[i]['msgType']===CONST.CHAT_TYPE_INVITE){
                            //     if(GLOBAL.lastreadkey !==undefined && key > GLOBAL.lastreadkey){
                            //         GLOBAL.removereadcnt++;
                            //     }
                            // }
                            // else if(e.body[i]['msgType']===CONST.CHAT_TYPE_KICK){
                            //     if(GLOBAL.lastreadkey !==undefined && key > GLOBAL.lastreadkey){
                            //         GLOBAL.removereadcnt++;
                            //     }
                            // }

                            if(e.body[i]['msgType']===CONST.CHAT_TYPE_NOTE){
                                let notedata = {
                                    keyID: key,
                                    seqID: e.body[i]['seqID'],
                                    roomID: roomid,
                                    noteID: e.body[i]['msgID'],
                                    noteMsg: e.body[i]['msgData'],
                                    noteTimer: e.body[i]['recordtimer'],
                                    noteType: e.body[i]['noteType']
                                };
                                notedatas.push({id: e.body[i]['msgID'], type: 'notes', attributes: notedata});
                            }
                            else{
                                let chatdata = {
                                    keyID: key,
                                    seqID: e.body[i]['seqID'],
                                    roomID: roomid,
                                    msgID: e.body[i]['msgID'],
                                    sender: e.body[i]['sender'],
                                    senderName: sendername,
                                    isMyMsg: e.body[i]['sender']===GLOBAL.getMyID()?1:0,
                                    msgDateTime: e.body[i]['msgDateTime'],
                                    msgType: e.body[i]['msgType']
                                };

                                if(e.body[i]['msgType']===CONST.CHAT_TYPE_TEXT){
                                    chatdata.msgData =  e.body[i]['msgData'];
                                }
                                else if(e.body[i]['msgType']===CONST.CHAT_TYPE_IMAGE){
                                }
                                else if(e.body[i]['msgType']===CONST.CHAT_TYPE_VIDEO){
                                }
                                else if(e.body[i]['msgType']===CONST.CHAT_TYPE_DOC){
                                }
                                else{
                                    let actionmemberinfo = e.body[i].member;
                                    let actionmembers = "";
                                    actionmemberinfo.forEach(function(member){
                                        let info = GLOBAL.db.peekRecord('member', member);
                                        if(info){
                                            actionmembers += info.get('displayname');
                                        }
                                        else{
                                            actionmembers += member;
                                        }
                                        actionmembers += " ";
                                    }.bind(this));

                                    let isMy = actionmemberinfo.findIndex(function(member){
                                        return member===GLOBAL.getMyID();
                                    });
                                    if(e.body[i]['msgType']===CONST.CHAT_TYPE_INVITE){
                                        chatdata.msgData =  isMy!==-1?LOCALE.message.Entered:actionmembers + LOCALE.message.isEntered;
                                    }
                                    else if(e.body[i]['msgType']===CONST.CHAT_TYPE_KICK){
                                        chatdata.msgData =  isMy!==-1?LOCALE.message.Exited:actionmembers + LOCALE.message.wentOut;
                                    }
                                }
                                if(e.body[i]['msgType']===CONST.CHAT_TYPE_TEXT||e.body[i]['msgType']===CONST.CHAT_TYPE_IMAGE||e.body[i]['msgType']===CONST.CHAT_TYPE_DOC||e.body[i]['msgType']===CONST.CHAT_TYPE_VIDEO){
                                    GLOBAL.error(e.body[i]['msgType']);
                                    storedata.push({id: e.body[i]['msgID'], type: 'logmsg', attributes: chatdata});
                                }


                                if(GLOBAL.lastmsginfo.keyID===undefined){
                                    GLOBAL.lastmsginfo = { keyID: key, msgID: e.body[i]['msgID']};
                                }
                                else{
                                    if(GLOBAL.lastmsginfo.keyID < key){
                                        GLOBAL.lastmsginfo = { keyID: key, msgID: e.body[i]['msgID']};
                                    }
                                }
                            }
	    				}

                        if(GLOBAL.db){
                            if(storedata.length>0){
                                GLOBAL.db.push({data:storedata});
                            }
                            if(notedatas.length > 0){
                                GLOBAL.db.push({data:notedatas});
                            }
                        }

                        if(e.endPacket===true){
                            let roominfo = GLOBAL.db.peekRecord('conferenceroom', roomid);
                            if(roominfo){
                                GLOBAL.db.push({data:{ id: roomid, type: 'conferenceroom', attributes: {unreadcnt: roominfo.get('unreadcnt') - GLOBAL.removereadcnt} }});
                            }
                            if(param.onComplete!==undefined){
                                param.onComplete(param);
                            }
                        }
                        return true;
                    }
                    break;
                }
            }
            break;
            case 'xsend.sys.sxd': 	case 'xsend.sys.gxd':{
                switch(responseCmd){
                    case 200: {
                        let meta = e.body['.meta'];
                        if(meta['!cud']==='c'){
                            let msgID = e.requestParam.msgID;
                            GLOBAL.db.push({data:{id: msgID, type: e.requestParam.cmdType===CONST.CHAT_TYPE_NOTE?'notes':'logmsg', attributes:{
                                keyID: meta['!key'],
                                seqID: meta['!seq']
                            }}});
                        }
                        if(e.requestParam.onComplete!==undefined){
                            e.requestParam.onComplete(e.requestParam);
                        }
                        GLOBAL.setLastSeqID(e.requestParam.requestCmd+'?'+e.requestParam.requestSubCmd, meta['!seq']);

                        return true;
                    }
                    break;

                    case 404:	case 999:{
                        if(e.requestParam.onFail!==undefined){
                            e.requestParam.onFail(e.requestParam);
                        }
                        return true;
                    }
                    break;
                }
            }
            break;
            case 'xread.sys.sxs': case 'xread.sys.gxs': {
                switch(responseCmd){
                    case 200:  {
                    	let serverRecord = e.body;
                        let seqID = serverRecord['!seq'];
                        let unreadCount = serverRecord['.unread'];
                        let roomid = e.requestParam.listID;

                    	if(e.requestParam.requestCmd=='xread.sys.sxs'){
                    		unreadCount = 0;
                    	}
                        GLOBAL.db.push({data: {id:roomid, type:'conferenceroom', attributes: {unreadcnt: unreadCount}}});
                        GLOBAL.setLastSeqID(e.requestParam.requestCmd+'?'+e.requestParam.requestSubCmd, seqID);
                        return true;
                    }
                    break;
                    case 202:  {
                        GLOBAL.info("xread cmd response code = " + responseCmd);
                        return true;
                    }
                    break;
                    case 404:	{
                    	// let unreadCount;
                        // if(e.requestParam.requestCmd=='xread.sys.sxs'){
                        //     unreadCount = 0;
                        // }
                        GLOBAL.info("xread cmd response code = " + responseCmd);
                        return true;
                    }
                    break;
                    case 409:{
                    	// var cmdClass;
                    	// if(e.requestParam.requestCmd=='xread.sys.sxs'){
                        // 	cmdClass = 'sys.sxs';
                        // }
                        // else{
                        // 	cmdClass = 'sys.gxs';
                        // }
                        GLOBAL.info("xread cmd response code = " + responseCmd);
                    	return true;
                    }
                    break;
                }
            }
            break;
            case 'xfset.sys.sxr': case 'xfset.sys.gxr': {

            }
            break;
            case 'xfdel.sys.sxd': case 'xfdel.sys.gxd': {
                switch(responseCmd){
                    case 200: {
                        if(e.requestParam.onComplete!==undefined){
                            e.requestParam.onComplete(e.requestParam);
                        }
                        return true;
                    }
                    break;

                    case 404:	case 999:{
                        if(e.requestParam.onFail!==undefined){
                            e.requestParam.onFail(e.requestParam);
                        }
                        return true;
                    }
                    break;
                }
            }
            break;
            case 'xfset.sys.sxd': case 'xfset.sys.gxd': {
                switch(responseCmd){
                    case 200: {
                        if(e.requestParam.onComplete!==undefined){
                            e.requestParam.onComplete(e.requestParam);
                        }
                        return true;
                    }
                    break;

                    case 404:	case 999:{
                        if(e.requestParam.onFail!==undefined){
                            e.requestParam.onFail(e.requestParam);
                        }
                        return true;
                    }
                    break;
                }
            }
            break;
        }
    };

    return this;
}

module.exports = ChatEngine;

},{}],42:[function(require,module,exports){
function ConferenceEngine(confid){
    this._engineName = 'conf';
    GLOBAL.error("conferenceid = " + confid);
    if(confid===undefined||confid===null||confid===""){
        this.conferenceid = '#vconf2@linearhub.com';
    }
    else{
        this.conferenceid = confid;
    }
    this._peerIM = '';

    this.setPeerIm = function(peerIM){
        this._peerIM = peerIM;
    };

    this.getPeerIm = function(controller, reqParam){
        // watch.usr.dev Message를 보내야 함.
        ucEngine.webSocketSend(['watch.usr.dev', [this.conferenceid, 'once']], null, reqParam);
    };

    this.getchatData = function(confroomID, _body, reqParam){
        let body = GLOBAL.clone(_body);
        ucEngine.webSocketSend(['msg.com', [[this.conferenceid],['scan', confroomID]]], body, reqParam);
    };

    this.newConferenceReserve = function(confroomID, _body, reqParam){
        let body = GLOBAL.clone(_body);
        ucEngine.webSocketSend(['msg.com', [[this.conferenceid],['create', confroomID]]], body, reqParam);
    };

    this.updateConferenceReserve = function(confroomID,  _body, reqParam){
        let body = GLOBAL.clone(_body);
        ucEngine.webSocketSend(['msg.com', [[this.conferenceid],['update', confroomID]]], body, reqParam);
    };

    this.inviteConferenceRoom = function(confroomID, _body, reqParam){
        let body = GLOBAL.clone(_body);
        ucEngine.webSocketSend(['msg.com', [[this.conferenceid, this._peerIM],['invite', confroomID]]], body, reqParam);
    };

    this.joinConferenceRoom = function(confroomID, _body, reqParam){
        let body = GLOBAL.clone(_body);
        if(this._peerIM){
            ucEngine.webSocketSend(['msg.com', [[this.conferenceid, this._peerIM],['join', confroomID]]], body, reqParam);
        }
        else{
            ucEngine.webSocketSend(['msg.com', [[this.conferenceid],['join', confroomID]]], body, reqParam);
        }
    };

    this.deleteConferenceRoom = function(confroomID, reqParam){
        ucEngine.webSocketSend(['msg.com', [[this.conferenceid],['delete', confroomID]]], null, reqParam);
    };

    this.exitConferenceRoom = function(confroomID, _body, reqParam){
        let body = GLOBAL.clone(_body);
        ucEngine.webSocketSend(['msg.com', [[this.conferenceid, this._peerIM],['exit', confroomID]]], body, reqParam);
    };

    this.updateConferenceUser = function(confroomID, _body, reqParam){
        let body = GLOBAL.clone(_body);
        ucEngine.webSocketSend(['msg.com', [[this.conferenceid, this._peerIM],['user_update', confroomID]]], body, reqParam);
    };

    this.sendOffer = function(confroomID, body, reqParam){
        ucEngine.webSocketSend(['msg.com', [[this.conferenceid, this._peerIM],['offer', confroomID]]], body, reqParam);
    };

    this.updateViewerInfo = function(confroomID,  _body, reqParam){
        let body = GLOBAL.clone(_body);
        ucEngine.webSocketSend(['msg.com', [[this.conferenceid, this._peerIM],['viewer_update', confroomID]]], body, reqParam);
    };

    this.conferenceRecording = function(confroomID, _body, reqParam){
        let body = GLOBAL.clone(_body);
        ucEngine.webSocketSend(['msg.com', [[this.conferenceid, this._peerIM],['recording', confroomID]]], body, reqParam);
    };

    this.conferenceInfo = function(confroomID,  _body, reqParam){
        let body = GLOBAL.clone(_body);
        ucEngine.webSocketSend(['msg.com', [[this.conferenceid],['search', confroomID]]], body, reqParam);
    };

    this.conferenceUserInfo = function(confroomID, _body, reqParam){
        let body = GLOBAL.clone(_body);
        ucEngine.webSocketSend(['msg.com', [[this.conferenceid],['user_state', confroomID]]], body, reqParam);
    };

    // this.sendUserMediaChange = function(targetuser, confroomID, _body, reqParam){
    //     let body = GLOBAL.clone(_body);
    //     ucEngine.webSocketSend(['msg.usr', [[targetuser],['mediachange', confroomID]]], body, reqParam);
    // }

    // this.requestTranscription = function(confroomID, language, reqParam){
    //     ucEngine.webSocketSend(['msg.com', [['#result@linearhub.com'],['stt', confroomID]]], { language: language }, reqParam);
    // };

    this._messageHandler = function(e){
        GLOBAL.info('ConferenceEngine._messageHandler');

        let responseCmd = e.header[1];
        switch(e.requestParam.requestCmd){
            case 'watch.usr.dev':{
                switch(responseCmd){
                    case 200:{
                        var data = e.body;
                		// 일단 Web으로 진행 하기 때문에, Web에 따른 분기는 처리 하지 않음.
                		if(data[0][1].im.length>0){
                			let peerIM = data[0][1].im;
                            this._peerIM = peerIM;
                		}

                        if(e.requestParam.onComplete!==undefined){
                            e.requestParam.onComplete(e);
                        }
                        return true;
                    }
                    break;
                }
            }
            case 'msg.usr':{
                var comType = e.header[2][1][0];
                var confID = e.header[2][1][1];
                var body = e.body;
                if(comType==='user_update'){

                }
            }
            break;
            case 'msg.com':{
                switch(responseCmd){
                    case 200:{
                        let comType = e.requestParam.header[1][1][0];
                        if(comType=='create'){
                        }
                        else if(comType=='update'){
                            let body = e.requestParam.body;
                            let confID = e.requestParam.header[1][1][1];

                            // let updatebody = {
                            //     roomid:confID,
                            //     title: body.name_t,
                            //     description: body.desc_t,
                            //     start_time: body['tm.start_dt'],
                            //     end_time: body['tm.end_dt'],
                            //     timezone: body['tm.z.name_s'],
                            //     tz: body['tm.z.val_s'],
                            //     state: body['state_s'],
                            //     use_recording_b: body['use_recording_b'],
                            //     use_transcript_b: body['use_transcript_b'],
                            //     transcript_language_s: body['transcript_language_s']
                            // };
                            //
                            // if(body.agenda_s!==undefined && typeof body.agenda_s==="string" && body.agenda_s!==""){
                            //     updatebody.agenda_s = GLOBAL.transStrToObj(body.agenda_s);
                            // }
                            //
                            // if(body.screenshare_b!==undefined && body.screenshare_b!==null){
                            //     updatebody.screenshare_b = body.screenshare_b;
                            // }
                            //
                            // if(body.extendedcnt_i!==undefined && body.extendedcnt_i!==null){
                            //     updatebody.extendedcnt = body.extendedcnt_i;
                            // }
                            //
                            // if(body['tm.update_dt']!==undefined && body['tm.update_dt']!==null){
                            //     updatebody.update_time = body['tm.update_dt'];
                            // }
                            //
                            // Ti.Database.store.push({data:{id:confID, type:"schedule", attributes:updatebody}});
                        }
                        else if(comType=='delete'){
                        }
                        else if(comType=='invite'){
                        }
                        else if(comType=='join'){
                        }
                        else if(comType==='offer'){
                        }
                        else if(comType==='scan'){
                            //for getting chatdata from msg.com
                            let storedata = [];
                            for(let i=0, n=e.body.length ; i<n ; i++){
                                if(e.body[i]['msgType']===CONST.CHAT_TYPE_TEXT){
                                    storedata.push({id: e.body[i]['msgID'], type: 'logmsg', attributes: {
                                        keyID: e.body[i]['.meta']['!key'],
                                        seqID: e.body[i]['.meta']['!seq'],
                                        roomID: e.body[i]['roomID'],
                                        msgID: e.body[i]['msgID'],
                                        sender: e.body[i]['sender'],
                                        senderName: e.body[i]['senderName'],
                                        isMyMsg: 0,
                                        msgDateTime: e.body[i]['msgDateTime'],
                                        msgType: e.body[i]['msgType'],
                                        msgData: e.body[i]['msgData'],
                                        //recordmsg: e.body[i]['recordmsg'],
                                        recordtimer: e.body[i]['recordtimer'],
                                    }});
                                }
                            }
                            if(storedata.length>0){
                                GLOBAL.db.push({data:storedata});
                            }
                            //GLOBAL.debug(JSON.stringify(storedata));
                        }

                        if(e.requestParam.onComplete!==undefined){
                            e.requestParam.onComplete(e);
                        }
                        return true;
                    }
                    break;
                    case 403:{
                        let comType = e.requestParam.header[1][1][0];
                        GLOBAL.error("Conf Error Response = 403 command = " + comType);
                        if(comType=='join'){
                            if(e.requestParam.onComplete!==undefined){
                                e.requestParam.onComplete(e);
                            }
                       }
                       return false;
                    }
                    break;
                    case 404:{
                        let comType = e.requestParam.header[1][1][0];
                        GLOBAL.error("Conf Error Response = 404 command = " + comType);
                        let confid = e.requestParam.header[1][1][1];
                        GLOBAL.db.push({data: {id: confid, type: 'conferenceroom', attributes: {state: 'end'}}});
                       //  if(comType==='offer'){
                       //      // Conference status is ended.
                       //      let confid = e.requestParam.header[1][1][1];
                       //      let body = {
                       //              state: 'end'
                       //      };
                       //      //
                       //      // this.updateConferenceReserve(confid, body);
                       //      GLOBAL.db.push({data: {id: confid, type: 'conferenceroom', attributes: body}});
                       // }
                       // else{
                       //     if(e.requestParam.onComplete!==undefined){
                       //         e.requestParam.onComplete(e);
                       //     }
                       // }
                       if(e.requestParam.onError!==undefined){
                           e.requestParam.onError(e);
                       }
                       return false;
                    }
                    break;
                    case 202:{
                        let comType = e.requestParam.header[1][1][0];
                        GLOBAL.error("Conf Error Response = 403 command = " + comType);
                        return false;
                    }
                    break;
                    default:{
                        // Error 처리에 대한 Popup을 보여 주어야 함.
                        let comType = e.requestParam.header[1][1][0];
                        if(comType=='create'){
                            //alert(LOCALE.alert.failCreateConfRoom + 'Server Error Code : [' + responseCmd +']');
                            sessionStorage.clear();
                            window.location.replace('https://www.roundee.io/410page.html');
                        }
                        else if(comType=='update'){
                            //alert(LOCALE.alert.failEditConfRoom + 'Server Error Code : [' + responseCmd +']');
                            sessionStorage.clear();
                            window.location.replace('https://www.roundee.io/410page.html');
                        }
                        else if(comType=='delete'){
                            //alert(LOCALE.alert.failDeleteConfRoom + 'Server Error Code : [' + responseCmd +']');
                            sessionStorage.clear();
                            window.location.replace('https://www.roundee.io/410page.html');
                        }
                        else if(comType=='invite'){
                            //alert(LOCALE.alert.failDeleteConfRoom + 'Server Error Code : [' + responseCmd +']');
                            sessionStorage.clear();
                            window.location.replace('https://www.roundee.io/410page.html');
                        }
                        else if(comType==='offer'){
                            if(e.requestParam.onError!==undefined){
                                e.requestParam.onError(e);
                            }
                        }
                        return true;
                    }
                    break;
                }
            }
            break;
        }
        return true;
    };

    return this;
}

module.exports = ConferenceEngine;

},{}],43:[function(require,module,exports){
'use strict';

function RegisterEngine(){
    let _protocol = '0.0.2';
    let _protocolVersion = _protocol.split('.');
	_protocolVersion = [parseInt(_protocolVersion[0], 10),parseInt(_protocolVersion[1], 10),parseInt(_protocolVersion[2], 10)];

	let _appVersion = GLOBAL.getVersion().split('.');
	//var _appVersion = '0.0.1'.split('.');	//test
	_appVersion = [parseInt(_appVersion[0], 10),parseInt(_appVersion[1], 10),parseInt(_appVersion[2], 10)];

    this._engineName = 'login';

    let status = 'stop';
    let isRegisterState = 'none'; //none, request, complete
    let isSecondRegistering = false;
    let startCallback = null;

    this.start = function(param){
        status = 'progressing';
        if(param!==undefined){
            startCallback = param;
        }
        isRegisterState = 'none';
        register();
    };

    this.stop = function(){
        status = 'stop';
        isRegisterState = 'none';
        startCallback = null;
        // let param = null;
        // if(callback){
        //     param = { onResponse: callback };
        // }
        // ucEngine.webSocketSend(['logout'], null, param);
    };

    this.getStatus = function(){
        return status;
    };

    let register = function(nonce){
        let header = ['login',[GLOBAL.getMyID()]];
        let body;
        let deviceuuid = GLOBAL.getEncData('device.uuid');
        let depID = GLOBAL.getEncData('myProfile.depID');
        let deviceType = GLOBAL.getEncData('device.devicetype');

        isRegisterState = 'request';

        body = {
            ver: {protocol: _protocolVersion, device: _appVersion},
                response: GLOBAL.getEncData('register.response'),
                dev: [(deviceType===undefined||deviceType===null||deviceType==="")?GLOBAL.osname:deviceType, deviceuuid],
                dep: depID
        };

        let param = GLOBAL.clone(body);
        ucEngine.webSocketSend(header, body, param);
        // 아래 Code는 가입자가 실리면 다시 살려야 함.
        // GLOBAL.info('Register.register isFirstLogin = ' + (nonce==undefined?true:false));
        //
        // let header = ['login',[GLOBAL.getMyID()]];
        // let body;
        // let deviceuuid = GLOBAL.getEncData('device.uuid');
        // let depID = GLOBAL.getEncData('myProfile.depID');
        // let deviceType = GLOBAL.getEncData('device.devicetype');
        // if(nonce==undefined){
        //     if(isRegisterState!='none'){
        //         GLOBAL.warning('Register.register fail. isRegisterState = ' + isRegisterState);
        //         return;
        //     }
        //     isRegisterState = 'request';
        //
        //     body = {
        //         ver: {protocol: _protocolVersion, device: _appVersion},
        //             response: GLOBAL.getEncData('register.response'),
        //             dev: [(deviceType===undefined||deviceType===null||deviceType==="")?GLOBAL.osname:deviceType, deviceuuid],
        //             dep: depID
        //     };
	    // }
        // else{
        //     if(isRegisterState=='request'){
        //         GLOBAL.warning('Register.register fail. isRegisterState = ' + isRegisterState);
        //         return;
        //     }
        //     isRegisterState = 'request';
        //
        //     var HA1 = GLOBAL.getEncData('HA1');
        //     var HA2 = GLOBAL.getEncData('HA2');
        //     var response = '' + GLOBAL.md5HexDigest(HA1 + ':' + nonce + ':' + HA2);
        //     GLOBAL.setEncData('register.response', response);
        //
        //     body = {
        //         ver: {protocol: _protocolVersion, device: _appVersion},
        //         response: response,
        //         dev: [(deviceType===undefined||deviceType===null||deviceType==="")?GLOBAL.osname:deviceType, deviceuuid],
        //         dep: depID
        //     };
        // }
        //
        // let param = GLOBAL.clone(body);
        // param.isFirstLogin = nonce==undefined?true:false;
        //
        // ucEngine.webSocketSend(header, body, param);
    };

    this._messageHandler = function(e){
        GLOBAL.info("Register Engine Receive Message");

        if(e.body!=null&&e.body.verLast!=undefined){
            if(e.body.verLast.device!=undefined){
                let verLastString = e.body.verLast.device;

                GLOBAL.setEncData('verLast.version', verLastString[0]+'.'+verLastString[1]+'.'+verLastString[2]);
                GLOBAL.setEncData('verLast.downloadUrl', e.body.verLast.download);
            }
        }
        let command = e.requestParam.requestCmd;
        let responseCmd = e.header[1];
        switch(command){
            case 'login':{
                switch(responseCmd){
                    case 407:{
                        isRegisterState = 'none';
                        register(e.body.nonce);
                        if(startCallback){
                            startCallback(this);
                        }
                        return true;
                    }
                    break;
                    case 200:{
                        isRegisterState = 'complete';

                        GLOBAL.secret = GLOBAL.getEncData('HA1');
                        GLOBAL.setEncData('fileToken', '' + GLOBAL.md5HexDigest(GLOBAL.getMyID() + ':ucfile'));

                        if(e.body!=undefined){
                            GLOBAL.correctionTime = 0;
                            if(e.body.utcUs!=undefined){
                                let utcMilis = e.body.utcUs/1000;
                                GLOBAL.correctionTime = new Date().getTime() - utcMilis;
                            }

                            if(e.body!=null&&e.body.verLast!=undefined){
                                let verLastDataVersion = '' + e.body.verLast.data;
                                GLOBAL.setEncData('ver.dataVersion', verLastDataVersion);
                            }

                            if(e.body.dep!=undefined){
                                GLOBAL.setEncData('myProfile.depID', e.body.dep);
                            }
                            if(e.body.comId!=undefined){
                                GLOBAL.setEncData('myProfile.domain', e.body.comId);
                            }
                        }

                        // When login complete,  register engine's status change 'complete'
                        status = 'complete';
                        if(startCallback){
                            startCallback(this);
                        }
                        return true;
                    }
                    case 403:   // authentification fail
                    case 404:   // Not Found
                    case 603:   // Decline
                    {
                        GLOBAL.setEncData('register.response', '');
                        GLOBAL.setEncData('HA1', '');
                        GLOBAL.setEncData('HA2', '');
                        //ucEngine.stop('login fail', true);
                        //ucEngine.deleteLocalData(ucEngine.DELETE_DATA_EXCEPT_ACCOUNT);

                        ucEngine.onLoginFail({type: 'ucserver', code: e.header[1], reason: e.header[2]});
                        return true;
                    }
                    break;
                    case 503:   // Service Unavailable
                    {
                        //ucEngine.stop('503', true);
                        ucEngine.onLoginFail({type: 'ucserver', code: e.header[1], reason: e.header[2], message: e.body.msg});
                        return true;
                    }
                    break;
                    case 505:   // Version Not Supported
                    {
                        // ucEngine.stop('505', true);
                        bUpdateForLoginFail = true;
                        ucEngine.onLoginFail({type: 'ucserver', code: e.header[1], reason: e.header[2]});
                        return true;
                    }
                    break;
                }
            }
            case 'logout':{
                switch(responseCmd){
                    case 407:{
                        return true;
                    }
                    break;
                    case 200:{
                        if(e.requestParam.onComplete!==undefined){
                            e.requestParam.onComplete(e);
                        }
                        return true;
                    }
                    case 403:   // authentification fail
                    case 404:   // Not Found
                    case 603:   // Decline
                    {
                        return true;
                    }
                    break;
                    case 503:   // Service Unavailable
                    {
                        return true;
                    }
                    break;
                    case 505:   // Version Not Supported
                    {
                        return true;
                    }
                    break;
                }
            }
            default:
                return true;
        }


        return false;
    };

    return this;
}
module.exports = RegisterEngine;

},{}],44:[function(require,module,exports){
'use strict';

function UcEngine( confid ) {
    let ucengine = {};
    let websocket = new( require( "../common/ucSocket" ) )();
    let _monitorWebSocketTimer = null;

    let lastTid = 0;
    let singleCmdClass = [ 'usr.sxr', 'sys.sxd', 'sys.sxs' ];

    let start_param = null;

    ucengine.confid = confid;

    ucengine.isstartcomplete = false;
    ucengine.serverconnect = false;
    ucengine.sendkeepalivetime = 0;
    ucengine.pingPongTime = 50 * 1000;

    ucengine._isStarted = false;
    ucengine.server_addr = "";
    ucengine.transactionMap = {};
    ucengine.transactionWaitBuf = [];

    ucengine.Register = new( require( "./RegisterEngine" ) )();
    ucengine.Chats = new( require( "./ChatEngine" ) )();
    ucengine.Conf = new( require( "./ConferenceEngine" ) )( ucengine.confid );
    ucengine.Video = new( require("./VideoCallEngine") )();

    let startEngineCallBack = function ( engine ) {
        // When each engine start completed, called this function
        GLOBAL.info( "Engine Complete = " + engine._engineName );
        let engineName = engine._engineName;
        if ( start_param ) {
            if ( engineName === 'login' ) {
                if ( engine.getStatus() === 'complete' ) {
                    ucEngine.isstartcomplete = true;
                    start_param.onLogInSuccess();
                }
                else if ( engine.getStatus() === 'progressing' ) {
                    start_param.onLoginProgress();
                }
            }

            if ( start_param.onStartComplete ) {
                start_param.onStartComplete();
            }
        }
    };

    ucengine.start = function ( tag, param, db ) {
        let server_addr = GLOBAL.getEncData( 'server_url' );
        // 1. websocket open , request connect to server
        if ( server_addr === undefined || server_addr === null || server_addr === "" ) {
            return false;
        }

        let myid = GLOBAL.getMyID();
        let passwd = GLOBAL.getEncData( 'HA2' );

        if ( myid === undefined || myid === null || myid === '' || passwd === undefined || passwd === null || passwd === '' ) {
            GLOBAL.error( "Engin not start because user info not found" );
            return false;
        }

        if ( param !== undefined ) {
            start_param = param;
        }

        if ( db !== undefined ) {
            GLOBAL.db = db;
        }
        // create and start monitoring timer
        _monitorWebSocketTimer = setInterval( function () {
            if ( ucEngine.serverconnect && ucEngine.isstartcomplete ) {
                let now = new Date().getTime();
                if ( ( now - ucEngine.sendkeepalivetime ) > ucEngine.pingPongTime ) {
                    ucEngine.sendkeepalivetime = now;
                    ucEngine.webSocketSend( [ 'ping.sys.conn', [ 'web', GLOBAL.getEncData( 'device.uuid' ) ] ], null );
                }
            }
        }.bind( this ), 1000 );

        websocket.open( server_addr, {
            onOpen: ucengine.onOpen.bind( this ),
            onClose: ucengine.onClose.bind( this ),
            onError: ucengine.onError.bind( this ),
            onMessage: ucengine.onMessage.bind( this )
        } );
    };

    ucengine.logout = function ( callback ) {
        let logoutComplete = function ( e ) {
            GLOBAL.info( "UC Server Log Out" );
            ucengine.Register.stop();
            callback();
        };

        ucEngine.webSocketSend( [ 'logout' ], null, {
            onComplete: logoutComplete.bind( this )
        } );
    };

    ucengine.onOpen = function ( ev ) {
        GLOBAL.error( "websocket open success = " + ev.target.url );
        ucEngine.serverconnect = true;
        // 진행해야 하는 것은 LogIn 절차를 진행 해야 함.
        ucengine.Register.start( startEngineCallBack.bind( this ) );
    };

    ucengine.onClose = function ( ev ) {
        if ( ev == undefined ) {
            return;
        }
        // 발생하는 Event Code를 모두 확인 후 처리.
        ucEngine.isstartcomplete = false;
        ucEngine.serverconnect = false;
        GLOBAL.error( "WebSocket Close Code = " + ev.code + " reason = " + ev.reason );

        switch ( ev.code ) {
        case 0:
            {
                if ( ev.reason !== 'EOF' ) {
                    webSocketReconnect( ev );
                }
            }
            break;
        case 400:
            {
                // 재연결 필요가 없음.  reason : device removed
            }
            break;
        case 1001:
            {
                if ( ev.reason !== 'Stream end encountered' ) {
                    webSocketReconnect( ev );
                }
            }
            break;

        case 747:
        case 1003:
            {
                webSocketReconnect( ev );
            }
            break;
        case 4000:
            {
                if ( GLOBAL.NotiHandle ) {
                    GLOBAL.NotiHandle.send( 'showmessagenoti', 'duplicate', GLOBAL.getMyID() );
                    ucEngine.logout();
                }
            }
            break;
        case 8000:
            {
                //다중접속 제한 접속 정리당함.
                GLOBAL.setEncData( 'HA1', '' );GLOBAL.setEncData( 'HA2', '' );
                ucEngine.onLoginFail( {
                    type: 'ucserver',
                    code: ev.code,
                    reason: 'Multiple access is limited'
                } );
            }
            break;
        case 9000:
            {
                //비정상 close. server에서 close한 경우에 해당하며 재접속 하면 안됨.
                ucEngine.onLoginFail( {
                    type: 'ucserver',
                    code: ev.code,
                    reason: 'Internal Server Error'
                } );
            }
            break;
        default:
            {
                webSocketReconnect( ev );
            }
            break;
        }
    };

    ucengine.onError = function ( e ) {
        GLOBAL.error( "WebSocket Error Code = " + e.code + " reason = " + e.reason );
    };

    ucengine.onMessage = function ( e ) {
        GLOBAL.info( 'websocket recv:' + e.data );
        let index = e.data.indexOf( '\t' );
        let header = null;
        let body = null;
        let headerString = null;
        let bodyString = null;

        try {
            if ( index > -1 ) {
                headerString = e.data.substring( 0, index );
                bodyString = e.data.substring( index + 1 );
            }
            else {
                headerString = e.data;
                body = null;
            }
        }
        catch ( error ) {
            GLOBAL.error( 'websocket parse error' + error );
            return;
        }

        header = JSON.parse( headerString );

        let tid = header[ 0 ];
        let cmd = '' + header[ 1 ];
        let param = header[ 2 ];

        let isNotify = false;
        if ( cmd.indexOf( 'noti' ) == 0 || cmd.indexOf( 'xnoti' ) == 0 ) {
            isNotify = true;
        }

        // Find requestparam in transactionMap
        let requestParam = ucEngine.transactionMap[ tid ];
        if ( requestParam === undefined ) {
            // This case is request packet from server
            GLOBAL.info( "Receive Request From Server" );
            isNotify = true;
        }

        if ( isNotify ) {
            // receive noti message
            body = JSON.parse( bodyString );
            processRecvNoti( tid, cmd, body, param );
        }
        else {
            let isTransactionEnd = true;
            if ( header.length === 4 && header[ 3 ] > 0 ) {
                isTransactionEnd = false;
            }

            // // Find requestparam in transactionMap
            // let requestParam = ucEngine.transactionMap[tid];
            // if(requestParam===undefined){
            //     // This case is request packet from server
            //     GLOBAL.error("ucEngine: not found transaction error. tid = " + tid);
            //     return;
            // }

            let isMergeBody = false;
            if ( requestParam.requestCmd === "find.usr.solr" || requestParam.requestCmd === "find.sys.solr" ) {
                isMergeBody = true;
            }

            if ( isMergeBody === true ) {
                if ( requestParam.tempBody === undefined ) {
                    requestParam.tempBody = bodyString;
                }
                else {
                    requestParam.tempBody += bodyString;
                }

                if ( isTransactionEnd === false ) {
                    requestParam.sendTime = new Date().getTime();
                    return;
                }
                else {
                    body = JSON.parse( requestParam.tempBody );
                    delete requestParam.tempBody;
                }
            }
            else {
                body = JSON.parse( bodyString );
            }

            if ( isTransactionEnd ) {
                delete ucEngine.transactionMap[ tid ];
            }
            else {
                // if response packet is seperated,  update sending time. because it takes over 10sec time.
                requestParam.sendTime = new Date().getTime();
            }

            // call message parsing function
            // processRecvMsg(requestParam, header, body);
            // Find Engine handle using request command

            let action = getActionName( requestParam.requestCmd );
            let engine = null;
            switch ( action ) {
            case 'login':
                engine = ucEngine.Register;
                break;
            case 'conf':
                engine = ucEngine.Conf;
                break;
            case 'chats':
                engine = ucEngine.Chats;
                break;
                // case 'contacts':    engine = ucEngine.Contacts;     break;
                // case 'groups':      engine = ucEngine.Groups;       break;
                // case 'favorites':   engine = ucEngine.Favorite;     break;

                // case 'config':      engine = ucEngine.Config;       break;
                // case 'channel':     engine = ucEngine.Channel;      break;

                // case 'minutes':     engine = ucEngine.Minutes;      break;
            }

            // 여기 부분을 정리 해야 함.
            if ( engine ) {
                if ( action === '' ) {
                    if ( requestParam.onResponse != undefined ) {
                        let result = requestParam.onResponse( {
                            requestParam: requestParam,
                            header: header,
                            body: body
                        } );
                        if ( result == true ) {
                            return;
                        }
                    }
                    return;
                }
                else {
                    let e = {
                        header: header,
                        body: body,
                        requestParam: requestParam
                    };
                    if ( header.length < 4 || header[ 3 ] < 0 ) {
                        e.endPacket = true;
                    }
                    // 해당  Engine에 보냄.
                    engine._messageHandler( e );
                }
            }
        }
    };

    let webSocketReconnect = function ( ev ) {
        if ( websocket ) {
            if ( ucEngine.serverconnect ) {
                websocket.close();
                websocket = null;
                ucEngine.serverconnect = false;
            }
        }
        // socket 자체를 지우고 다시 생성.
        websocket = new( require( "../common/ucSocket" ) )();
        let server_addr = GLOBAL.getEncData( 'server_url' );
        websocket.open( server_addr, {
            onOpen: ucengine.onOpen.bind( this ),
            onClose: ucengine.onClose.bind( this ),
            onError: ucengine.onError.bind( this ),
            onMessage: ucengine.onMessage.bind( this )
        } );
    };

    ucengine.onLoginFail = function ( param ) {
        // _isStarted = false;
        // _isLogined = false;
        ucEngine.isstartcomplete = false;
        if ( start_param != undefined && start_param.onLoginFail != undefined ) {
            start_param.onLoginFail( param );
        }
    };

    ucengine.webSocketSend = function ( header, body, param ) {
        if ( !ucEngine.serverconnect ) {
            GLOBAL.error( "Server is not Connected!" );
            return false;
        }
        if ( GLOBAL.debug_mode ) {
            if ( body != null && body == param ) {
                GLOBAL.error( 'ucEngine: webSocketSend body == param' );
            }
        }

        param = param || {};

        let requestCmd = header[ 0 ];
        let headerParam = header[ 1 ];
        if ( headerParam != undefined ) {
            let isArray = {}.toString.apply( headerParam ) == "[object Array]" ? true : false;
            if ( isArray ) {
                if ( header[ 1 ][ 2 ] == true ) {
                    //old protocol. scan by key
                    param.requestSubCmd = GLOBAL.clone( header[ 1 ][ 0 ] );
                }
            }
            else {
                param.requestSubCmd = GLOBAL.clone( header[ 1 ].fk0 );
            }

            var reqCmdClass = requestCmd.substring( requestCmd.indexOf( '.' ) + 1 );
            if ( singleCmdClass.indexOf( reqCmdClass ) >= 0 ) {
                if ( headerParam.fk0 != undefined ) {
                    headerParam.fk0 = ucEngine.convertListIDToScrKey( headerParam.fk0 );
                }
            }
        }

        param.requestCmd = header[ 0 ];
        param.header = header;
        param.body = body;

        return internalWebSocketSend( param );
    };

    ucengine.sendRequestGets = function ( cmdClass, cmdSub, seqID, reqParam, direction ) {
        seqID = seqID || '';
        reqParam = reqParam || {};

        //cmdClass: sys.scd?nablecomm.com@07077773009 처럼 오용하는 경우 복구처리
        if ( cmdClass.indexOf( '?' ) > 0 ) {
            cmdClass = cmdClass.split( '?' )[ 0 ];
            cmdSub = cmdClass.split( '?' )[ 1 ];
        }

        //cmdClass: sys.scd cmdSub: nablecomm.com@07077773009 형태로 사용
        let cmdClassName = ( cmdSub == undefined ) ? cmdClass : ( cmdClass + '?' + cmdSub );

        //예외 추출 코드
        if ( [ 'sys.sxd', 'sys.sxs', 'sys.gxd', 'sys.gxs' ].indexOf( cmdClass ) >= 0 ) {
            if ( cmdSub == undefined ) {
                GLOBAL.error( 'ucEngine: sendRequestGets canceled cmdClassName=' + cmdClassName );
                return;
            }
        }

        let lastSeqID = GLOBAL.getLastSeqID( cmdClassName ) || '';
        seqID = lastSeqID || seqID;

        var header, reqCmdHeader, headerParam;
        reqCmdHeader = 'xscan.', headerParam = {};
        reqParam = reqParam || {};

        headerParam.fk0 = cmdSub;
        headerParam.scanAfter = seqID;
        headerParam.scanByKey = false;

        if ( cmdClass == 'sys.gxm' && seqID == '' ) {
            headerParam.scanByKey = true;
        }

        headerParam.scanReverse = direction || false;

        header = [ reqCmdHeader + cmdClass ];
        header.push( headerParam );

        ucEngine.webSocketSend( header, null, reqParam );
        // if(reqParam==undefined){
        //     ucEngine.reqGetState[cmdClassName] = ENGINE.GET_STATE_REQ;
        //     GLOBAL.info('ucEngine: ReqGetState ' + cmdClassName + '=GET_STATE_REQ');
        // }
    };

    ucengine.reqPartialData = function ( param ) {
        ucEngine.webSocketSend( [ 'xscan.' + param.cmdClass,
            {
                fk0: param.cmdSub,
                scanAfter: param.after,
                scanCount: param.count,
                scanByKey: param.scanByKey === undefined ? false : param.scanByKey,
                scanReverse: param.scanReverse === undefined ? true : param.scanReverse
            } ], null, param.reqDataParam );
    };

    ucengine.reqMultiData = function ( param ) {
        //cmdClass, cmdSub, after, count
        ucEngine.webSocketSend( [ 'xmget.' + param.cmdClass,
                {
                    fk0: param.cmdSub,
                    scanAfter: param.after,
                    scanCount: param.count,
                    scanByKey: true,
                    metaOnly: param.metaOnly
                } ],
            param.keys, param.reqDataParam
        );
    };

    let internalWebSocketSend = function ( param ) {

        // if(_isStarted==false){
        // 	GLOBAL.warning('ucEngine: not started.');
        //     ucEngine.start('internalWebSocketSend');
        //
        // 	GLOBAL.info('ucEngine: transactionWaitBuf add. param=' + GLOBAL.getPrintDic(param));
        // 	ucEngine.transactionWaitBuf.push(param);
        //     return false;
        // }
        // else if((_isLogined==false)&&param.header[0]!='login'){
        //     ucEngine.transactionWaitBuf.push(param);
        //     return false;
        // }

        let action = getActionName( param.requestCmd );
        let engine = null;
        switch ( action ) {
        case 'login':
            engine = ucEngine.Register;
            break;
        case 'contacts':
            engine = ucEngine.Contacts;
            break;
        case 'groups':
            engine = ucEngine.Groups;
            break;
        case 'favorites':
            engine = ucEngine.Favorite;
            break;
        case 'chats':
            engine = ucEngine.Chats;
            break;
        case 'config':
            engine = ucEngine.Config;
            break;
        case 'channel':
            engine = ucEngine.Channel;
            break;
        case 'conf':
            engine = ucEngine.Conf;
            break;
        case 'minutes':
            engine = ucEngine.Minutes;
            break;
        }

        lastTid++;
        ucEngine.transactionMap[ lastTid ] = param;

        let preHeader = [ lastTid ];
        let sendString = JSON.stringify( preHeader.concat( param.header ) );
        if ( param.body != undefined && param.body != null ) {
            sendString += ( '\t' + JSON.stringify( param.body ) );
        }

        /////////////////////////////////////////////////////////////////
        //test case
        // if(ucEngine.isTestFlag==true && (header[0]=='send.sys.sxd' || header[0]=='send.usr.gxd' || header[0]=='del.sys.sxd') ){
        // //ucEngine.isTestFlag = false;
        // GLOBAL.warning('ucEngine: test case: drop send message');
        // return;
        // }
        /////////////////////////////////////////////////////////////////

        let sendTime = new Date()
        param.sendTime = sendTime.getTime();
        websocket.send( sendString );
        ucEngine.lastSendTime = param.sendTime;
        sendTime = null;
        return true;
    };

    let processRecvNoti = function ( tid, cmd, body, param ) {
        if ( tid != undefined && tid != null ) {
            websocket.send( JSON.stringify( [ tid, 200, 'OK' ] ) );
        }

        if ( cmd === 'msg.com' ) {
            if ( param !== undefined ) {
                let command = param[ 1 ][ 0 ];
                if ( command === 'network_state' ) {
                    let state = body.state;
                    if ( GLOBAL.NotiHandle ) {
                        GLOBAL.NotiHandle.send( 'showmessagenoti', command, state, null );
                    }
                }
            }
        }
        else {
            //send get request for noti
            let cmdArr = cmd.substring( 5 ).split( '?' );
            let cmdClass = cmd.split( '?' )[ 0 ].substring( cmd.indexOf( '.' ) + 1 );
            let cmdSub = cmdArr[ 1 ];

            let notiSeqID = null;
            if ( body != undefined ) {
                notiSeqID = body[ '.meta' ][ '!seq' ];
            }

            switch ( cmdClass ) {
                // case 'usr.fav':
                //     ucEngine.sendRequestGets(cmdClass, null, notiSeqID);
                // break;
                //
                // case 'usr.prt': case 'usr.map': case 'dep.prt': case 'dep.map':
                //     ucEngine.sendRequestGets(cmdClass, null, notiSeqID);
                // break;
                //
                // case 'com.usr': case 'dep.usr':
                //     ucEngine.sendRequestGets(cmdClass, null, notiSeqID);
                // break;
                //
                // case 'usr.scr':  case 'usr.gcr':
                //     ucEngine.sendRequestGets(cmdClass, null, notiSeqID);
                // break;
                //
                // case 'usr.scs': 	case 'sys.gcs':{
                // 	var oldSeqID = parseInt(ucDB.getLastSeqID(cmdClass+'?'+cmdSub), 16);
                // 	var newSeqID = parseInt(notiSeqID, 16);
                // 	if(newSeqID == oldSeqID+1){
                // 		var listID = cmdSub;
                // 		ucEngine.Chats.processReadData(listID, cmd, [body]);
                // 	}
                // 	else{
                // 		ucEngine.sendRequestGets(cmdClass, cmdSub, notiSeqID);
                // 	}
                // }
                // break;
            case 'sys.gxs':
                {
                    let roomID = cmdSub;
                    let unreadcnt = body[ '.meta' ][ '.unread' ];
                    if ( roomID === GLOBAL.getConfID() ) {

                    }
                    //GLOBAL.db.push({data:{id: roomID, type:'conferenceroom', attributes: {unreadcnt: unreadcnt} }});
                }
                break;
            case 'usr.sxr':
            case 'usr.gxr':
            case 'sys.sxr':
            case 'sys.gxr':
                let roomID = body[ '.meta' ][ '!key' ];
                let unreadcnt = body[ '.meta' ][ '.unread' ];
                if ( roomID !== GLOBAL.getConfID() ) {
                    break;
                }
                if ( !( unreadcnt === undefined || unreadcnt === null || unreadcnt === '' ) ) {
                    // unreadcnt = 0;
                    GLOBAL.db.push( {
                        data: {
                            id: roomID,
                            type: 'conferenceroom',
                            attributes: {
                                unreadcnt: ( unreadcnt - GLOBAL.removereadcnt )
                            }
                        }
                    } );
                }

                if ( GLOBAL.db ) {
                    let changemembers = body.cmembers;
                    if ( changemembers !== undefined ) {
                        let presentmemberinfo = GLOBAL.db.peekAll( 'member' ).toArray();
                        let confinfo = GLOBAL.db.peekRecord( 'conferenceroom', roomID );
                        if ( confinfo ) {
                            confinfo = confinfo.toJSON();
                        }
                        for ( let i = 0, n = changemembers.length; i < n; i++ ) {
                            let userid = changemembers[ i ].userid;
                            let bfound = false;
                            if ( confinfo ) {
                                if ( userid === GLOBAL.getMyID() && changemembers[ i ].operation === confinfo.owner ) {
                                    if ( GLOBAL.NotiHandle ) {
                                        for ( let j = 0, m = presentmemberinfo.length; j < m; j++ ) {
                                            if ( presentmemberinfo[ j ].get( 'userid' ) === userid ) {
                                                if ( presentmemberinfo[ j ].get( 'mstate' ) === 'all' ) {
                                                    if ( changemembers[ i ].mstate === 'videoonly' ) {
                                                        GLOBAL.NotiHandle.send( 'showmessagenoti', 'mediachange', 'audio', null );
                                                    }
                                                    else if ( changemembers[ i ].mstate === 'audioonly' ) {
                                                        GLOBAL.NotiHandle.send( 'showmessagenoti', 'mediachange', 'video', null );
                                                    }
                                                }
                                                else if ( presentmemberinfo[ j ].get( 'mstate' ) === 'audioonly' ) {
                                                    if ( changemembers[ i ].mstate === 'none' ) {
                                                        GLOBAL.NotiHandle.send( 'showmessagenoti', 'mediachange', 'audio', null );
                                                    }
                                                }
                                                else if ( presentmemberinfo[ j ].get( 'mstate' ) === 'videoonly' ) {
                                                    if ( changemembers[ i ].mstate === 'none' ) {
                                                        GLOBAL.NotiHandle.send( 'showmessagenoti', 'mediachange', 'video', null );
                                                    }
                                                }
                                                break;
                                            }
                                        }
                                    }
                                }
                            }

                            for ( let j = 0, m = presentmemberinfo.length; j < m; j++ ) {
                                if ( presentmemberinfo[ j ].get( 'userid' ) === userid ) {
                                    if ( presentmemberinfo[ j ].get( 'state' ) !== changemembers[ i ].state ) {
                                        bfound = false;
                                    }
                                    else {
                                        bfound = true;
                                    }
                                    break;
                                }
                            }
                            if ( !bfound ) {
                                if ( GLOBAL.NotiHandle ) {
                                    if ( userid !== GLOBAL.getMyID() && changemembers[ i ].state === 'join' ) {
                                        GLOBAL.NotiHandle.send( 'showmessagenoti', 'join', userid, null );
                                    }
                                    GLOBAL.db.push( {
                                        data: {
                                            id: userid,
                                            type: 'member',
                                            attributes: changemembers[ i ]
                                        }
                                    } );
                                }
                            }
                        }
                    }

                    let recordingowner = body.recording;
                    if ( recordingowner !== undefined ) {
                        if ( GLOBAL.NotiHandle ) {
                            if ( recordingowner === "" ) {
                                GLOBAL.NotiHandle.send( 'showmessagenoti', 'recording', false, null );
                            }
                            else {
                                GLOBAL.NotiHandle.send( 'showmessagenoti', 'recording', true, null );
                            }
                        }
                    }
                }
                ucEngine.Chats.getChatRoomInfo( 1, roomID );
                break;
            case 'sys.gxm':
                {
                    // member가 추가되는 경우, 또는 빠지는 경우.
                    let meta = body[ '.meta' ];
                    let userid = meta[ '!key' ];
                    let roomID = cmdSub;

                    if ( roomID !== GLOBAL.getConfID() ) {
                        break;
                    }
                    if ( meta[ '!cud' ] === 'c' ) {
                        let body = {
                            userid: userid,
                            displayname: userid.split( '@' )[ 0 ],
                            email: userid,
                            quality: 'high',
                            mstate: 'all',
                        }
                    }
                    else if ( meta[ '!cud' ] === 'd' ) {
                        let deletemember = GLOBAL.db.peekRecord( 'member', userid );
                        if ( deletemember ) {
                            GLOBAL.db.unloadRecord( deletemember );
                        }
                    }
                    else {
                        GLOBAL.info( "Member List Update" );
                    }
                }
                break;
            case 'sys.sxd':
            case 'sys.gxd':
                {
                    // chatting message에 대한 noti 수신.
                    let roomID = cmdSub;
                    let meta = body[ '.meta' ];
                    let cud = meta[ '!cud' ];
                    let keyID = meta[ '!key' ];
                    let seqID = meta[ '!seq' ];
                    delete body[ '.meta' ];

                    body.keyID = keyID;
                    body.seqID = seqID;

                    if ( roomID !== GLOBAL.getConfID() ) {
                        break;
                    }

                    if ( cud === 'c' || cud === 'u' ) {
                        // if (body.type===CONST.CHAT_TYPE_KICK){
                        //     if(GLOBAL.lastreadkey!==undefined&&keyID > GLOBAL.lastreadkey){
                        //         GLOBAL.removereadcnt++;
                        //         let roominfo = GLOBAL.db.peekRecord('conferenceroom', roomID);
                        //         if(roominfo){
                        //             GLOBAL.db.push({data:{ id: roomID, type: 'conferenceroom', attributes: {unreadcnt: roominfo.get('unreadcnt') - GLOBAL.removereadcnt} }});
                        //         }
                        //     }
                        //     if(GLOBAL.NotiHandle){
                        //         GLOBAL.NotiHandle.send('showmessagenoti', 'leave', body.member[0], null);
                        //     }
                        // }
                        // else if(body.type===CONST.CHAT_TYPE_INVITE){
                        //     if(GLOBAL.lastreadkey!==undefined&&keyID > GLOBAL.lastreadkey){
                        //         GLOBAL.removereadcnt++;
                        //         let roominfo = GLOBAL.db.peekRecord('conferenceroom', roomID);
                        //         if(roominfo){
                        //             GLOBAL.db.push({data:{ id: roomID, type: 'conferenceroom', attributes: {unreadcnt: roominfo.get('unreadcnt') - GLOBAL.removereadcnt} }});
                        //         }
                        //     }
                        // }
                        // else{
                        //     GLOBAL.db.push({data:{ id: body.msgID, type: 'logmsg', attributes: body}});
                        //     GLOBAL.lastmsginfo = { keyID: keyID, msgID: body.msgID};
                        //     if(GLOBAL.NotiHandle){
                        //         GLOBAL.NotiHandle.send('showmessagenoti', 'newchat', body.msgID, body.senderName + ': ' + body.msgData);
                        //     }
                        // }
                        if ( body.type === CONST.CHAT_TYPE_KICK ) {
                            // if(GLOBAL.lastreadkey!==undefined&&keyID > GLOBAL.lastreadkey){
                            //     GLOBAL.removereadcnt++;
                            //     let roominfo = GLOBAL.db.peekRecord('conferenceroom', roomID);
                            //     if(roominfo){
                            //         GLOBAL.db.push({data:{ id: roomID, type: 'conferenceroom', attributes: {unreadcnt: roominfo.get('unreadcnt') - GLOBAL.removereadcnt} }});
                            //     }
                            // }
                            let actionmemberinfo = body.member;
                            let actionmembers = "";
                            actionmemberinfo.forEach( function ( member ) {
                                let info = GLOBAL.db.peekRecord( 'member', member );
                                if ( info ) {
                                    actionmembers += info.get( 'displayname' );
                                }
                                else {
                                    actionmembers += member;
                                }
                                actionmembers += " ";
                            }.bind( this ) );

                            let isMy = actionmemberinfo.findIndex( function ( member ) {
                                return member === GLOBAL.getMyID();
                            } );

                            let chatdata = {
                                keyID: keyID,
                                seqID: seqID,
                                roomID: roomID,
                                msgID: body.msgID,
                                sender: meta[ '.sender' ],
                                isMyMsg: isMy !== -1 ? 1 : 0,
                                msgDateTime: new Date( parseInt( GLOBAL.base64.parse( meta[ '!tsu' ] ) ) ).toISOString(),
                                msgType: body.type,
                                msgData: actionmembers + LOCALE.message.wentOut
                            };

                            if ( GLOBAL.lastmsginfo.keyID === undefined ) {
                                GLOBAL.lastmsginfo = {
                                    keyID: keyID,
                                    msgID: body.msgID
                                };
                            }
                            else {
                                if ( GLOBAL.lastmsginfo.keyID < keyID ) {
                                    GLOBAL.lastmsginfo = {
                                        keyID: keyID,
                                        msgID: body.msgID
                                    };
                                }
                            }

                            // GLOBAL.db.push( {
                            //     data: {
                            //         id: body.msgID,
                            //         type: 'logmsg',
                            //         attributes: chatdata
                            //     }
                            // } );

                            if ( GLOBAL.NotiHandle ) {
                                GLOBAL.NotiHandle.send( 'showmessagenoti', 'leave', body.member[ 0 ], null );
                            };
                        }
                        else if ( body.type === CONST.CHAT_TYPE_INVITE ) {
                            // if(GLOBAL.lastreadkey!==undefined&&keyID > GLOBAL.lastreadkey){
                            //     GLOBAL.removereadcnt++;
                            //     let roominfo = GLOBAL.db.peekRecord('conferenceroom', roomID);
                            //     if(roominfo){
                            //         GLOBAL.db.push({data:{ id: roomID, type: 'conferenceroom', attributes: {unreadcnt: roominfo.get('unreadcnt') - GLOBAL.removereadcnt} }});
                            //     }
                            // }

                            let actionmemberinfo = body.member;
                            let actionmembers = "";
                            actionmemberinfo.forEach( function ( member ) {
                                let info = GLOBAL.db.peekRecord( 'member', member );
                                if ( info ) {
                                    actionmembers += info.get( 'displayname' );
                                }
                                else {
                                    actionmembers += member;
                                }
                                actionmembers += " ";
                            }.bind( this ) );

                            let isMy = actionmemberinfo.findIndex( function ( member ) {
                                return member === GLOBAL.getMyID();
                            } );

                            let chatdata = {
                                keyID: keyID,
                                seqID: seqID,
                                roomID: roomID,
                                msgID: body.msgID,
                                sender: meta[ '.sender' ],
                                isMyMsg: isMy !== -1 ? 1 : 0,
                                msgDateTime: new Date( parseInt( GLOBAL.base64.parse( meta[ '!tsu' ] ) ) ).toISOString(),
                                msgType: body.type,
                                msgData: isMy !== -1 ? LOCALE.message.Entered : actionmembers + LOCALE.message.isEntered
                            };

                            if ( GLOBAL.lastmsginfo.keyID === undefined ) {
                                GLOBAL.lastmsginfo = {
                                    keyID: keyID,
                                    msgID: body.msgID
                                };
                            }
                            else {
                                if ( GLOBAL.lastmsginfo.keyID < keyID ) {
                                    GLOBAL.lastmsginfo = {
                                        keyID: keyID,
                                        msgID: body.msgID
                                    };
                                }
                            }

                            // GLOBAL.db.push( {
                            //     data: {
                            //         id: body.msgID,
                            //         type: 'logmsg',
                            //         attributes: chatdata
                            //     }
                            // } );
                        }
                        else if ( body.type === CONST.CHAT_TYPE_NOTE ){
                            // later input note message
                        }
                        else {
                            GLOBAL.db.push( {
                                data: {
                                    id: body.msgID,
                                    type: 'logmsg',
                                    attributes: body
                                }
                            } );
                            GLOBAL.lastmsginfo = {
                                keyID: keyID,
                                msgID: body.msgID
                            };
                            if ( GLOBAL.NotiHandle ) {
                                GLOBAL.NotiHandle.send( 'showmessagenoti', 'newchat', body.msgID, body.senderName + ': ' + body.msgData );
                            }
                        }
                    }
                }
                break;
                // case 'usr.scd':  case 'sys.gcd':  case 'sys.gcm':  {
                // 	var roomInfo = ucDB.roomInfo.getInfo(cmdSub);
                //     if(roomInfo!=undefined && roomInfo.seqID!=undefined){
                //         ucEngine.sendRequestGets(cmdClass, cmdSub, notiSeqID);
                //     }
                //     else{
                //         GLOBAL.warning('ucEngine: gets.'+ cmdClass + ' canceled. not exist room.!');
                //     }
                // }
                // break;
                //
                // case 'usr.mrk':
                //     ucEngine.sendRequestGets(cmdClass, null, notiSeqID);
                // break;
                //
                // case 'usr.dev':
                //     ucEngine.sendRequestGets(cmdClass, null, notiSeqID);
                // break;

            case 'usr.dat':
                // 동일 계정으로 Login 시 처리 해야 함.
                if ( GLOBAL.NotiHandle ) {
                    GLOBAL.NotiHandle.send( 'showmessagenoti', 'duplicate', GLOBAL.getMyID() );
                }
                // if (_HKMode == true){
                //     ucEngine.stop(true);
                //     ucEngine.deleteLocalData(ucEngine.DELETE_DATA_ALL);
                //     ucEngine.onLoginFail({type: 'ucserver', code: 8000, reason: 'Multiple access is limited'});
                // }
                break;
            default:
                GLOBAL.error( 'cmdClass is error! ' + cmdClass );
                break;
            }
        }
    };

    let getActionName = function ( requestCmd ) {
        let action = '';
        let index = requestCmd.indexOf( '.' );
        let reqCmdAction = requestCmd.substring( 0, index );
        let reqCmdClass = requestCmd.substring( index + 1 );

        switch ( reqCmdClass ) {
        case 'login':
        case 'logout':
            action = 'login';
            break;

        case 'com.usr':
        case 'dep.usr':
        case 'com.prf':
        case 'com.usr':
            action = 'contacts';
            break;

        case 'dep.prt':
        case 'dep.map':
        case 'usr.prt':
        case 'usr.map':
            action = 'groups';
            break;

        case 'usr.fav':
            action = 'favorites';
            break;

        case 'sys.sxr':
        case 'usr.sxr':
        case 'sys.sxd':
        case 'sys.sxs':
        case 'sys.gxr':
        case 'usr.gxr':
        case 'sys.gxd':
        case 'sys.gxs':
        case 'sys.gxm':
        case 'usr.mrk':
            action = 'chats';
            break;

        case 'usr.dev':
            if ( reqCmdAction == 'watch' ) {
                action = 'conf';
            }
            else {
                action = 'config';
            }
            break;
        case 'usr.bdb':
        case 'sys.bdb':
        case 'sys.bdp':
        case 'sys.bdr':
        case 'sys.bdm':
            action = 'channel';
            break;
        case 'im':
        case 'com':
        case 'usr':
            action = 'conf';
            break;
        case 'usr.dcd':
        case 'sys.dcd':
        case 'sys.dci':
        case 'sys.dcm':
            action = 'minutes';
            break;
        }

        return action;
    };

    return ucengine;
};

module.exports = UcEngine;

},{"../common/ucSocket":38,"./ChatEngine":41,"./ConferenceEngine":42,"./RegisterEngine":43,"./VideoCallEngine":45}],45:[function(require,module,exports){
'use strict';

function VideoCallEngine(){
    // for sfu
    this.mainsession = null;
    this.mainstream = null;
    this.viewersession = {};
    this.screensharesession = null;
    this.rtpsender = null;

    this.negotiationneeded = false;

    //for screen share start
    let screenMediaCallBack = function(streams){
        let screensharestream = null;

        this.negotiationneeded = false;
        if(adapter.browserDetails.browser==='safari' || adapter.browserDetails.browser==='firefox'){
            this.screensharesession.addTransceiver(streams.getVideoTracks()[0], {direction: "sendonly", streams: [streams]});
        }
        else{
            streams.getTracks().forEach(track=>this.screensharesession.addTrack(track, streams));
        }
    };

    let screenMediaCallBackFail = function(error){
        GLOBAL.error("Screen Share Fail = " + error.message);
        if(this.screensharesession.param.onError){
            this.screensharesession.param.onError(error);
        }
    };

    this.stopScreenShare = function(){
        if(this.screensharesession){
            this.screensharesession.getSenders().forEach(function(mediasource){
                if(mediasource.track){
                    mediasource.track.stop();
                }
            });

            this.screensharesession.close();
            this.screensharesession = null;
            ucEngine.Conf.sendOffer(GLOBAL_MODULE.getConfID(), {type: 2, sdp: null});
        }
    };

    this.startScreenShare = function(param){
        createPeerConnection(param);
        if(param.mode==='owner'){
            let constraints = {};
            if(param.mediasourceId!==undefined){
                if(adapter.browserDetails.browser==='chrome'){
                    constraints = {
                        audio: false,
                        video: {
                            mandatory: {
                                chromeMediaSource: 'desktop',
                                maxWidth: window.screen.width,
                                maxHeight: window.screen.height,
                                chromeMediaSourceId: param.mediasourceId
                            },
                            optional: [
                                {googTemporalLayeredScreencast: true}
                            ]
                        }
                    }
                }
            }
            else{
                constraints = {
                    audio: false,
                    video: {mediaSource: "screen"}
                }
            }

            if (navigator.mediaDevices) {
                navigator.mediaDevices.getUserMedia(constraints).then(screenMediaCallBack.bind(this)).catch(screenMediaCallBackFail.bind(this));
            }
        }
        else{
            createOffer(param);
        }
    };

    //for screen share end
    this.checkDevice = function(param){
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices){
            navigator.mediaDevices.enumerateDevices().then(function(device){
                if(param.getDevice){
                    param.getDevice(device);
                }
            }).catch(function(error){
                if(param.getDeviceFail){
                    param.getDeviceFail(error);
                }
            });
        }
    };

    let createPeerConnection = function(param){
        if(param.type==='main'){
            if( this.mainsession){
                 this.mainsession.close();
                 this.mainsession = null;
            }

            if(param.pcoption){
                 this.mainsession = new RTCPeerConnection(param.pcoption, param.pcconstraints);
            }
            else{
                 this.mainsession = new RTCPeerConnection();
            }
            // https://localhost:4200/openvc/video-call/C85fe840242c4d2ac30cbbabd902d1219
            this.mainsession.param = param;

            // this.mainsession.ontrack = pcOnAddTrack.bind(this);
            this.mainsession.ontrack = param.onSuccess;
            this.mainsession.ondatachannel = pcOnDataChannel.bind(this);
            this.mainsession.onicecandidate = pcOnIcecandidate.bind(this);
            this.mainsession.oniceconnectionstatechange = iceConnectionState.bind(this);
            this.mainsession.onnegotiationneeded = pcOnNegotiationNeeded.bind(this);
            this.mainsession.onremovestream = pcOnRemovestream.bind(this);
            this.mainsession.onsignalingstatechange = pcOnSignalingStatechange.bind(this);
        }
        else if(param.type==='screenshare'){
            if(this.screensharesession){
                this.screensharesession.close();
                this.screensharesession = null;
            }

            this.screensharesession = new RTCPeerConnection();
            this.screensharesession.param = param;

            this.screensharesession.ontrack = param.onSuccess;
            this.screensharesession.ondatachannel = pcOnDataChannel.bind(this);
            this.screensharesession.onicecandidate = pcOnIcecandidate.bind(this);
            this.screensharesession.oniceconnectionstatechange = iceConnectionState.bind(this);
            this.screensharesession.onnegotiationneeded = pcOnNegotiationNeeded.bind(this);
            this.screensharesession.onremovestream = pcOnRemovestream.bind(this);
            this.screensharesession.onsignalingstatechange = pcOnSignalingStatechange.bind(this);
        }
        else{
            let viewerpc = null;
            if(Object.keys(this.viewersession) > 0){
                viewerpc = this.viewersession[param.viewerid];
                if(viewerpc){
                    viewerpc.close();
                    delete this.viewersession[param.viewerid];
                    viewerpc = null;
                }
            }

            if(param.pcoption){
                 viewerpc  = new RTCPeerConnection(param.pcoption, param.pcconstraints);
            }
            else{
                 viewerpc  = new RTCPeerConnection();
            }

            viewerpc.param = param;

            viewerpc.ontrack = param.onSuccess;
            viewerpc.ondatachannel = pcOnDataChannel.bind(this);
            viewerpc.onicecandidate = pcOnIcecandidate.bind(this);
            viewerpc.oniceconnectionstatechange = iceConnectionState.bind(this);
            viewerpc.onnegotiationneeded = pcOnNegotiationNeeded.bind(this);
            viewerpc.onremovestream = pcOnRemovestream.bind(this);
            viewerpc.onsignalingstatechange = pcOnSignalingStatechange.bind(this);
            this.viewersession[param.viewerid] = viewerpc;
        }
    }.bind(this);

    let receiveAnswer = function(recvdata){
        let body = GLOBAL.clone(recvdata.body);
        let answerbody = {type: 'answer', sdp: body.sdp};
        if(recvdata.requestParam.param.type==='main'){
            if(this.mainsession){
                this.mainsession.setRemoteDescription(answerbody);
            }
        }
        else if(recvdata.requestParam.param.type==='screenshare'){
            if(this.screensharesession){
                this.screensharesession.setRemoteDescription(answerbody);
                if(recvdata.requestParam.param.mode==="owner"){
                    if(recvdata.requestParam.param.onSuccess){
                        recvdata.requestParam.param.onSuccess(recvdata.requestParam.param);
                    }
                }
            }
        }
        else{
            if(this.viewersession[recvdata.requestParam.param.viewerid]){
                this.viewersession[recvdata.requestParam.param.viewerid].setRemoteDescription(answerbody);
            }
        }
    }.bind(this);

    let createOffer = function(param){
        param = param===undefined?this.mainsession.param:param;
        if(param){
            if(param.type==='main'){
                if(adapter.browserDetails.browser !== 'safari' && adapter.browserDetails.browser !== 'firefox' ){
                    let mediaConstraints = { offerToReceiveAudio:true, offerToReceiveVideo:false };
                    this.mainsession.createOffer(mediaConstraints).then(function(offer){
                        this.mainsession.setLocalDescription(offer);

                        let body = {
                            type: 0,
                            sdp:offer.sdp
                        };

                        ucEngine.Conf.sendOffer(GLOBAL_MODULE.getConfID(),  body, {onComplete: receiveAnswer, offerType: param.type, param:param});
                    }.bind(this)).catch(function(error){
                        GLOBAL.error("Create Offer Error = ["+ error.message===""?error.name:error.message+"]");
                        if(param.onFail){
                            param.onFail(error);
                        }
                    }.bind(this));
                }
                else{
                    this.mainsession.createOffer().then(function(offer){
                        if(adapter.browserDetails.browser==='safari'){
                            let n = offer.sdp.indexOf('m=video');
                            if(n != -1) {
                                let m = offer.sdp.indexOf('sendrecv', n);
                                if(m != -1) {
                                    offer.sdp = offer.sdp.replace(/sendrecv/gi, 'sendonly');
                                    offer.sdp = offer.sdp.replace('sendonly', 'sendrecv');
                                }
                            }
                        }
                        this.mainsession.setLocalDescription(offer);

                        let body = {
                            type: 0,
                            sdp:offer.sdp
                        };

                        ucEngine.Conf.sendOffer(GLOBAL_MODULE.getConfID(),  body, {onComplete: receiveAnswer, offerType: param.type, param:param});
                    }.bind(this)).catch(function(error){
                        GLOBAL.error("Create Offer Error = ["+ error.message===""?error.name:error.message+"]");
                        if(param.onFail){
                            param.onFail(error);
                        }
                    }.bind(this));
                }
            }
            else if(param.type==='screenshare'){
                if(param.mode==='owner'){
                    let mediaConstraints = null;
                    if(adapter.browserDetails.browser!=='safari'){
                        mediaConstraints = {
                            'offerToReceiveAudio':false,
                            'offerToReceiveVideo':false,
                        }
                    }

                    this.screensharesession.createOffer(mediaConstraints).then(function(offer){
                        this.screensharesession.setLocalDescription(offer);

                        let body = {
                            type: 2,
                            sdp:offer.sdp
                        };
                        ucEngine.Conf.sendOffer(GLOBAL_MODULE.getConfID(), body, {onComplete: receiveAnswer, offerType: param.type, param:param});
                    }.bind(this)).catch(function(error){
                        if(this.screensharesession.param.onError){
                            this.screensharesession.param.onError(error);
                        }
                    }.bind(this));
                }
                else{
                    let mediaConstraints = null;
                    if( adapter.browserDetails.browser === "safari"){
                        this.screensharesession.addTransceiver('video');

                        this.screensharesession.createOffer().then(function(offer){
                            this.screensharesession.setLocalDescription(offer);

                            let body = {
                                type: 1,
                                viewer: GLOBAL.getMyID(),
                                user: 'screenshare',
                                level: 'high',
                                sdp:offer.sdp
                            };

                            ucEngine.Conf.sendOffer(GLOBAL_MODULE.getConfID(),  body, {onComplete: receiveAnswer, offerType: param.type, param:param});
                        }.bind(this)).catch(function(error){
                            GLOBAL.error("Create Offer Error = ["+ error.message===""?error.name:error.message+"]");
                            if(param.onFail){
                                param.onFail(error);
                            }
                        }.bind(this));
                    }
                    else{
                        mediaConstraints = {
                            'offerToReceiveAudio':false,
                            'offerToReceiveVideo':true
                        };

                        this.screensharesession.createOffer(mediaConstraints).then(function(offer){
                            this.screensharesession.setLocalDescription(offer);

                            let body = {
                                type: 1,
                                viewer: GLOBAL.getMyID(),
                                user: 'screenshare',
                                level: 'high',
                                sdp:offer.sdp
                            };

                            ucEngine.Conf.sendOffer(GLOBAL_MODULE.getConfID(),  body, {onComplete: receiveAnswer, offerType: param.type, param:param});
                        }.bind(this)).catch(function(error){
                            GLOBAL.error("Create Offer Error = ["+ error.message===""?error.name:error.message+"]");
                            if(param.onFail){
                                param.onFail(error);
                            }
                        }.bind(this));
                    }
                }
            }
            else {
                let mediaConstraints = null;
                if( adapter.browserDetails.browser === "safari"){
                    if(param.type==='self'){
                         this.viewersession[param.viewerid].addTransceiver('audio');
                    }
                    this.viewersession[param.viewerid].addTransceiver('video');

                    this.viewersession[param.viewerid].createOffer().then(function(offer){
                        this.viewersession[param.viewerid].setLocalDescription(offer);

                        let body = {
                            type: 1,
                            viewer: param.viewerid,
                            user: param.type==='self'?'self':param.viewerid,
                            level: 'high',
                            sdp:offer.sdp
                        };

                        ucEngine.Conf.sendOffer(GLOBAL_MODULE.getConfID(),  body, {onComplete: receiveAnswer, offerType: 'viewer', param:param});
                    }.bind(this)).catch(function(error){
                        GLOBAL.error("Create Offer Error = ["+ error.message===""?error.name:error.message+"]");
                        if(param.onFail){
                            param.onFail(error);
                        }
                    }.bind(this));
                }
                else{
                    if(param.type==='self'){
                        mediaConstraints = {
                            'offerToReceiveAudio':true,
                            'offerToReceiveVideo':true
                        };
                    }
                    else{
                        mediaConstraints = {
                            'offerToReceiveAudio':false,
                            'offerToReceiveVideo':true
                        };
                    }

                    this.viewersession[param.viewerid].createOffer(mediaConstraints).then(function(offer){
                        this.viewersession[param.viewerid].setLocalDescription(offer);

                        let body = {
                            type: 1,
                            viewer: param.viewerid,
                            user: param.type==='self'?'self':param.viewerid,
                            level: 'high',
                            sdp:offer.sdp
                        };

                        ucEngine.Conf.sendOffer(GLOBAL_MODULE.getConfID(),  body, {onComplete: receiveAnswer, offerType: 'viewer', param:param});
                    }.bind(this)).catch(function(error){
                        GLOBAL.error("Create Offer Error = ["+ error.message===""?error.name:error.message+"]");
                        if(param.onFail){
                            param.onFail(error);
                        }
                    }.bind(this));
                }
            }
        }
    }.bind(this);

    this.getViewer = function(param){
        if(param){
            createPeerConnection(param);
            createOffer(param);
        }
    };

    this.removeViewer = function(param){
        if(param){
            let pc = this.viewersession[param.viewerid];
            if(pc){
                pc.close();
                pc = null;
                delete this.viewersession[param.viewerid];
            }
            ucEngine.Conf.updateViewerInfo(GLOBAL_MODULE.getConfID(), {viewer: param.viewerid, userid: param.viewerid, level: "delete"});
        }
    };

    this.startConference = function(param){
        // param : return callback, device info, peerConnection Create Option

        // startConference sequence
        // 1. get Local Media Stream
        // 2. Create PeerConnection
        // 3. wait call back event
        if(param){
            this.negotiationneeded = false;
            if(param.mode===undefined){
                createPeerConnection(param);
            }

            if(param.devicestatus!=='none'){
                this.getLocalMedia(param, function(streams){
                    GLOBAL.error("Get Local Stream");
                    this.mainstream = streams;
                    let localstreams = null;
                    if(this.mainsession){
                        localstreams = this.mainsession.getSenders();
                    }

                    if(param.mode===undefined){
                        if(localstreams.length > 0){
                            localstreams.forEach(function(localstream){
                                this.mainsession.removeTrack(localstream);
                                localstream.stop();
                            });
                        }

                        if(adapter.browserDetails.browser==='safari' || adapter.browserDetails.browser==='firefox'){
                            this.mainsession.addTransceiver(streams.getAudioTracks()[0], {direction: "sendrecv", streams: [streams]});
                            this.mainsession.addTransceiver(streams.getVideoTracks()[0], {direction: "sendonly", streams: [streams]});
                        }
                        else{
                            streams.getTracks().forEach(track=>this.mainsession.addTrack(track, streams));
                        }
                    }
                    else if(param.mode==='changedevice' || param.mode==='join'){
                        streams.getTracks().forEach(function(track){
                            let sender = this.mainsession.getSenders().find(function(sendertrack){
                                if(sendertrack.track.kind === track.kind){
                                    return true;
                                }
                                return false;
                            });
                            if(sender){
                                sender.replaceTrack(track);
                            }
                            else{
                                if(track.kind==="video"){
                                    if(adapter.browserDetails.browser==='safari' || adapter.browserDetails.browser==='firefox'){
                                        // this.mainsession.addTransceiver(streams.getAudioTracks()[0], {direction: "sendrecv", streams: [streams]});
                                        this.mainsession.addTransceiver(streams.getVideoTracks()[0], {direction: "sendonly", streams: [streams]});
                                    }
                                    else{
                                        this.mainsession.addTrack(track, streams);
                                    }
                                }
                                else if(track.kind==="audio"){
                                    if(adapter.browserDetails.browser==='safari' || adapter.browserDetails.browser==='firefox'){
                                        this.mainsession.addTransceiver(streams.getVideoTracks()[0], {direction: "sendonly", streams: [streams]});
                                    }
                                    else{
                                        this.mainsession.addTrack(track, streams);
                                    }
                                }
                            }
                        }.bind(this));
                        if(param.changeDevice){
                            param.changeDevice();
                        }
                    }
                }.bind(this), function(error){
                    /* handle the error */
                    if (error.name=="NotFoundError" || error.name == "DevicesNotFoundError" ){
                        //required track is missing
                        GLOBAL.error("Get Device Fail = " + error.name);
                    }
                    else if (error.name=="NotReadableError" || error.name == "TrackStartError" ){
                        GLOBAL.error("Get Device Fail = " + error.name);
                    }
                    else if (error.name=="OverconstrainedError" || error.name == "ConstraintNotSatisfiedError" ){
                        //constraints can not be satisfied by avb. devices
                        GLOBAL.error("Get Device Fail = " + error.name + " constrains = " + error.constraints);
                    }
                    else if (error.name=="NotAllowedError" || error.name == "PermissionDeniedError" ){
                        //permission denied in browser
                        GLOBAL.error("Get Device Fail = " + error.name);
                    }
                    else if (error.name=="TypeError" || error.name == "TypeError" ){
                        //empty constraints object
                        GLOBAL.error("Get Device Fail = " + error.name + " constrains = " + error.constraints);
                    }
                    else {
                        //other errors
                        GLOBAL.error("Get Device Fail = " + error.name);
                    }
                    if(param.onFail){
                        param.onFail(error);
                    }
                }.bind(this));
            }
            else{
                createOffer(param);
            }
        }
    };

    this.getLocalMedia = function(param, getLocalStream, getLocalStreamFail){
        if(navigator.mediaDevices.getUserMedia){
            let constraints = {};
            let videoconstraints = {};
            let audioconstraints = {};
            if(param.devicetype==='pc'){
                // pc type get device
                if(param.devicestatus==='all'){
                    audioconstraints = { echoCancellation: true };
                    if(param.audiodeviceid){
                        audioconstraints.deviceId = {exact: param.audiodeviceid};
                    }
                    videoconstraints = { width: {min: 320, ideal: 640, max: 1280}, height: {min:240, ideal:480, max:720}, frameRate: 30};
                    if(param.videodeviceid){
                        videoconstraints.deviceId = {exact: param.videodeviceid};
                    }
                }
                else if(param.devicestatus==='videoonly'){
                    videoconstraints = { width: {min: 320, ideal: 640, max: 1280}, height: {min:240, ideal:480, max:720}, frameRate: 30};
                    if(param.videodeviceid){
                        videoconstraints.deviceId = {exact: param.videodeviceid};
                    }
                }
                else if(param.devicestatus==='audioonly'){
                    audioconstraints = { echoCancellation: true };
                    if(param.audiodeviceid){
                        audioconstraints.deviceId = {exact: param.audiodeviceid};
                    }
                }
            }
            else if(param.devicetype==='mobile'){
                // mobile type get device
                audioconstraints = { echoCancellation: true };
                if(param.audiodeviceid){
                    audioconstraints.deviceId = {exact: param.audiodeviceid};
                }
                videoconstraints = { width: {min: 320, ideal: 640, max: 1280}, height: {min:240, ideal:480, max:720}, frameRate: 30, facingMode: { exact: param.facingMode }};
            }

            if(Object.keys(videoconstraints).length === 0){
                if(param.devicestatus==='all' || param.devicestatus==='videoonly'){
                    constraints.video = true;
                }
            }
            else{
                constraints.video = videoconstraints;
            }

            if(Object.keys(audioconstraints).length === 0){
                if(param.devicestatus==='all'||param.devicestatus==='audioonly'){
                    constraints.audio = true;
                }
            }
            else{
                constraints.audio = audioconstraints;
            }

            navigator.mediaDevices.getUserMedia(constraints).then(getLocalStream).catch(getLocalStreamFail);
            return true;
        }
        return false;
    };

    let pcOnAddTrack = function(event){
        GLOBAL.error("OnAddTrack");
    };

    let pcOnDataChannel = function(event){

    };

    let pcOnIcecandidate = function(event){

    };

    let iceConnectionState = function(event){

    };

    let pcOnNegotiationNeeded = function(event){
        if(!this.negotiationneeded){
            this.negotiationneeded = true;
            createOffer(event.currentTarget.param);
        }
    };

    let pcOnRemovestream = function(event){

    };

    let pcOnSignalingStatechange = function(event){

    };

    this.mediamute = function(type, mute){
        this.mainsession.getSenders().forEach(function(media){
            if(media.track.kind===type){
                media.track.enabled = mute?false:true;
            }
        });
    };
    return this;
}

module.exports = VideoCallEngine;

},{}]},{},[40]);
