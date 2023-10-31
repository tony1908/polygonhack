import express, { Express, Request, Response, Application } from 'express';
import dotenv from 'dotenv';

import { config } from "dotenv";
import { IBundler, Bundler } from "@biconomy/bundler";
import {
    BiconomySmartAccount,
    BiconomySmartAccountConfig,
    DEFAULT_ENTRYPOINT_ADDRESS,
} from "@biconomy/account";
import { Wallet, providers, ethers } from "ethers";
import { ChainId } from "@biconomy/core-types";
import {
    BiconomyPaymaster,
    IHybridPaymaster,
    PaymasterFeeQuote,
    PaymasterMode,
    SponsorUserOperationDto
} from "@biconomy/paymaster";
const { ERC20ABI } = require('./abi')
const { CONTRACTABI } = require('./contractabi')

// For env File
dotenv.config();

const app: Application = express();
const port = process.env.PORT || 8000;
const request = require("request");

// Middleware to parse JSON request body
app.use(express.json());

const bundler: IBundler = new Bundler({
    bundlerUrl:
        "https://bundler.biconomy.io/api/v2/137/",
    chainId: ChainId.POLYGON_MAINNET,
    entryPointAddress: DEFAULT_ENTRYPOINT_ADDRESS,
});

const provider = new providers.JsonRpcProvider(
    "https://rpc.ankr.com/polygon"
);

const wallet = new Wallet( "", provider);

const paymaster = new BiconomyPaymaster({
    paymasterUrl: "https://paymaster.biconomy.io/api/v1/137/"
});

const biconomySmartAccountConfig: BiconomySmartAccountConfig = {
    signer: wallet,
    paymaster: paymaster,
    chainId: ChainId.POLYGON_MAINNET,
    bundler: bundler,
    //defaultValidationModule: module,
    //activeValidationModule: module
};

async function createAccount() {
    let biconomySmartAccount = new BiconomySmartAccount(
        biconomySmartAccountConfig
    );

    biconomySmartAccount = await biconomySmartAccount.init();

    return biconomySmartAccount;
}

// Add a POST endpoint to log the request body
app.post('/webhook', (req: Request, res: Response) => {
    if (req.body['dataType'] == "message") {
        let text = req.body['data']['body']
        askChatGPT(text, (err, address, reply) => {
            if (reply == "send") {
                send(1, address)
                sendMessage("This is the tx:", ()=> {
                    res.json({ success: true})
                })
            }
            if (reply == "confirm") {
                send(1, address)
                sendMessage("This is the tx:", ()=> {
                    res.json({ success: true})
                })
            }
            if (reply == "buy_ticket") {
                purchaseGiftCard(1, "cinepolis", ()=>{
                    send(1, "")
                    sendMessage("This is your cinepolis tikcet:", ()=> {
                        res.json({ success: true})
                    })
                })
            }
            if (reply == "create_wallet") {
                createAccount()
                sendMessage("Account created", ()=> {
                    res.json({ success: true})
                })
            }
            if (reply == "greeting") {
                sendMessage("Hey, how can I help you?", ()=> {
                    res.json({ success: true})
                })
            }
        })
    } else {
        res.json({ success: true})
    }
});

app.listen(port, () => {
    console.log(`Server is live at http://localhost:${port}`);
});

function askChatGPT(text: string, callback: (err: any, address: any, reply: any) => void) {
    const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
    let prompt = `you need to extract for the following text, one the next intents depending on the contest: "send", "confirm","buy_ticket","create_wallet","greeting" you can only reply with the intent. The text is:` + text
    const ENDPOINT_URL = 'https://api.openai.com/v2/engines//completions';
    const API_KEY = '';

    const options = {
        url: ENDPOINT_URL,
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            prompt: prompt,
            max_tokens: 150
        })
    };

    request(options, (error: any, response: any, body: string) => {
        if (error) {
            // @ts-ignore
            callback(error, {address:"", reply: ""});
            return;
        }

        const responseBody = JSON.parse(body);
        const reply = responseBody.choices[0].text.trim();

        // Extract Ethereum address
        const addressMatches = text.match(ETH_ADDRESS_REGEX);
        const address = addressMatches ? addressMatches[0] : '';

        // @ts-ignore
        callback(null, {address, reply});
    });
}

