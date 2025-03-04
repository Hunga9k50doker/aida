const axios = require("axios");
const fs = require("fs").promises;
const readline = require("readline");
const { newAgent, isTokenExpired, checkProxyIP } = require("./utils");
const { ethers } = require("ethers");
const banner = `Tool được phát triển bởi nhóm telegram: https://t.me/airdrophuntersieutoc`;
require("colors");
const { config: configBot } = require("./config");
const { jwtDecode } = require("jwt-decode");

const config = {
  baseUrl: "https://back.aidapp.com",
  campaignId: "6b963d81-a8e9-4046-b14f-8454bc3e6eb2",
  excludedMissionId: "f8edb0b4-ac7d-4a32-8522-65c5fb053725",
  headers: {
    authority: "back.aidapp.com",
    accept: "*/*",
    "accept-encoding": "gzip, deflate, br, zstd",
    "accept-language": "en-US,en;q=0.6",
    origin: "https://my.aidapp.com",
    referer: "https://my.aidapp.com/",
    "sec-ch-ua": '"Not(A:Brand";v="99", "Brave";v="133", "Chromium";v="133"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "sec-gpc": "1",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
  },
};

async function readProxies(filename) {
  try {
    const content = await fs.readFile(filename, "utf8");
    return content
      .trim()
      .split("\n")
      .filter((proxy) => proxy.length > 0);
  } catch (error) {
    console.error(`Error reading ${filename}:`, error.message);
    return [];
  }
}

async function readTokens(filename) {
  try {
    const content = await fs.readFile(filename, "utf8");
    return content
      .trim()
      .split("\n")
      .filter((token) => token.length > 0);
  } catch (error) {
    console.error(`Error reading ${filename}:`, error.message);
    return [];
  }
}

async function getAvailableMissions(accessToken, proxyAgent = null) {
  try {
    const currentDate = new Date().toISOString();
    const response = await axios.get(
      `${config.baseUrl}/questing/missions?filter%5Bdate%5D=${currentDate}&filter%5Bgrouped%5D=true&filter%5Bprogress%5D=true&filter%5Brewards%5D=true&filter%5Bstatus%5D=AVAILABLE&filter%5BcampaignId%5D=${config.campaignId}`,
      {
        headers: {
          ...config.headers,
          authorization: `Bearer ${accessToken}`,
        },
        ...(proxyAgent && { httpsAgent: proxyAgent }),
      }
    );
    return response.data.data.filter((mission) => mission.progress === "0" && mission.id !== config.excludedMissionId);
  } catch (error) {
    console.error("Error fetching available missions:", error.response?.data || error.message);
    return [];
  }
}

async function completeMission(missionId, accessToken, proxyAgent = null) {
  try {
    const response = await axios.post(
      `${config.baseUrl}/questing/mission-activity/${missionId}`,
      {},
      {
        headers: {
          ...config.headers,
          authorization: `Bearer ${accessToken}`,
          "content-length": "0",
        },
        ...(proxyAgent && { httpsAgent: proxyAgent }),
      }
    );
    console.log(`Mission ${missionId} completed successfully!`.green);
    return true;
  } catch (error) {
    console.error(`Error completing mission ${missionId}:`, error.response?.data || error.message);
    return false;
  }
}

// Function to save token
async function saveToken(token) {
  await fs.appendFile("token.txt", `${token.access_token}\n`);
  console.log(`Access token saved to token.txt`.green);
}

// Function to sign authentication message
async function signMessage(wallet, message) {
  return await wallet.signMessage(message);
}

async function login(wallet, inviterCode, proxyAgent) {
  const timestamp = Date.now();
  const message = `MESSAGE_ETHEREUM_${timestamp}:${timestamp}`;
  const signature = await signMessage(wallet, message);

  const url = `${config.baseUrl}/user-auth/login?strategy=WALLET&chainType=EVM&address=${wallet.address}&token=${message}&signature=${signature}&inviter=${inviterCode}`;

  try {
    const response = await axios.get(url, {
      headers: config.headers,
      ...(proxyAgent && { httpsAgent: proxyAgent }),
    });
    console.log(`Login Success`.green);
    // Save account and token
    // await saveToken(response.data.tokens);
    return response.data.tokens.access_token;
  } catch (error) {
    console.error(`Login Failed:`.yellow, error.response?.data || error.message);
    return null;
  }
}

