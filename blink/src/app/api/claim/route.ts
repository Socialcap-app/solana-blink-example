import {
  ACTIONS_CORS_HEADERS,
  ACTIONS_CORS_HEADERS_MIDDLEWARE,
  ActionGetResponse,
  ActionPostRequest,
  ActionPostResponse,
  createPostResponse,
} from "@solana/actions";
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  clusterApiUrl,
} from "@solana/web3.js";
import { AnchorProvider, Program, web3 } from "@coral-xyz/anchor";
import IDL from "./../../claim_contract.json";

import axios, { AxiosResponse } from "axios";

// GET request handler
export async function GET(request: Request) {
  const planUid = "ee50a79f6ee9426ab7ab4c2d9ea06b9c";
  const API_URL = "https://api.socialcap.dev/api/query";
  const API_URL_LOCAL = "http://localhost:30800/api/query";
  const url = new URL(request.url);
  const response: AxiosResponse = await axios.get(
    `${API_URL_LOCAL}/get_plan_public?params={"uid":"${planUid}"}`,
    {
      headers: {
        ...ACTIONS_CORS_HEADERS,
        Authorization:
          "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiJlYzNjNmUyNTRkMGI0MmRlYmQ5MzlkOWE3YmQ3Y2FjYyIsInNlc3Npb25fa2V5IjoiOWQ4MzM5YTAwZjU3NDA3NTk3MDg0YzBkMGExYzQyMWYiLCJjcmVhdGVkX3V0YyI6IjIwMjQtMDgtMjRUMTM6MTU6MjEuNjczWiIsImV4cGlyZXNfdXRjIjpudWxsLCJpYXQiOjE3MjQ1MDUzMjF9.OEoXYEHcsyAoVmuwGc8TZlk5kBa-t-3REYjzL-FuLLc",
      },
    }
  );

  if (!response.data) {
    return new Response("Could not get claim", { status: 500 });
  }
  const claim = response.data.data;
  const evidenceFormData: any[] = response.data.data.evidence;
  let hrefParams = evidenceFormData.map(
    (field) => `${field.sid}={${field.sid}}`
  );
  let parameters = evidenceFormData.map((field) => ({
    name: field.sid,
    label: field.description,
  }));
  const payload: ActionGetResponse = {
    type: "action",
    icon: claim.image, // Local icon path
    title: claim.name,
    description: claim.description,
    label: "Claim this credential",
    links: {
      actions: [
        {
          href: `/api/claim?email={email}&planUid=${planUid}&${hrefParams.join("&")}`, /// replace with Socialcap call  . Parameters are in the href , sid property from field
          label: "Claim",
          parameters: [{ name: "email", label: "Email" }, ...parameters],
        },
      ],
    },
  };
  return new Response(JSON.stringify(payload), {
    headers: ACTIONS_CORS_HEADERS,
  });
}

export const OPTIONS = GET; // OPTIONS request handler

// POST request handler
export async function POST(request: Request) {
  const body: ActionPostRequest = await request.json();

  const url = new URL(request.url);
  let sender;

  console.log("POST received: ", url);

  try {
    sender = new PublicKey(body.account);
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: {
          message: "Invalid account",
        },
      }),
      {
        status: 400,
        headers: ACTIONS_CORS_HEADERS,
      }
    );
  }
  console.log("POST sender: ", sender);

  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
  const programId = new PublicKey(
    "DsizHqMmG29T3W74m8TxSSMnQA9XcBS3UPcngnRoYCgT"
  );

  const provider = new AnchorProvider(connection, {
    publicKey: sender,
  } as any);
  const claimProgram = new Program(IDL, provider);

  const [claimPk] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("claim"), provider.wallet.publicKey.toBuffer()],
    claimProgram.programId,
  )
  console.log("Claim PDA:", claimPk.toBase58());

  const instruction = await claimProgram.methods
    .createClaim("uid1", "com2", "plan3", "email")
    .accountsPartial({ claim: claimPk, signer: sender })
    .instruction();

  // TODO : Replace with your transaction
  const transaction = new Transaction().add(instruction);
  transaction.feePayer = sender;
  transaction.recentBlockhash = (
    await connection.getLatestBlockhash()
  ).blockhash;
  transaction.lastValidBlockHeight = (
    await connection.getLatestBlockhash()
  ).lastValidBlockHeight;
  console.log("transaction: ", transaction);

  console.log(transaction.signatures);

  const payload: ActionPostResponse = await createPostResponse({
    fields: {
      transaction,
      message: "Transaction created",
    },
  });
  console.log("Transaction payload: ", payload);
  const API_URL_LOCAL = "http://localhost:30800/api";
  const urlPost = `${API_URL_LOCAL}/mutation/register_and_submit_claim`;
  let paramsPayload: any = {};
  url.searchParams.forEach((value, key) => {
    paramsPayload[key] = value;
  });

  console.log("search params: ", paramsPayload);

  const resPost = await fetch(urlPost, {
    method: "POST",
    headers: {
      Accept: "application/json; charset=utf-8",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({params: paramsPayload}),
  });
  console.log("response: ", resPost);

  return new Response(JSON.stringify(payload), {
    headers: ACTIONS_CORS_HEADERS,
  });
}
