//import the necessary packages
import { Connection, Keypair } from "@solana/web3.js";
import { initializeKeypair } from "@solana-developers/helpers";
import { getAccount, getTransferFeeAmount, withdrawWithheldTokensFromAccounts } from "@solana/spl-token";
import { createAccount, createAssociatedTokenAccount, mintTo, TOKEN_2022_PROGRAM_ID, transfer, transferChecked, transferCheckedWithFee } from "@solana/spl-token";
import { createMintWithTransferFee } from "./create-mint.ts";

//create a new connection
const connection = new Connection("http://127.0.0.1:8899", "confirmed");
const payer = await initializeKeypair(connection);

console.log(`Public key of the payer : ${payer.publicKey.toBase58()}`);

//create the mint address
const mintKeypair = Keypair.generate();
const mint = mintKeypair.publicKey;
console.log("\nMint public key : " + mintKeypair.publicKey.toBase58() + "\n\n");

//create mint with transfer fee
const decimals = 9;
const feeBasisPoints = 1000;
const maxFee = BigInt(5000);

await createMintWithTransferFee(connection, payer, mintKeypair, decimals, feeBasisPoints, maxFee);
 
//create fee vault account -> an associated token account to store the withdrawn tokens
const feeVaultAccount = await createAssociatedTokenAccount(connection, payer, mintKeypair.publicKey, payer.publicKey, {
    commitment : "finalized"
},
TOKEN_2022_PROGRAM_ID);

//using getTokenAccountBalance function to get the token initial balance
const initialBalance = (await connection.getTokenAccountBalance(feeVaultAccount, "finalized")).value.amount;
console.log("Current fee vault balance: " + initialBalance + "\n\n");
 
//create a source account and mint some tokens
const sourceKeypair = Keypair.generate();
const sourceAccount = await createAccount(
    connection,
    payer,
    mint,
    sourceKeypair.publicKey,
    undefined,
    { commitment : "finalized" },
    TOKEN_2022_PROGRAM_ID
);
 
//create destination account
const destinationKeypair = Keypair.generate();
const destinationAccount = await createAccount(
  connection,
  payer,
  mint,
  destinationKeypair.publicKey,
  undefined,
  { commitment: "finalized" },
  TOKEN_2022_PROGRAM_ID,
);

const amountToMint = 10*10**decimals;

//mint 10 transfer fee tokens to the source account
await mintTo(
    connection,
    payer,

    //to specify which token to mint
    mint,
    sourceAccount,
    payer,
    amountToMint,

    //signers for the mint to instruction
    [payer],
    { commitment: "finalized" },
    TOKEN_2022_PROGRAM_ID,
);
 
//transfer tokens
const transferAmount = BigInt(1*10**decimals);
const basisPointFee = (transferAmount * BigInt(feeBasisPoints)) / BigInt(10_000);
const fee = basisPointFee > maxFee ? maxFee : basisPointFee;

//call the transfer checked function
const tx = await transferCheckedWithFee(
    connection,
    payer,
    sourceAccount,
    mint,
    destinationAccount,
    sourceKeypair.publicKey,
    transferAmount,
    decimals,
    fee,
    [sourceKeypair],
    { commitment: "finalized" },
    TOKEN_2022_PROGRAM_ID,
);

//get the state of the accounts after the transfer of 1 token from source to destination
const sourceAccountAfterTransfer = await getAccount(
    connection,
    sourceAccount,
    undefined,
    TOKEN_2022_PROGRAM_ID,
);
   
const destinationAccountAfterTransfer = await getAccount(
    connection,
    destinationAccount,
    undefined,
    TOKEN_2022_PROGRAM_ID,
);

//get the withheld amount
const withheldAmount = getTransferFeeAmount(destinationAccountAfterTransfer);

console.log(`Source Token Balance: ${sourceAccountAfterTransfer.amount}`);
console.log(
  `Destination Token Balance: ${destinationAccountAfterTransfer.amount}`,
);
console.log(
    `Withheld Transfer Fees: ${withheldAmount?.withheldAmount}\n`,
);
 
//fetch accounts with withheld tokens
await withdrawWithheldTokensFromAccounts(
    connection,
    payer,
    mint,

    //withdraw into the fee vault account
    feeVaultAccount,
    payer.publicKey,
    [],

    //Imp : list of all the accounts that we want to withdraw from
    [destinationAccount],
    undefined,
    TOKEN_2022_PROGRAM_ID
);

//get the status of the destination account after the withdraw of the withheld tokens
const withheldAccountAfterWithdraw = await getAccount(
    connection,
    destinationAccount,
    undefined,
    TOKEN_2022_PROGRAM_ID,
);

const withheldAmountAfterWithdraw = getTransferFeeAmount(withheldAccountAfterWithdraw);

//check the status of the fee vault account after the withdraw
const feeVaultAfterWithdraw = await getAccount(
    connection,
    feeVaultAccount,
    undefined,
    TOKEN_2022_PROGRAM_ID,
);

//this was the first method of withdrawing the withheld tokens using the token vault account
console.log(
    `Withheld amount after withdraw: ${withheldAmountAfterWithdraw?.withheldAmount}`,
  );
console.log(
    `Fee vault balance after withdraw: ${feeVaultAfterWithdraw.amount}\n`,
);