async function claimMissionReward(missionId, accessToken, proxyAgent = null) {
  try {
    const response = await axios.post(
      `${config.baseUrl}/questing/mission-reward/${missionId}`,
      {},
      {
        headers: {
          ...config.headers,
          authorization: `Bearer ${accessToken}`,
          "content-length": "0",
        },
        ...(proxyAgent && { httpsAgent: proxyAgent }),
      }
    );
    console.log(`Reward for mission ${missionId} claimed successfully!`.green);
    return true;
  } catch (error) {
    console.error(`Error claiming reward for mission ${missionId}:`, error.response?.data || error.message);
    return false;
  }
}

function askQuestion(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function runBot() {
  console.log(banner.yellow);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("Choose an option:");
  console.log("1. Use proxy");
  console.log("2. Do not use proxy");
  const choice = await askQuestion(rl, "Enter your choice (1 or 2): ");
  const useProxy = choice === "1";

  const tokens = await readTokens("token.txt");
  const privateKeys = await readTokens("privateKeys.txt");

  let proxies = [];

  if (useProxy) {
    proxies = await readProxies("proxy.txt");
  }

  rl.close();

  if (useProxy && proxies.length === 0) {
    console.error("No proxies found in proxy.txt");
    return;
  }

  if (useProxy && proxies.length < tokens.length) {
    console.error(`Error: Insufficient proxies! Found ${proxies.length} proxies but need ${tokens.length} for all tokens.`.red);
    console.error("Each token requires a unique proxy. Please add more proxies to proxy.txt.".yellow);
    return;
  }

  console.log(`Found ${tokens.length} tokens${useProxy ? ` and ${proxies.length} proxies` : ""} to process...`.cyan);

  for (let i = 0; i < privateKeys.length; i++) {
    console.log(`\n[Account ${i + 1}]=============================`);
    let accessToken = tokens[i];
    let proxyAgent = null;
    let proxyInfo = "without proxy";

    if (useProxy) {
      const proxy = proxies[i];
      proxyAgent = newAgent(proxy);
      proxyInfo = await checkProxyIP(proxy);
      if (!proxyInfo) continue;
    }

    // const isExpired = isTokenExpired(accessToken);
    // if (isExpired) {
    //   console.log(`Token ${i + 1}/${tokens.length} is expired, logging...`.yellow);
    // }
    if (!privateKeys[i]) {
      console.error(`[Account ${i + 1}] No private key found for this token. Please add it to privateKeys.txt.`.yellow);
      continue;
    }
    const privateKey = privateKeys[i].startsWith("0x") ? privateKeys[i] : `0x${privateKeys[i]}`;
    const wallet = new ethers.Wallet(privateKey);
    accessToken = await login(wallet, configBot.ref_code, proxyAgent);

    if (!accessToken) {
      console.error(`[Account ${i + 1}] Failed to log in for this token.`.red);
      continue;
    }
    const tokenInfo = jwtDecode(accessToken);

    console.log(`Processing account ${i + 1} [${proxyInfo}]: ${tokenInfo.id}...`.blue);

    const availableMissions = await getAvailableMissions(accessToken, proxyAgent);
    if (availableMissions.length === 0) {
      console.log("No available missions to complete for this token.".yellow);
      continue;
    }

    console.log(`Found ${availableMissions.length} missions to complete.`.cyan);

    for (const mission of availableMissions) {
      console.log(`Processing mission: ${mission.label} (ID: ${mission.id})`.blue);
      const completed = await completeMission(mission.id, accessToken, proxyAgent);
      if (completed) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await claimMissionReward(mission.id, accessToken, proxyAgent);
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    console.log(`Finished processing token ${i + 1}`.green);
  }

  console.log("\nBot finished processing all tokens.".magenta);
}

runBot().catch((error) => {
  console.error("Bot encountered an error:", error);
});
