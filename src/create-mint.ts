//importing the necessary packages
import{
    sendAndConfirmTransaction,
    Connection,
    Keypair,
    SystemProgram,
    Transaction,
    TransactionSignature,
} from "@solana/web3.js";
   
import {
    ExtensionType,
    createInitializeMintInstruction,
    getMintLen,
    TOKEN_2022_PROGRAM_ID,
    createInitializeTransferFeeConfigInstruction,
} from "@solana/spl-token";

//function to create the transfer fee mint
export async function createMintWithTransferFee(
    connection : Connection,
    payer : Keypair,
    mintKeypair: Keypair,
    decimals: number,
    feeBasisPoints: number,
    maxFee : bigint,
): Promise<TransactionSignature>{
    const extensions = [ExtensionType.TransferFeeConfig];
    const mintLen = getMintLen(extensions);

    const mintLamports = await connection.getMinimumBalanceForRentExemption(mintLen);
    console.log("Creating a transaction with transfer fee instruction.");

    //creating the mint transaction
    const mintTransaction = new Transaction().add(
        //create the mint account
        SystemProgram.createAccount({
            fromPubkey : payer.publicKey,
            newAccountPubkey : mintKeypair.publicKey,
            space : mintLen,
            lamports : mintLamports,
            programId : TOKEN_2022_PROGRAM_ID
        }),

        //initialize the transfer fee extension
        createInitializeTransferFeeConfigInstruction(
            mintKeypair.publicKey,
            payer.publicKey,
            payer.publicKey,
            feeBasisPoints,
            maxFee,
            TOKEN_2022_PROGRAM_ID
        ),

        //initialize the mint formally with the transfer fee extension
        createInitializeMintInstruction(
            mintKeypair.publicKey,
            decimals,
            payer.publicKey,
            null,
            TOKEN_2022_PROGRAM_ID
        ),
    );

    //transaction signature
    const signature = await sendAndConfirmTransaction(connection,
        mintTransaction, [payer, mintKeypair], {commitment : "finalized"}
    );  

    console.log("Transaction sent");
    return signature;
}

