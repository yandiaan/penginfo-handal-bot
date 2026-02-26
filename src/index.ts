import express, { Request, Response } from "express";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN!;
const CHAT_ID = process.env.CHAT_ID!;
const PORT = process.env.PORT || 3000;

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
}

interface GitHubWebhookPayload {
  action: string;
  pull_request?: GitHubPullRequest;
  repository: GitHubRepository;
}

app.post("/webhook/github", async (req: Request, res: Response) => {
  const { action, pull_request, repository }: GitHubWebhookPayload = req.body;

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
