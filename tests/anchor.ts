import * as anchor from "@coral-xyz/anchor";
import * as web3 from "@solana/web3.js";
import { CpiGuardLayout, createAssociatedTokenAccountInstruction, getAccount, getAssociatedTokenAddress } from "@solana/spl-token";
import { SimpleTokenSwap } from "../target/types/Simple_Token_Swap";
import { BN } from "bn.js";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { assert } from "chai";

const base58PrivateKey = "";
const privateKeySeed = bs58.decode(base58PrivateKey);

const userKeyPair = web3.Keypair.fromSecretKey(privateKeySeed);

const connection = new web3.Connection("https://api.devnet.solana.com", "confirmed");
const userWallet = new anchor.Wallet(userKeyPair);
const provider = new anchor.AnchorProvider(connection, userWallet, {
  preflightCommitment: "confirmed",
});
anchor.setProvider(provider);
// anchor.setProvider(anchor.AnchorProvider.env());

describe("Test", () => {

  const program = anchor.workspace.SimpleTokenSwap as anchor.Program<SimpleTokenSwap>;

  const tokenA_mint_address = new web3.PublicKey("GTha4aTjKC2odMHdbSPbNZYwnkaCbd1b5YBkUEPRMyyk");
  const tokenB_mint_address = new web3.PublicKey("3kRHQT3z98KHDe5PHN2iMJgdEwKC6QgsWXjAHsbYjjmj");

  const userPublicKey = new web3.PublicKey("HVw1Z2KFYfKjdL2UThi5RGBvSUpsF4zdsPrucV8TggQm");

  const [mint] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("mint")],
    program.programId
  );

  const [authorityPDA] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("authority")],
    program.programId
  );

  const [userPDALiquidity, bump] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("userliquidityPDA"), userPublicKey.toBuffer()],
    program.programId
  );

  const [vault_token_account_a, bump1] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("vaultTokenA"), tokenA_mint_address.toBuffer()],
    program.programId
  );

  const [vault_token_account_b, bump2] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("vaultTokenB"), tokenB_mint_address.toBuffer()],
    program.programId
  );

  const [vault_auth_a, bump3] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("vaultTokenA"), tokenA_mint_address.toBuffer()],
    program.programId
  );

  const [vault_auth_b, bump4] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("vaultTokenB"), tokenB_mint_address.toBuffer()],
    program.programId
  );

  it("Fetches the price of Token A and Token B", async () => {
    const Token_A = await getAccount(program.provider.connection, vault_token_account_a);
    const Token_A_Quantity = parseInt(Token_A.amount.toString(), 10);

    const Token_B = await getAccount(program.provider.connection, vault_token_account_b);
    const Token_B_Quantity = parseInt(Token_B.amount.toString(), 10);

    const Price_of_Token_A = Token_B_Quantity / Token_A_Quantity;
    const Price_of_Token_B = Token_A_Quantity / Token_B_Quantity;

    console.log("This is the new price of Token A: ", Price_of_Token_A);
    console.log("This is the new price of Token B: ", Price_of_Token_B);
  });

  it("Fetches the price for Token A and Token B with slippage", async () => {
    const decimals = 1000000000;
    const Token_A = await getAccount(program.provider.connection, vault_token_account_a);
    const Token_A_Quantity = parseInt(Token_A.amount.toString(), 10);
    console.log("This is the quantity in number: ", Token_A_Quantity / decimals);

    const Token_B = await getAccount(program.provider.connection, vault_token_account_b);
    const Token_B_Quantity = parseInt(Token_B.amount.toString(), 10);
    console.log("This is the Token B quantity in number: ", Token_B_Quantity / decimals);

    const k = Token_A_Quantity * Token_B_Quantity;

    // const Price_of_Token_A = (-k + ((Token_A_Quantity - 100) * Token_B_Quantity)) / (100 - Token_A_Quantity);
    // console.log("Price of token A in terms of Token B is: ", Price_of_Token_A);
    // const Price_of_Token_B = (-k + ((Token_B_Quantity - 100) * Token_A_Quantity)) / (100 - Token_B_Quantity);
    // console.log("Price of Token B in terms of Token A is: ", Price_of_Token_B);

    // Spot Price: Token A -> Token B
    const spotPrice = Token_B_Quantity / Token_A_Quantity;
    console.log("Spot price (1 A in B): ", spotPrice);

    // Simulate a swap of 100 Token A
    const inputAmount = 1 * decimals;

    const newTokenA = Token_A_Quantity + inputAmount;
    const newTokenB = k / newTokenA;
    const outputB = Token_B_Quantity - newTokenB;
    const swapPrice = outputB / inputAmount;

    console.log("Swap price (1A in B): ", swapPrice);
    console.log("Output B: ", outputB / decimals);

    const slippage = ((spotPrice - swapPrice) / spotPrice) * 100;

    if (slippage >= 1) {
      console.log("slipage is more than 1 percent");
      return;
    }

    // 1 Sol = 100 USDC
    // 10 sol = 10 * 100 USDC
    const expected_token_user_will_receive = 1000;

    // const mint_out = expected_token_user_will_receive * (1 - slippage_percent);

    console.log("This is the slippage: ", slippage);
  });

  it("initializes a Vault Account For Token A", async () => {
    const [vault_token_account, bump1] = await web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vaultTokenA"), tokenA_mint_address.toBuffer()],
      program.programId
    );

    const [vaultPDA, bump2] = await web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vaultTokenA"), tokenA_mint_address.toBuffer()],
      program.programId
    );

    // Send Transaction
    const txHash = await program.methods
      .initializeVaultTokenA()
      .accounts({
        vaultTokenAccount: vault_token_account,
        vault_auth: vaultPDA,
        payer: program.provider.publicKey,
        mint: tokenA_mint_address,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: new web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        rent: web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);

    // Confirm Transaction
    await program.provider.connection.confirmTransaction(txHash);
  });

  it("initializes a Vault Account For Token B", async () => {
    const [vault_token_account, bump1] = await web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vaultTokenB"), tokenB_mint_address.toBuffer()],
      program.programId
    )

    const [vaultPDA, bump2] = await web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vaultTokenB"), tokenB_mint_address.toBuffer()],
      program.programId
    );

    // Send Transaction
    const txHash = await program.methods
      .initializeVaultTokenB()
      .accounts({
        vaultTokenAccount: vault_token_account,
        vault_auth: vaultPDA,
        payer: program.provider.publicKey,
        mint: tokenB_mint_address,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: new web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        rent: web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);

    // Confirm Transaction
    await program.provider.connection.confirmTransaction(txHash);

    const pda_token_value = await getAccount(program.provider.connection, vault_token_account);
    console.log("Vault Token B Account Balance: ", pda_token_value.amount.toString());
  });

  it("Creates a Token Mint", async () => {
    const METADATA_SEED = "metadata";
    const TOKEN_METADATA_PROGRAM_ID = new web3.PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

    const metadata = {
      name: "LP Token",
      symbol: "LP",
      uri: "https://jsonkeeper.com/b/7G05",
      decimals: 9
    }

    const [mint] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("mint")],
      program.programId
    );

    const [authorityPDA] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("authority")],
      program.programId
    );

    const [metadataAddress] = web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(METADATA_SEED),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    const txHash = await program.methods
      .createTokenMint(metadata)
      .accounts({
        metadata: metadataAddress,
        mint: mint,
        authority: authorityPDA,
        payer: program.provider.publicKey,
        rent: web3.SYSVAR_RENT_PUBKEY,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: new web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID
      })
      .rpc();

    console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);

    // Confirm Transaction
    await program.provider.connection.confirmTransaction(txHash);
  });

  it("initializes a liquidity account", async () => {

    const [userPDALiquidity, bump] = await web3.PublicKey.findProgramAddressSync(
      [Buffer.from("userliquidityPDA"), userPublicKey.toBuffer()],
      program.programId
    );

    const accountInfo = await program.provider.connection.getAccountInfo(userPDALiquidity);

    if (accountInfo) {
      console.log("User Liquidity account is already initialized");
      return;
    }

    const txHash = await program.methods
      .initializeUserLiquidityAccount()
      .accounts({
        user: userPublicKey,
        userPdaAccount: userPDALiquidity,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([userKeyPair])
      .rpc();

    console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);

    // Confirm Transaction
    await program.provider.connection.confirmTransaction(txHash);
  });

  it("adds liquidity to the liquidity pool", async () => {

    // Deriving user Token ATA
    const user_token_a_ata = await getAssociatedTokenAddress(
      tokenA_mint_address,
      userPublicKey
    );

    const user_token_b_ata = await getAssociatedTokenAddress(
      tokenB_mint_address,
      userPublicKey
    );

    const destination = await anchor.utils.token.associatedAddress({
      mint: mint,
      owner: userPublicKey
    });

    const token_amount = new BN(5_000_000_000);

    const txHash = await program.methods
      .addLiquidity(token_amount)
      .accounts({
        user: userPublicKey,
        userPdaAccount: userPDALiquidity,
        userTokenAccountForTokenA: user_token_a_ata,
        userTokenAccountForTokenB: user_token_b_ata,
        vaultTokenAAccount: vault_token_account_a,
        vaultTokenBAccount: vault_token_account_b,
        vaultAuthA: vault_auth_a,
        vaultAuthB: vault_auth_b,
        mintA: tokenA_mint_address,
        mintB: tokenB_mint_address,
        mint: mint,
        destination: destination,
        destinationOwner: userPublicKey,
        authority: authorityPDA,
        rent: web3.SYSVAR_RENT_PUBKEY,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: new web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      })
      .signers([userKeyPair])
      .rpc();

    console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);

    // Confirm Transaction
    await program.provider.connection.confirmTransaction(txHash);

    const userLiquidityInfo = await program.account.liquidityAccount.fetch(userPDALiquidity);
    console.log("This is the userLiquidity info:  ", userLiquidityInfo.stakedTokenAmount.toNumber());

    // Assertions
    assert.equal(userLiquidityInfo.stakedTokenAmount.toNumber(), 5000000000);
  });

  it("removes liquidity from the liquidity pool", async () => {

    const user_token_a_ata = await getAssociatedTokenAddress(
      tokenA_mint_address,
      userPublicKey
    );

    const user_token_b_ata = await getAssociatedTokenAddress(
      tokenB_mint_address,
      userPublicKey
    );

    const destination = await anchor.utils.token.associatedAddress({
      mint: mint,
      owner: userPublicKey
    });

    const token_amount = new BN(1_000_000_000);

    const txHash = await program.methods
      .removeLiquidity(token_amount)
      .accounts({
        user: userPublicKey,
        userPdaAccount: userPDALiquidity,
        userTokenAccountForTokenA: user_token_a_ata,
        userTokenAccountForTokenB: user_token_b_ata,
        vaultTokenAAccount: vault_token_account_a,
        vaultTokenBAccount: vault_token_account_b,
        vaultAuthA: vault_auth_a,
        vaultAuthB: vault_auth_b,
        mintA: tokenA_mint_address,
        mintB: tokenB_mint_address,
        mint: mint,
        authority: authorityPDA,
        destination: destination,
        destinationOwner: userPublicKey,
        rent: web3.SYSVAR_RENT_PUBKEY,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: new web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      })
      .signers([userKeyPair])
      .rpc();

    console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);

    // Confirm Transaction
    await program.provider.connection.confirmTransaction(txHash);

    const userLiquidityInfo = await program.account.liquidityAccount.fetch(userPDALiquidity);
    console.log("This is the userLiquidityInfo is: ", userLiquidityInfo.stakedTokenAmount.toNumber());

    // Assertions
    assert.equal(userLiquidityInfo.stakedTokenAmount.toNumber(), 0);
  })

  it("Swap Token A for Token B for a user", async () => {
    const Token_A = await getAccount(program.provider.connection, vault_token_account_a);
    const Token_A_Quantity = parseInt(Token_A.amount.toString(), 10);

    const Token_B = await getAccount(program.provider.connection, vault_token_account_b);
    const Token_B_Quantity = parseInt(Token_B.amount.toString(), 10);

    const Price_Of_Token_A = Token_B_Quantity / Token_A_Quantity;
    const Price_of_Token_B = Token_A_Quantity / Token_B_Quantity;

    console.log("This is the new price of Token A: ", Price_Of_Token_A);
    console.log("This is the new price of Token B: ", Price_of_Token_B);

    const userSlippageTolerancePercent = 1;

    const userPublicKey = new web3.PublicKey("HVw1Z2KFYfKjdL2UThi5RGBvSUpsF4zdsPrucV8TggQm");

    // Deriving user ATA for Token A
    const destination_token_a = await getAssociatedTokenAddress(
      tokenA_mint_address,
      userPublicKey
    );

    const userATAforTokenA = destination_token_a.toBase58();

    // Deriving user ATA for Token B
    const destination = await getAssociatedTokenAddress(
      tokenB_mint_address,
      userPublicKey
    );

    // Check if the Token_B ATA is initialized or not
    const ataAccountInfo = await program.provider.connection.getAccountInfo(destination);

    if (ataAccountInfo && ataAccountInfo.data.length > 0) {
      console.log("ATA is already initialized");
    } else {
      console.log("Initializing ATA");

      // Create associated token account if it doesn't exist
      const ataIx = createAssociatedTokenAccountInstruction(
        program.provider.publicKey,     // payer
        destination,               // ata to be created
        userPublicKey,                  // token account owner
        tokenB_mint_address             // mint
      );

      const tx = new web3.Transaction().add(ataIx);

      await program.provider.sendAndConfirm(tx);
    }

    const userATAforTokenB = destination.toBase58();

    const vaultTokenAVault = await getAccount(program.provider.connection, vault_token_account_a);
    const vaultTokenBVault = await getAccount(program.provider.connection, vault_token_account_b);

    console.log("This is the value of vault_token_account_a: ", vaultTokenAVault.amount.toString());
    console.log("This is the value of vault_token_account_b: ", vaultTokenBVault.amount.toString());

    const amount = new BN(1_000_000_000);

    const expectedOutput = amount.mul(new BN(Price_of_Token_B * 1000)).divn(1000);

    const swapFees = 0.003;

    const expectedOutput_With_Swap_Fees = expectedOutput.muln(1 - swapFees);

    const slippageMultiplier = 1 - userSlippageTolerancePercent;
    const minExpectedOutput = expectedOutput_With_Swap_Fees.muln(slippageMultiplier * 1000).divn(10000);

    const txHash = await program.methods
      .swapAForB(amount, minExpectedOutput)
      .accounts({
        user: userPublicKey,
        userTokenAccountForTokenA: userATAforTokenA,
        userTokenAccountForTokenB: userATAforTokenB,
        vaultTokenAAccount: vault_token_account_a,
        vaultTokenBAccount: vault_token_account_b,
        vaultAuthA: vault_auth_a,
        vaultAuthB: vault_auth_b,
        mintA: tokenA_mint_address,
        mintB: tokenB_mint_address,
        tokenProgram: new web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
      })
      .signers([userKeyPair])
      .rpc();

    console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);

    // Confirm Transaction
    await program.provider.connection.confirmTransaction(txHash);
  });

  it("Swap Token B for Token A for a user", async () => {
    const Token_A = await getAccount(program.provider.connection, vault_token_account_a);

    const Token_B = await getAccount(program.provider.connection, vault_token_account_b);

    const Token_A_Quantity = parseInt(Token_A.amount.toString(), 10);
    const Token_B_Quantity = parseInt(Token_B.amount.toString(), 10);

    const Price_Of_Token_A = Token_B_Quantity / Token_A_Quantity;
    const Price_Of_Token_B = Token_A_Quantity / Token_B_Quantity;

    const userSlippageTolerancePercent = 1;

    const userPublicKey = new web3.PublicKey("HVw1Z2KFYfKjdL2UThi5RGBvSUpsF4zdsPrucV8TggQm");

    // Deriving user ATA for Token B
    const destination = await getAssociatedTokenAddress(
      tokenB_mint_address,
      userPublicKey
    );

    const userATAforTokenB = destination.toBase58();

    // Deriving user ATA for Token A
    const destination_token_a = await getAssociatedTokenAddress(
      tokenA_mint_address,
      userPublicKey
    );

    const userATAforTokenA = destination_token_a.toBase58();

    // Check if the Token_A ATA is initialized or not
    const ataAccountInfo = await program.provider.connection.getAccountInfo(destination_token_a);

    if (ataAccountInfo && ataAccountInfo.data.length > 0) {
      console.log("ATA is already initialized");
    } else {
      console.log("Initializing ATA");

      // Create associated token account if it doesn't exist
      const ataIx = createAssociatedTokenAccountInstruction(
        program.provider.publicKey,     // payer
        destination_token_a,            // ata to be created
        userPublicKey,                  // token account owner
        tokenA_mint_address             // mint
      );

      const tx = new web3.Transaction().add(ataIx);

      await program.provider.sendAndConfirm(tx);
    }

    const vaultTokenAVault = await getAccount(program.provider.connection, vault_token_account_a);
    const vaultTokenBVault = await getAccount(program.provider.connection, vault_token_account_b);

    const amount = new BN(1_000_000_000);

    const expectedOutput = amount.mul(new BN(Price_Of_Token_A * 1000)).divn(1000);

    const swapFees = 0.003;

    const expectedOutput_With_Swap_Fees = expectedOutput.muln(1 - swapFees);

    const slippageMultiplier = 1 - userSlippageTolerancePercent;

    const minExpectedOutput = expectedOutput_With_Swap_Fees.muln(slippageMultiplier * 1000).divn(10000);

    const txHash = await program.methods
      .swapBForA(amount, minExpectedOutput)
      .accounts({
        user: userPublicKey,
        userTokenAccountForTokenA: userATAforTokenA,
        userTokenAccountForTokenB: userATAforTokenB,
        vaultTokenAAccount: vault_token_account_a,
        vaultTokenBAccount: vault_token_account_b,
        vaultAuthA: vault_auth_a,
        vaultAuthB: vault_auth_b,
        mintA: tokenA_mint_address,
        mintB: tokenB_mint_address,
        tokenProgram: new web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
      })
      .signers([userKeyPair])
      .rpc();

    console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);

    // Confirm Transaction
    await program.provider.connection.confirmTransaction(txHash);
  });

  it("Price Impact Calculation when swapping Token A for Token B", async () => {
    const Token_A = await getAccount(program.provider.connection, vault_token_account_a);

    const Token_B = await getAccount(program.provider.connection, vault_token_account_b);

    const Token_A_Quantity = parseInt(Token_A.amount.toString(), 10);
    const Token_B_Quantity = parseInt(Token_B.amount.toString(), 10);

    const amount = 1_000_000_000;

    const k = Token_A_Quantity * Token_B_Quantity;

    const newReserveA = Token_A_Quantity + amount;
    const newReserveB = k / newReserveA;
    const outputB = Token_B_Quantity - newReserveB;

    const swapFees = 0.003;
    const outputBWithFees = outputB - (1 - swapFees);

    const spotPrice = Token_B_Quantity / Token_A_Quantity;
    const swapPrice = outputBWithFees / amount;

    const priceImpactPercent = ((spotPrice - swapPrice) / spotPrice) * 100;

    console.log("This is the price impact: ", priceImpactPercent);
  });

  it("Price Impact Calculation when swapping Token B for Token A", async () => {
    const Token_A = await getAccount(program.provider.connection, vault_token_account_a);

    const Token_B = await getAccount(program.provider.connection, vault_token_account_b);

    const Token_A_Quantity = parseInt(Token_A.amount.toString(), 10);
    const Token_B_Quantity = parseInt(Token_B.amount.toString(), 10);

    const amount = 1_000_000_000;

    const k = Token_A_Quantity * Token_B_Quantity;

    const newReserveB = Token_B_Quantity + amount;
    const newReserveA = k / newReserveB;
    const outputA = Token_A_Quantity - newReserveA;

    const swapFees = 0.003;
    const outputAWithFees = outputA - (1 - swapFees);

    const spotPrice = Token_A_Quantity / Token_B_Quantity;
    const swapPrice = outputAWithFees / amount;

    const priceImpactPercent = ((spotPrice - swapPrice) / spotPrice) * 100;

    console.log("This is the price impact: ", priceImpactPercent);
  });
});