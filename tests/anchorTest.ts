import * as anchor from "@coral-xyz/anchor";
import * as web3 from "@solana/web3.js";
import { CpiGuardLayout, createAssociatedTokenAccountInstruction, getAccount, getAssociatedTokenAddress } from "@solana/spl-token";
import { SimpleTokenSwap } from "../target/types/Simple_Token_Swap";
import { BN } from "bn.js";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";

describe("Test", () => {
  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.SimpleTokenSwap as anchor.Program<SimpleTokenSwap>;

  const tokenA_mint_address = new web3.PublicKey("GTha4aTjKC2odMHdbSPbNZYwnkaCbd1b5YBkUEPRMyyk");
  const tokenB_mint_address = new web3.PublicKey("3kRHQT3z98KHDe5PHN2iMJgdEwKC6QgsWXjAHsbYjjmj");

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

  const [userPDALiquidity, bump5] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("userliquidityPDA"), program.provider.publicKey.toBuffer()],
    program.programId
  );

  it("initializes a Vault Account For Token A", async () => {
    const [vault_token_account, bump1] = await web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vaultTokenA"), tokenA_mint_address.toBuffer()],
      program.programId
    );

    const [vaultPDA, bump2] = await web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vaultTokenA"), tokenA_mint_address.toBuffer()],
      program.programId
    );

    console.log("This is the Token vault_token_account for Token A: ", vault_token_account.toString());
    console.log("This is the vaultPDA for Token A: ", vaultPDA.toString());

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

  it("initializes a liquidity account", async () => {

    const [userPDALiquidity, bump] = await web3.PublicKey.findProgramAddressSync(
      [Buffer.from("userliquidityPDA"), program.provider.publicKey.toBuffer()],
      program.programId
    );

    const accountInfo = await program.provider.connection.getAccountInfo(userPDALiquidity);

    console.log("This is the user liquidity PDA: ", userPDALiquidity.toBase58());

    if (accountInfo) {
      console.log("User Liquidity account is already initialized");
      return;
    }

    const txHash = await program.methods
      .initializeUserLiquidityAccount()
      .accounts({
        user: program.provider.publicKey,
        userPdaAccount: userPDALiquidity,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);

    // Confirm Transaction
    await program.provider.connection.confirmTransaction(txHash);
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

  it("adds liquidity to the liquidity pool", async () => {

    const [mint] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("mint")],
      program.programId
    );

    const [authorityPDA] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("authority")],
      program.programId
    );

    console.log("This is the Mint: ", mint.toBase58());

    // Deriving user Token ATA
    const user_token_a_ata = await getAssociatedTokenAddress(
      tokenA_mint_address,
      program.provider.publicKey
    );

    const user_token_b_ata = await getAssociatedTokenAddress(
      tokenB_mint_address,
      program.provider.publicKey
    );

    const destination = await anchor.utils.token.associatedAddress({
      mint: mint,
      owner: program.provider.publicKey
    });

    const token_amount = new BN(5_000_000_000);

    const acc = await program.provider.connection.getAccountInfo(mint);
    console.log("Mint account exists?", !!acc);

    const txHash = await program.methods
      .addLiquidity(token_amount)
      .accounts({
        user: program.provider.publicKey,
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
        destinationOwner: program.provider.publicKey,
        payer: program.provider.publicKey,
        rent: web3.SYSVAR_RENT_PUBKEY,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: new web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      })
      .rpc();

    console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);

    // Confirm Transaction
    await program.provider.connection.confirmTransaction(txHash);
  });

  it("removes liquidity from the liquidity pool", async () => {

    const [mint] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("mint")],
      program.programId
    );

    const [authorityPDA] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("authority")],
      program.programId
    );

    console.log("This is the Mint: ", mint.toBase58());

    const user_token_a_ata = await getAssociatedTokenAddress(
      tokenA_mint_address,
      program.provider.publicKey
    );

    const user_token_b_ata = await getAssociatedTokenAddress(
      tokenB_mint_address,
      program.provider.publicKey
    );

    const destination = await anchor.utils.token.associatedAddress({
      mint: mint,
      owner: program.provider.publicKey
    });

    const token_amount = new BN(5_000_000_000);

    const txHash = await program.methods
      .removeLiquidity(token_amount)
      .accounts({
        user: program.provider.publicKey,
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
        destinationOwner: program.provider.publicKey,
        payer: program.provider.publicKey,
        rent: web3.SYSVAR_RENT_PUBKEY,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: new web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      })
      .rpc();

    console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);

    // Confirm Transaction
    await program.provider.connection.confirmTransaction(txHash);
  })

  it("Swap Token B for Token A", async () => {

    const Token_A = await getAccount(program.provider.connection, vault_token_account_a);
    const Token_B = await getAccount(program.provider.connection, vault_token_account_b);

    const Token_A_Quantity = parseInt(Token_A.amount.toString(), 10);
    const Token_B_Quantity = parseInt(Token_B.amount.toString(), 10);

    const Price_Of_Token_A = Token_B_Quantity / Token_A_Quantity;
    const Price_Of_Token_B = Token_A_Quantity / Token_B_Quantity;

    const userSlippageTolerancePercent = 1;

    // Deriving user ATA for Token B
    const destination = await getAssociatedTokenAddress(
      tokenB_mint_address,
      program.provider.publicKey
    );

    const userATAforTokenB = destination.toBase58();

    // Deriving user ATA for Token A
    const destination_token_a = await getAssociatedTokenAddress(
      tokenA_mint_address,
      program.provider.publicKey
    );

    const userATAforTokenA = destination_token_a.toBase58();

    const amount = new BN(10_000_000_000);

    const expectedOutput = amount.mul(new BN(Price_Of_Token_A));

    const swapFees = 0.003;

    const expectedOutput_With_Swap_Fees = expectedOutput.muln(1 - swapFees);

    const slippageMultiplier = 1 - userSlippageTolerancePercent;

    const minExpectedOutput = expectedOutput_With_Swap_Fees.muln(slippageMultiplier * 1000).divn(10000);

    const txHash = await program.methods
      .swapBForA(amount, minExpectedOutput)
      .accounts({
        user: program.provider.publicKey,
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
      .rpc();

    console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);

    // Confirm Transaction
    await program.provider.connection.confirmTransaction(txHash);
  })

  it("Swap Token A for Token B", async () => {

    const Token_A = await getAccount(program.provider.connection, vault_token_account_a);
    const Token_B = await getAccount(program.provider.connection, vault_token_account_b);

    const Token_A_Quantity = parseInt(Token_A.amount.toString(), 10);
    const Token_B_Quantity = parseInt(Token_B.amount.toString(), 10);

    const Price_Of_Token_A = Token_B_Quantity / Token_A_Quantity;
    const Price_Of_Token_B = Token_A_Quantity / Token_B_Quantity;

    const userSlippageTolerancePercent = 1;

    // Deriving user ATA for Token A
    const destination_token_a = await getAssociatedTokenAddress(
      tokenA_mint_address,
      program.provider.publicKey
    );

    const userATAforTokenA = destination_token_a.toBase58();

    // Deriving user ATA for Token B
    const destination = await getAssociatedTokenAddress(
      tokenB_mint_address,
      program.provider.publicKey
    );

    const userATAforTokenB = destination.toBase58();

    const amount = new BN(10_000_000_000);

    const expectedOutput = amount.mul(new BN(Price_Of_Token_B));

    const swapFees = 0.003;

    const expectedOutput_With_Swap_Fees = expectedOutput.muln(1 - swapFees);

    const slippageMultiplier = 1 - userSlippageTolerancePercent;
    const minExpectedOutput = expectedOutput_With_Swap_Fees.muln(slippageMultiplier * 1000).divn(10000);

    const txHash = await program.methods
      .swapAForB(amount, minExpectedOutput)
      .accounts({
        user: program.provider.publicKey,
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