import express, { Request, Response } from "express";
import axios from "axios";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

const app = express();
app.use(
  express.json({
    verify: (req: any, res, buf) => {
      req.rawBody = buf;
    },
  })
);

const BOT_TOKEN = process.env.BOT_TOKEN!;
const CHAT_ID = process.env.CHAT_ID!;
const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET!;

interface GitHubUser {
  login: string;
}

interface GitHubBranch {
  ref: string;
}

interface GitHubPullRequest {
  title: string;
  html_url: string;
  created_at: string;
  user: GitHubUser;
  assignees: GitHubUser[];
  requested_reviewers: GitHubUser[];
  head: GitHubBranch;
  base: GitHubBranch;
}

interface GitHubRepository {
  name: string;
  full_name: string;
}

interface GitHubDeployment {
  ref: string;
  environment: string;
  description: string | null;
  creator: GitHubUser;
  created_at: string;
}

interface GitHubDeploymentStatus {
  state: string;
  description: string | null;
  environment: string;
  environment_url: string | null;
  log_url: string | null;
  created_at: string;
  creator: GitHubUser;
}

interface GitHubWebhookPayload {
  action: string;
  pull_request?: GitHubPullRequest;
  deployment?: GitHubDeployment;
  deployment_status?: GitHubDeploymentStatus;
  repository: GitHubRepository;
}

app.post("/webhook/github", async (req: any, res: Response) => {
  const signature = req.headers["x-hub-signature-256"] as string;

  if (!signature) return res.status(401).send("Missing signature");

  const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
  const digest = "sha256=" + hmac.update(req.rawBody).digest("hex");

  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );

  if (!isValid) return res.status(401).send("Invalid signature");

  const {
    action,
    pull_request,
    deployment,
    deployment_status,
    repository,
  }: GitHubWebhookPayload = req.body;

  // Deployment Status event
  if (deployment_status && deployment) {
    const stateEmoji: Record<string, string> = {
      success: "✅",
      failure: "❌",
      error: "🚨",
      pending: "⏳",
      in_progress: "🔄",
      queued: "📋",
      waiting: "⌛",
    };

    const emoji = stateEmoji[deployment_status.state] ?? "🔔";
    const deployedDate = new Date(deployment_status.created_at).toLocaleString(
      "id-ID",
      { timeZone: "Asia/Jakarta" }
    );

    const deploymentMessage = `
${emoji} *Deployment Status*

*Project Name:* ${repository.name}
*Environment:* ${deployment_status.environment}
*Status:* ${deployment_status.state.toUpperCase()}
*Branch/Ref:* ${deployment.ref}
*Deployed By:* @${deployment_status.creator.login}
*Description:* ${deployment_status.description || "-"}
*Date:* ${deployedDate} WIB${deployment_status.environment_url ? `
*Environment URL:* ${deployment_status.environment_url}` : ""}${deployment_status.log_url ? `
*Log:* [View Logs](${deployment_status.log_url})` : ""}
`;

    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        chat_id: CHAT_ID,
        text: deploymentMessage,
        parse_mode: "Markdown",
      }
    );

    return res.sendStatus(200);
  }

  // Deployment event
  if (deployment && !deployment_status) {
    const actionEmoji: Record<string, string> = {
      created: "🚀",
      deleted: "🗑️",
    };

    const emoji = actionEmoji[action] ?? "🔔";
    const deployedDate = new Date(deployment.created_at).toLocaleString(
      "id-ID",
      { timeZone: "Asia/Jakarta" }
    );

    const deploymentMessage = `
${emoji} *Deployment*

*Project Name:* ${repository.name}
*Action:* ${action}
*Environment:* ${deployment.environment}
*Branch/Ref:* ${deployment.ref}
*Triggered By:* @${deployment.creator.login}
*Description:* ${deployment.description || "-"}
*Date:* ${deployedDate} WIB
`;

    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        chat_id: CHAT_ID,
        text: deploymentMessage,
        parse_mode: "Markdown",
      }
    );

    return res.sendStatus(200);
  }

  if (!pull_request) return res.sendStatus(200);

  const projectName = repository.name;
  const user = pull_request.user.login;
  const assignees =
    pull_request.assignees.map((a) => `@${a.login}`).join(", ") || "-";
  const reviewers =
    pull_request.requested_reviewers.map((r) => `@${r.login}`).join(", ") ||
    "-";

  const sourceBranch = pull_request.head.ref;
  const targetBranch = pull_request.base.ref;

  const requestedDate = new Date(pull_request.created_at).toLocaleString(
    "id-ID",
    { timeZone: "Asia/Jakarta" }
  );

  const title = pull_request.title;
  const link = pull_request.html_url;

  const message = `
🔔 *Merge Request*

*Project Name:* ${projectName}
*Action:* ${action}
*User:* ${user}
*Assignee:* ${assignees}
*Reviewer:* ${reviewers}
*Source Branch:* ${sourceBranch}
*Target Branch:* ${targetBranch}
*Requested Date:* ${requestedDate} WIB
*Link MR:* [${title}](${link})
`;

  await axios.post(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
    {
      chat_id: CHAT_ID,
      text: message,
      parse_mode: "Markdown",
    }
  );

  res.sendStatus(200);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