function sendMessage(text: string, callback: (err: any, response: any) => void) {
    var request = require('request');
    var options = {
        'method': 'POST',
        'url': 'localhost:3000/client/sendMessage/sss',
        'headers': {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            "chatId": "@c.us",
            "contentType": "string",
            "content":text,
        })

    };
    request(options, function (error: string | undefined, response: { body: any; }) {
        if (error) {
            return callback(error, null)
        }
        return callback(null, response.body)
    });

}

// Define the method to make the gift card purchase request
function purchaseGiftCard( amount: any, type: any, callback: (arg0: null, arg1: { statusCode: any; body: any; } | null) => void) {
    // Replace these with your actual API endpoint and authentication/token
    const apiEndpoint = '';
    const authToken = '';

    const giftCardData = {
        amount,
        type,
    };

    const requestOptions = {
        url: apiEndpoint,
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
        },
        json: giftCardData,
    };

    request(requestOptions, (error: null, response: { statusCode: any; }, body: any) => {
        if (error) {
            callback(error, null);
        } else {
            callback(null, { statusCode: response.statusCode, body });
        }
    });
}

async function send(amount : number, address: string) {
    try {
        let tokenAddress = '0xc2132d05d31c914a87c6611c10748aeb04b58e8f'
        const biconomySmartAccount = await createAccount();

        const readProvider = new ethers.providers.JsonRpcProvider("https://rpc.ankr.com/polygon")
        const tokenContract = new ethers.Contract(tokenAddress, ERC20ABI, readProvider)
        let decimals = 18

        try {
            decimals = await tokenContract.decimals()
        } catch (error) {
            throw new Error('invalid token address supplied')
        }

        const amountGwei = ethers.utils.parseUnits(amount.toString(), decimals)
        const data = (await tokenContract.populateTransaction.transfer(address, amountGwei)).data
        const transaction = {
            to: tokenAddress,
            data,
        };

        // build partial userOp
        let partialUserOp = await biconomySmartAccount.buildUserOp([transaction]);

        let finalUserOp = partialUserOp;

        const biconomyPaymaster = biconomySmartAccount.paymaster as IHybridPaymaster<SponsorUserOperationDto>;
        let paymasterServiceData: SponsorUserOperationDto = {
            mode: PaymasterMode.SPONSORED,
        };

        console.log("6")

        try{
            const paymasterAndDataWithLimits =
                await biconomyPaymaster.getPaymasterAndData(
                    finalUserOp,
                    paymasterServiceData
                );
            finalUserOp.paymasterAndData = paymasterAndDataWithLimits.paymasterAndData;

            console.log("yepx")

            // below code is only needed if you sent the glaf calculateGasLimits = true
            if (
                paymasterAndDataWithLimits.callGasLimit &&
                paymasterAndDataWithLimits.verificationGasLimit &&
                paymasterAndDataWithLimits.preVerificationGas
            ) {

                // Returned gas limits must be replaced in your op as you update paymasterAndData.
                // Because these are the limits paymaster service signed on to generate paymasterAndData
                // If you receive AA34 error check here..

                finalUserOp.callGasLimit = paymasterAndDataWithLimits.callGasLimit;
                finalUserOp.verificationGasLimit =
                    paymasterAndDataWithLimits.verificationGasLimit;
                finalUserOp.preVerificationGas =
                    paymasterAndDataWithLimits.preVerificationGas;
            }
        } catch (e) {
            console.log("error received ", e);
        }

        //5

        console.log(`userOp: ${JSON.stringify(finalUserOp, null, "\t")}`);

        // Below function gets the signature from the user (signer provided in Biconomy Smart Account)
        // and also send the full op to attached bundler instance

        try {
            const userOpResponse = await biconomySmartAccount.sendUserOp(finalUserOp);
            console.log(`userOp Hash: ${userOpResponse.userOpHash}`);
            const transactionDetails = await userOpResponse.wait();
            console.log(
                `transactionDetails: ${JSON.stringify(transactionDetails, null, "\t")}`
            );
            //SendMessage("Thanks, this is the transaction: https://goerli.etherscan.io/tx/" + transactionDetails.receipt.transactionHash, "+525586169210")
        } catch (e) {
            console.log("error received ", e);
        }

    } catch (e) {
        console.log("el errorx", e)
    }

}






