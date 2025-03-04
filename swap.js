import { ethers } from "ethers";
import cfonts from "cfonts";
import readline from "readline";
import dotenv from "dotenv";
import fs from "fs";

// Load environment variables from .env file
dotenv.config();

// Configuration
const RPC_URL = process.env.RPC_URL; // Load from .env
const PRIVATE_KEY = process.env.PRIVATE_KEY; // Load from .env
const LOOP_INTERVAL = 1 * 60 * 1000; // 1 minute interval

// Validate private key & RPC URL
if (!PRIVATE_KEY || !RPC_URL) {
  console.error("\x1b[31mError: PRIVATE_KEY or RPC_URL is not set in the .env file.\x1b[0m");
  process.exit(1);
}

// Initialize provider and wallet
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// Styled log helper
function styledLog(message, color = "\x1b[36m") {
  console.log(`${color}%s\x1b[0m`, message);
}

// Read addresses from file
function readAddressesFromFile(filePath) {
  try {
    const data = fs.readFileSync(filePath, "utf-8");
    return data
      .split("\n")
      .map((line) => line.trim())
      .filter((addr) => addr !== "");
  } catch (error) {
    console.error("\x1b[31mError reading address file:\x1b[0m", error.message);
    process.exit(1);
  }
}

// CLI prompt helper
function promptQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) =>
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    })
  );
}

// Send ether with nonce increment
async function sendEther(toAddress, amount, gasPrice, nonce) {
  try {
    styledLog(`Sending to: ${toAddress}`, "\x1b[32m");

    // Create transaction
    const tx = await wallet.sendTransaction({
      to: toAddress,
      value: ethers.parseEther(amount),
      gasPrice: ethers.parseUnits(gasPrice, "gwei"),
      nonce,
    });
    styledLog(`Transaction sent! Hash: ${tx.hash}`, "\x1b[36m");

    // Wait for confirmation
    styledLog("\nWaiting for confirmation...\n");
    const receipt = await tx;

    if (receipt) {
      styledLog("\u2705 Transaction Confirmed!", "\x1b[32m");
    } else {
      styledLog("\u274c Transaction not yet confirmed", "\x1b[31m");
    }
  } catch (error) {
    console.error("\x1b[31mError sending:\x1b[0m", error.message);
  }
}

// Main process
async function main() {
  cfonts.say("AIRDROPHOKA", {
    font: "slick",
    align: "center",
    colors: ["blue", "yellow"],
    background: "black",
    letterSpacing: 1,
    lineHeight: 1,
    space: true,
    maxLength: "0",
  });

  styledLog("=== Telegram Channel : @AirdropHoka", "\x1b[36m");

  const filePath = await promptQuestion("Enter the path to the address file (e.g., addresses.txt): ");
  const recipients = readAddressesFromFile(filePath);

  if (recipients.length === 0) {
    console.error("\x1b[31mError: No valid addresses found in the file.\x1b[0m");
    return;
  }

  styledLog(`Loaded ${recipients.length} addresses from file`, "\x1b[33m");

  const amount = await promptQuestion("Enter the amount of to send: ");
  const gasPrice = await promptQuestion("Enter the gas price in Gwei (e.g., 20): ");
  const loopCount = parseInt(await promptQuestion("Enter how many times to repeat (loop count): "), 10);

  // Fetch the starting nonce
  let currentNonce = await provider.getTransactionCount(wallet.address);

  for (let i = 0; i < loopCount; i++) {
    styledLog(`\n[Loop ${i + 1}/${loopCount}]`, "\x1b[35m");

    for (const recipient of recipients) {
      await sendEther(recipient, amount, gasPrice, currentNonce);
      currentNonce++; // Increment nonce after each transaction
    }

    if (i < loopCount - 1) {
      styledLog(`Waiting for 1 minute before the next transaction...`, "\x1b[33m");
      await new Promise((resolve) => setTimeout(resolve, LOOP_INTERVAL));
    }
  }

  styledLog("\nAll transactions completed! Exiting script.", "\x1b[32m");
}

// Run the script
main();
